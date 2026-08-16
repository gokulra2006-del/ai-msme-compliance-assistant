const express = require('express');
const router = express.Router();
const ComplianceAction = require('../models/ComplianceAction');
const Evidence = require('../models/Evidence');
const Obligation = require('../models/Obligation');
const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const AuditLog = require('../models/AuditLog');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/inspection/readiness
router.get('/readiness', auth, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'No business associated with user' });
    }

    // 1. Fetch applicable compliance actions (which represent the specific required obligations for this business)
    const actions = await ComplianceAction.find({ 
      business: businessId, 
      applicability: 'APPLIES' 
    }).populate('obligationId');

    // 2. Fetch all evidence uploaded by this business
    const evidenceList = await Evidence.find({ business: businessId });

    // 3. Process requirements
    const requiredDocsMap = new Map(); // key: obligationCode + docType
    const criticalGaps = [];
    let missingCount = 0;
    let expiredCount = 0;
    let unverifiedCount = 0;
    let overdueCount = 0;

    // Build the required docs map from the obligations the business actually has
    actions.forEach(action => {
      const obligation = action.obligationId;
      if (!obligation) return;

      const isOverdue = action.dueDate && new Date(action.dueDate) < new Date() && action.status !== 'COMPLETED';
      if (isOverdue) {
        overdueCount++;
        criticalGaps.push({
          issue: 'Overdue Compliance Action',
          obligation: obligation.title,
          severity: action.priority || obligation.severity,
          actionId: action._id,
          reason: action.title,
          type: 'OVERDUE_ACTION'
        });
      }

      if (action.evidenceRequired && action.evidenceRequired.length > 0) {
        action.evidenceRequired.forEach(docType => {
          const key = `${action.ruleCode}::${docType}`;
          requiredDocsMap.set(key, {
            obligationCode: action.ruleCode,
            obligationTitle: obligation.title,
            severity: obligation.severity,
            documentType: docType,
            status: 'MISSING',
            evidenceId: null,
            expiryDate: null
          });
        });
      }
    });

    // 4. Map uploaded evidence to requirements
    evidenceList.forEach(ev => {
      const key = `${ev.obligationCode}::${ev.documentType}`;
      const reqDoc = requiredDocsMap.get(key);
      
      if (reqDoc) {
        reqDoc.evidenceId = ev._id;
        reqDoc.expiryDate = ev.expiryDate;
        
        if (ev.verificationStatus === 'VERIFIED') {
          if (ev.expiryDate && new Date(ev.expiryDate) < new Date()) {
            reqDoc.status = 'EXPIRED';
            expiredCount++;
            if (['HIGH', 'CRITICAL'].includes(reqDoc.severity)) {
              criticalGaps.push({
                issue: 'Expired Critical Document',
                obligation: reqDoc.obligationTitle,
                severity: reqDoc.severity,
                docType: reqDoc.documentType,
                type: 'EXPIRED_EVIDENCE'
              });
            }
          } else {
            reqDoc.status = 'VERIFIED';
          }
        } else {
          reqDoc.status = ev.verificationStatus || 'PENDING';
          if (reqDoc.status !== 'EXPIRED' && reqDoc.status !== 'REJECTED') {
            unverifiedCount++;
          } else if (reqDoc.status === 'EXPIRED') {
            expiredCount++;
          }
        }
      }
    });

    // Finalize missing docs and gaps
    const documentChecklist = Array.from(requiredDocsMap.values());
    documentChecklist.forEach(doc => {
      if (doc.status === 'MISSING') {
        missingCount++;
        if (['HIGH', 'CRITICAL'].includes(doc.severity)) {
          criticalGaps.push({
            issue: 'Missing Critical Document',
            obligation: doc.obligationTitle,
            severity: doc.severity,
            docType: doc.documentType,
            type: 'MISSING_EVIDENCE'
          });
        }
      }
    });

    // 5. Calculate readiness score
    let score = 100;
    
    documentChecklist.forEach(doc => {
      if (doc.status === 'MISSING' || doc.status === 'EXPIRED') {
        if (doc.severity === 'CRITICAL') score -= 10;
        else if (doc.severity === 'HIGH') score -= 5;
        else score -= 2;
      } else if (doc.status === 'PENDING' || doc.status === 'UNDER_REVIEW') {
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

    // 6. Regulatory Updates
    const recentUpdates = await RegulatoryUpdate.find({ status: 'VERIFIED' })
      .sort({ effectiveDate: -1 })
      .limit(5); // In a real app we'd filter by business domain, but since it's a prototype we return recent verified ones

    // 7. Audit log
    await AuditLog.create({
      user: req.user.id,
      business: businessId,
      action: 'INSPECTION_READINESS_VIEWED',
      actorRole: req.user.role,
      entity: 'Inspection',
      metadata: { score, criticalGaps: criticalGaps.length }
    });

    res.json({
      success: true,
      data: {
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
        criticalGaps,
        overdueActions: actions.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED'),
        upcomingActions: actions.filter(a => a.dueDate && new Date(a.dueDate) >= new Date() && a.status !== 'COMPLETED').slice(0, 5),
        recentUpdates
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate inspection readiness report' });
  }
});

// POST /api/inspection/generate-pack
router.post('/generate-pack', auth, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'No business associated with user' });
    }

    await AuditLog.create({
      user: req.user.id,
      business: businessId,
      action: 'INSPECTION_PACK_GENERATED',
      actorRole: req.user.role,
      entity: 'Inspection'
    });

    res.json({ success: true, message: 'Inspection pack generated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate inspection pack log' });
  }
});

module.exports = router;
