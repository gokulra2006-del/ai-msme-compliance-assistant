const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');
const EvidenceIntelligence = require('../services/evidenceIntelligenceService');
const inspectionService = require('../services/inspectionService');

// The shared `protect` middleware is used here rather than a local JWT check, so
// this route validates tokens with the same secret and loads the same user record
// as every other authenticated route.
const auth = protect;

// The token only carries a user id, so the business is resolved from the user
// record. Everything below is scoped to it.
async function resolveBusinessId(req) {
  const business = await EvidenceIntelligence.resolveBusinessForUser(req.user);
  return business ? business._id : null;
}

// GET /api/inspection/readiness
router.get('/readiness', auth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'No business associated with user' });
    }

    const data = await inspectionService.getInspectionReadiness(businessId);

    await AuditLog.create({
      user: req.user.id,
      business: businessId,
      action: 'INSPECTION_READINESS_VIEWED',
      actorRole: req.user.role,
      entity: 'Inspection',
      metadata: { score: data.readinessScore, criticalGaps: data.criticalGaps.length }
    });

    res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate inspection readiness report' });
  }
});

// POST /api/inspection/generate-pack
router.post('/generate-pack', auth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
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
