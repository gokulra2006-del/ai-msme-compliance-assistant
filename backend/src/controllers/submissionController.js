const RegulatorySubmission = require('../models/RegulatorySubmission');
const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const RegulatorySource = require('../models/RegulatorySource');
const Evidence = require('../models/Evidence');
const DocumentDraft = require('../models/DocumentDraft');
const EvidenceIntelligence = require('../services/evidenceIntelligenceService');
const { logAudit } = require('../utils/auditLogger');

// The JWT only carries the user id, so the business is resolved from the user
// record. Every query below is scoped by the resolved business id, which is what
// prevents one business from reaching another's submissions or evidence.
async function resolveBusiness(req) {
  return EvidenceIntelligence.resolveBusinessForUser(req.user);
}

exports.getSubmission = async (req, res) => {
  try {
    const { actionId } = req.params;
    const business = await resolveBusiness(req);
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const action = await ComplianceAction.findOne({ _id: actionId, business: business._id }).populate('obligationId');
    if (!action) return res.status(404).json({ error: 'Compliance action not found' });

    let submission = await RegulatorySubmission.findOne({ complianceAction: actionId }).populate('timeline.userId', 'name email');

    if (!submission) {
      return res.status(200).json({ data: null, action });
    }

    let businessComplete = true;

    // Evidence readiness comes from the shared Evidence Intelligence service, so
    // Submission Assistance reports exactly the same status as the Evidence
    // Vault, Inspection Readiness and Document Preparation.
    const evidenceStatus = await EvidenceIntelligence.getObligationEvidenceStatus({
      business,
      obligationCode: action.ruleCode,
      requiredEvidence: action.evidenceRequired || []
    });

    // An obligation with no recorded evidence requirement is NOT treated as
    // "all evidence verified" — that would report an unknown as a pass.
    const allEvidenceVerified = evidenceStatus.hasRequirements && evidenceStatus.allSatisfied;

    const drafts = await DocumentDraft.find({ business: business._id, obligationCode: action.ruleCode });
    const hasDrafts = drafts.length > 0 && drafts.every(d => d.documentStatus === 'APPROVED');

    const checklist = {
      businessInfoComplete: businessComplete,
      allEvidenceVerified: allEvidenceVerified,
      hasPreparedDrafts: hasDrafts,
      officialPortalVerified: !!submission.officialPortalUrl
    };

    let readinessStatus = 'DOCUMENTS_MISSING';
    if (checklist.businessInfoComplete && checklist.allEvidenceVerified && checklist.hasPreparedDrafts) {
      if (submission.submissionStatus === 'NOT_STARTED' || submission.submissionStatus === 'DOCUMENTS_MISSING') {
        readinessStatus = 'READY_FOR_SUBMISSION';
      } else {
        readinessStatus = submission.submissionStatus;
      }
    } else {
      if (submission.submissionStatus === 'READY_FOR_SUBMISSION') {
        readinessStatus = 'DOCUMENTS_MISSING';
      } else {
        readinessStatus = submission.submissionStatus;
      }
    }

    res.status(200).json({
      data: submission,
      checklist,
      dynamicStatus: readinessStatus,
      evidenceStatus: {
        checklist: evidenceStatus.checklist,
        missing: evidenceStatus.missing,
        expired: evidenceStatus.expired,
        unverified: evidenceStatus.unverified,
        rejected: evidenceStatus.rejected,
        hasRequirements: evidenceStatus.hasRequirements,
        noRequirementNotice: evidenceStatus.noRequirementNotice,
        traceability: evidenceStatus.traceability
      },
      notices: {
        verification: EvidenceIntelligence.VERIFICATION_MEANING
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.startSubmission = async (req, res) => {
  try {
    const { actionId } = req.params;
    const business = await resolveBusiness(req);
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const action = await ComplianceAction.findOne({ _id: actionId, business: business._id });
    if (!action) return res.status(404).json({ error: 'Action not found' });

    let submission = await RegulatorySubmission.findOne({ complianceAction: actionId });
    if (submission) return res.status(400).json({ error: 'Submission already started' });

    const rule = await ComplianceRule.findOne({ ruleCode: action.ruleCode });
    const source = await RegulatorySource.findOne({ actName: rule?.act, verificationStatus: 'VERIFIED' });

    submission = new RegulatorySubmission({
      business: business._id,
      obligation: action.obligationId || null,
      complianceAction: action._id,
      regulatorySource: source ? source._id : null,
      authority: source ? source.regulator : rule?.regulator,
      officialPortalUrl: source ? source.officialUrl : null,
      submissionStatus: 'NOT_STARTED',
      timeline: [{ status: 'NOT_STARTED', notes: 'Submission workflow initialized', userId: req.user._id }]
    });

    await submission.save();

    action.submissionId = submission._id;
    await action.save();

    res.status(201).json({ data: submission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markReady = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const business = await resolveBusiness(req);
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const submission = await RegulatorySubmission.findOne({ _id: submissionId, business: business._id });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const action = await ComplianceAction.findById(submission.complianceAction);
    if (action) {
      const evidenceStatus = await EvidenceIntelligence.getObligationEvidenceStatus({
        business,
        obligationCode: action.ruleCode,
        requiredEvidence: action.evidenceRequired || []
      });

      const gaps = [
        ...evidenceStatus.missing.map(type => ({ documentType: type, state: 'MISSING' })),
        ...evidenceStatus.expired.map(type => ({ documentType: type, state: 'EXPIRED' })),
        ...evidenceStatus.rejected.map(type => ({ documentType: type, state: 'REJECTED' })),
        ...evidenceStatus.unverified.map(type => ({ documentType: type, state: 'NOT_YET_REVIEWED' }))
      ];

      // Evidence gaps are never bypassed silently. The user may proceed, but
      // only by acknowledging the gaps explicitly, and the acknowledgement is
      // written to the timeline and the audit log.
      if (gaps.length && req.body?.acknowledgeEvidenceGaps !== true) {
        return res.status(409).json({
          error: 'Required evidence is not complete for this obligation.',
          requiresAcknowledgement: true,
          evidenceGaps: gaps,
          notice: 'You can still mark this ready, but you must acknowledge the outstanding evidence. The acknowledgement is recorded.'
        });
      }

      if (gaps.length) {
        submission.timeline.push({
          status: submission.submissionStatus,
          notes: `Evidence gaps acknowledged by user: ${gaps.map(gap => `${gap.documentType} (${gap.state})`).join('; ')}`,
          userId: req.user._id
        });
        await logAudit({
          req,
          action: 'SUBMISSION_EVIDENCE_GAPS_ACKNOWLEDGED',
          entity: 'RegulatorySubmission',
          entityId: submission._id,
          businessId: business._id,
          metadata: { obligationCode: action.ruleCode, gaps }
        });
      }
    }

    submission.submissionStatus = 'READY_FOR_SUBMISSION';
    submission.readyAt = new Date();
    submission.timeline.push({ status: 'READY_FOR_SUBMISSION', notes: 'Marked ready for external submission', userId: req.user._id });
    await submission.save();

    res.status(200).json({ data: submission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.recordExternalSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { acknowledgementNumber, submissionDate, notes } = req.body;

    const business = await resolveBusiness(req);
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const submission = await RegulatorySubmission.findOne({ _id: submissionId, business: business._id });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    submission.submissionStatus = 'SUBMITTED_BY_USER';
    submission.acknowledgementNumber = acknowledgementNumber;
    submission.acknowledgementDate = submissionDate || new Date();
    if (notes) submission.notes = notes;
    submission.submittedAt = new Date();
    submission.submittedBy = req.user._id;

    submission.timeline.push({ status: 'SUBMITTED_BY_USER', notes: `User declared external submission. Ref: ${acknowledgementNumber || 'N/A'}`, userId: req.user._id });
    await submission.save();

    res.status(200).json({ data: submission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addQuery = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { authorityMessage, requestedDocuments, responseDeadline } = req.body;

    const business = await resolveBusiness(req);
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const submission = await RegulatorySubmission.findOne({ _id: submissionId, business: business._id });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    submission.submissionStatus = 'QUERY_RECEIVED';
    submission.queries.push({ authorityMessage, requestedDocuments, responseDeadline });

    submission.timeline.push({ status: 'QUERY_RECEIVED', notes: 'Authority requested additional info/documents', userId: req.user._id });
    await submission.save();

    res.status(200).json({ data: submission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.attachAcknowledgement = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { evidenceId } = req.body;

    const business = await resolveBusiness(req);
    if (!business) return res.status(404).json({ error: 'Business profile not found' });

    const submission = await RegulatorySubmission.findOne({ _id: submissionId, business: business._id });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // Ownership is re-checked against the resolved business — an evidence id from
    // another business can never be attached.
    const evidence = await Evidence.findOne({ _id: evidenceId, business: business._id });
    if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
    if (evidence.archived) return res.status(400).json({ error: 'This document is archived and cannot be attached as an acknowledgement.' });

    submission.acknowledgementReceiptId = evidenceId;
    submission.submissionStatus = 'COMPLETED';
    submission.timeline.push({ status: 'COMPLETED', notes: 'Acknowledgement evidence attached. Submission completed.', userId: req.user._id });
    await submission.save();

    const action = await ComplianceAction.findById(submission.complianceAction);
    if (action) {
      action.status = 'COMPLETED';
      action.completionDate = new Date();
      action.evidenceAttached = action.evidenceAttached || [];
      if (!action.evidenceAttached.includes(evidenceId)) {
        action.evidenceAttached.push(evidenceId);
      }
      await action.save();
    }

    await logAudit({
      req,
      action: 'SUBMISSION_ACKNOWLEDGEMENT_ATTACHED',
      entity: 'RegulatorySubmission',
      entityId: submission._id,
      businessId: business._id,
      metadata: {
        evidenceId: String(evidenceId),
        evidenceVerificationStatus: evidence.verificationStatus,
        note: 'The acknowledgement document was attached by a user. SurakshaSetu did not submit anything to any authority.'
      }
    });

    res.status(200).json({ data: submission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
