const ComplianceAction = require('../models/ComplianceAction');
const Evidence = require('../models/Evidence');
const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const DocumentDraft = require('../models/DocumentDraft');
const RegulatorySubmission = require('../models/RegulatorySubmission');
const EvidenceIntelligence = require('../services/evidenceIntelligenceService');
const {
  getExpiryStatus,
  daysUntilExpiry,
  indexEvidenceForMatching,
  findEvidenceForRequirement,
  resolveRequiredEvidenceState,
  satisfiesRequirement
} = require('../utils/evidenceStatus');

class InspectionService {
  async getInspectionReadiness(businessId) {
    if (!businessId) {
      throw new Error('No business associated with user');
    }

    // 1. Fetch applicable compliance actions and populate obligation and assigned user
    const actions = await ComplianceAction.find({
      business: businessId,
      applicability: 'APPLIES'
    })
      .populate({ path: 'obligationId', populate: { path: 'regulatorySource' } })
      .populate('assignedTo', 'name email role');

    // 2. Fetch all evidence uploaded by this business and populate users
    const evidenceList = await Evidence.find({ business: businessId })
      .populate('uploadedBy', 'name email')
      .populate('verifiedBy', 'name email');

    const drafts = await DocumentDraft.find({ business: businessId, isCurrent: true }).lean();
    const submissions = await RegulatorySubmission.find({ business: businessId }).lean();

    const now = new Date();
    // Superseded and archived documents are excluded from matching by the shared helper
    const evidenceIdx = indexEvidenceForMatching(evidenceList);

    const requiredDocsMap = new Map(); // key: obligationCode + docType
    const criticalGaps = [];
    const missingDocuments = [];
    const expiringEvidence = [];
    const evidenceIndex = [];
    let missingCount = 0;
    let expiredCount = 0;
    let unverifiedCount = 0;
    let overdueCount = 0;

    // 3. Process requirements into a checklist
    const checklist = actions.map(action => {
      const obligation = action.obligationId;
      if (!obligation) return null;

      const isOverdue = action.dueDate && new Date(action.dueDate) < new Date() && action.status !== 'COMPLETED';
      
      const penaltyDesc = obligation.penaltyDescription || 'Not available in the Suraksha Rules engine';
      const severityDesc = action.priority || obligation.severity;
      
      if (isOverdue) {
        overdueCount++;
        if (['HIGH', 'CRITICAL'].includes(severityDesc)) {
          criticalGaps.push({
            issue: 'Overdue High-Risk Action',
            obligation: obligation.title,
            severity: severityDesc,
            actionId: action._id,
            reason: `Action "${action.title}" is overdue and poses significant compliance risk based on Suraksha Rules penalty guidelines.`,
            type: 'OVERDUE_ACTION',
            // Detailed explanation for AI & UI:
            whatIsTheIssue: `Action "${action.title}" is past its due date.`,
            whyDoesItMatter: penaltyDesc,
            whatIsMissing: 'Action completion',
            whatShouldIDo: `Complete the action: ${action.recommendedAction || 'Follow obligation guidelines'}`,
            whoShouldDoIt: action.assignedTo ? action.assignedTo.name : 'Business Owner',
            whenShouldItBeDone: 'Immediately (Overdue)',
            source: obligation.regulatorySource ? `${obligation.regulatorySource.actName} Sec ${obligation.regulatorySource.section}` : 'Suraksha Rules'
          });
        }
      }

      const submission = submissions.find(s => s.complianceAction?.toString() === action._id.toString());

      return {
        actionId: action._id,
        title: action.title,
        obligationName: obligation.title,
        ruleCode: action.ruleCode,
        domain: obligation.complianceDomain,
        jurisdiction: obligation.jurisdictionLevel,
        status: action.status || 'PENDING',
        requiredEvidence: action.evidenceRequired,
        deadline: action.dueDate,
        severity: severityDesc,
        penalty: penaltyDesc,
        responsibleUser: action.assignedTo ? action.assignedTo.name : 'Unassigned',
        regulatorySource: obligation.regulatorySource ? {
          actName: obligation.regulatorySource.actName,
          section: obligation.regulatorySource.section,
          url: obligation.regulatorySource.sourceUrl
        } : null,
        isOverdue,
        submissionStatus: submission ? submission.submissionStatus : 'NOT_STARTED',
        submissionReference: submission ? submission.acknowledgementNumber : null
      };
    }).filter(Boolean);

    const ei = await EvidenceIntelligence.getEvidenceIntelligence({ business: businessId });
    const documentChecklist = ei.requiredDocuments || ei.requirements; // ei.requirements is what evidenceIntelligenceService actually returns in its object!

    documentChecklist.forEach(reqDoc => {
      if (reqDoc.status === 'EXPIRED') {
        expiredCount++;
        if (['HIGH', 'CRITICAL'].includes(reqDoc.severity)) {
          criticalGaps.push({
            issue: 'Expired Critical Evidence',
            obligation: reqDoc.obligationTitle,
            severity: reqDoc.severity,
            docType: reqDoc.documentType,
            reason: `Evidence "${reqDoc.documentType}" has expired. Operating without valid critical documents carries immediate legal risk under Suraksha Rules.`,
            type: 'EXPIRED_EVIDENCE',
            whatIsTheIssue: `The required document "${reqDoc.documentType}" has expired.`,
            whyDoesItMatter: 'Non-compliance penalty',
            whatIsMissing: 'Valid, unexpired evidence',
            whatShouldIDo: 'Renew or re-issue the document and upload it to the Evidence Vault.',
            whoShouldDoIt: reqDoc.assignedTo ? reqDoc.assignedTo.name : 'Business Owner',
            whenShouldItBeDone: 'Immediately (Expired)',
            source: 'Suraksha Rules'
          });
        }
      } else if (reqDoc.status === 'UNVERIFIED' || reqDoc.status === 'UNDER_REVIEW') {
        unverifiedCount++;
      }
    });

    // 5. Evidence index for the inspection pack
    evidenceIdx.active.forEach(ev => {
      const expiryStatus = getExpiryStatus(ev.expiryDate, now);
      evidenceIndex.push({
        evidenceId: ev._id,
        name: ev.documentName,
        type: ev.documentType,
        obligationCode: ev.obligationCode,
        documentNumber: ev.documentNumber || 'NOT DETECTED',
        uploadDate: ev.createdAt,
        expiryDate: ev.expiryDate,
        expiryStatus,
        verificationStatus: ev.verificationStatus,
        potentialIssueCount: (ev.potentialIssues || []).length,
        responsibleUser: ev.uploadedBy ? ev.uploadedBy.name : 'System'
      });

      if (expiryStatus === 'EXPIRED' || expiryStatus === 'EXPIRING_SOON') {
        expiringEvidence.push({
          documentName: ev.documentName,
          documentType: ev.documentType,
          obligationCode: ev.obligationCode,
          expiryDate: ev.expiryDate,
          daysUntilExpiry: daysUntilExpiry(ev.expiryDate, now),
          status: expiryStatus,
          // Need these for EXPLAINABLE checklist
          obligationTitle: actions.find(a => a.ruleCode === ev.obligationCode)?.obligationId?.title || 'Unknown',
          risk: expiryStatus === 'EXPIRED' ? 'Immediate Penalty Risk' : 'Upcoming Compliance Risk',
          recommendedAction: expiryStatus === 'EXPIRED' ? 'Renew immediately' : 'Prepare for renewal'
        });
      }
    });

    // Finalize missing docs and gaps
    documentChecklist.forEach(doc => {
      const matchingDraft = drafts.find(d => d.obligationCode === doc.obligationCode);
      if (matchingDraft) {
        doc.draftStatus = matchingDraft.documentStatus;
        doc.draftVersion = matchingDraft.version;
      } else {
        doc.draftStatus = 'NOT_STARTED';
      }

      if (doc.status === 'MISSING' || doc.status === 'REJECTED') {
        missingCount++;
        missingDocuments.push(doc);
        if (['HIGH', 'CRITICAL'].includes(doc.severity)) {
          criticalGaps.push({
            issue: doc.status === 'REJECTED' ? 'Rejected Critical Evidence' : 'Missing Critical Evidence',
            obligation: doc.obligationTitle,
            severity: doc.severity,
            docType: doc.documentType,
            reason: `Failure to maintain ${doc.documentType} violates critical Suraksha Rules requirements for this obligation.`,
            type: doc.status === 'REJECTED' ? 'REJECTED_EVIDENCE' : 'MISSING_EVIDENCE',
            whatIsTheIssue: doc.status === 'REJECTED' ? `The uploaded document for "${doc.documentType}" was rejected by reviewer.` : `Required document "${doc.documentType}" has not been provided.`,
            whyDoesItMatter: doc.penalty,
            whatIsMissing: 'Valid evidence document',
            whatShouldIDo: doc.status === 'REJECTED' ? 'Fix the rejection issues and re-upload the document.' : 'Upload the missing document or prepare a draft via Document Copilot.',
            whoShouldDoIt: doc.assignedTo ? doc.assignedTo.name : 'Business Owner',
            whenShouldItBeDone: 'Immediate Priority',
            source: doc.regulatorySource ? `${doc.regulatorySource.actName} Sec ${doc.regulatorySource.section}` : 'Suraksha Rules'
          });
        }
      }
    });

    // 6. Calculate readiness score
    let score = 100;
    documentChecklist.forEach(doc => {
      if (doc.status === 'MISSING' || doc.status === 'EXPIRED' || doc.status === 'REJECTED') {
        if (doc.severity === 'CRITICAL') score -= 10;
        else if (doc.severity === 'HIGH') score -= 5;
        else score -= 2;
      } else if (doc.status === 'UNVERIFIED' || doc.status === 'PENDING' || doc.status === 'UNDER_REVIEW') {
        score -= 1;
      }
    });

    score -= (overdueCount * 5);
    score = Math.max(0, Math.min(100, score));

    let readinessStatus = 'READY';
    if (score < 50) readinessStatus = 'HIGH_RISK';
    else if (score < 70) readinessStatus = 'NEEDS_ATTENTION';
    else if (score < 90) readinessStatus = 'MOSTLY_READY';

    if (actions.length === 0) {
      readinessStatus = 'INSUFFICIENT_DATA';
      score = 0;
    }

    const recentUpdates = await RegulatoryUpdate.find({ status: 'VERIFIED' })
      .sort({ effectiveDate: -1 })
      .limit(5);

    return {
      readinessScore: score,
      readinessStatus,
      metrics: {
        totalRequired: documentChecklist.length,
        missingCount,
        expiredCount,
        unverifiedCount,
        overdueCount
      },
      documentChecklist,
      missingDocuments,
      expiringEvidence,
      evidenceIndex,
      checklist,
      criticalGaps,
      overdueActions: actions.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED'),
      upcomingActions: actions.filter(a => a.dueDate && new Date(a.dueDate) >= new Date() && a.status !== 'COMPLETED').slice(0, 5),
      recentUpdates,
      notices: {
        verification: EvidenceIntelligence.VERIFICATION_MEANING
      }
    };
  }
}

module.exports = new InspectionService();
