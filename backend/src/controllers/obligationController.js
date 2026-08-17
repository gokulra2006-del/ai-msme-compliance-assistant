// backend/src/controllers/obligationController.js
const Obligation = require('../models/Obligation');
const Business = require('../models/Business');
const ComplianceRule = require('../models/ComplianceRule');
const { evaluateRules } = require('../engine/rulesEngine');

// GET /api/obligations — get all obligations with applicability for the user's business
exports.getObligations = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });

    // Fetch all active rules from DB. ComplianceRule tracks its lifecycle in
    // `status` (DRAFT|ACTIVE|INACTIVE|EXPIRED|ARCHIVED) — there is no `active`
    // boolean on the schema, so querying one matched nothing and this endpoint
    // returned an empty obligation list for every business.
    const allRules = await ComplianceRule.find({ status: 'ACTIVE' });

    if (!business) {
      // No business profile yet — return all rules as INSUFFICIENT_DATA
      return res.status(200).json({
        success: true,
        data: allRules.map(r => ({
          code: r.ruleCode,
          title: r.title,
          description: r.description,
          domain: r.complianceDomain,
          regulator: r.regulator,
          jurisdiction: r.jurisdictionLevel,
          cadence: r.complianceFrequency,
          severity: r.severity,
          penalty: r.penaltyDescription,
          imprisonmentFlag: r.imprisonmentRisk,
          licenceSuspensionFlag: r.licenseSuspensionRisk,
          requiredEvidenceTypes: r.requiredEvidence,
          status: 'INSUFFICIENT_DATA',
          applicability: 'INSUFFICIENT_DATA'
        }))
      });
    }

    // Run the deterministic rules engine
    const evaluated = evaluateRules(business.toObject(), allRules);

    res.status(200).json({ success: true, data: evaluated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/obligations/:id
exports.getObligation = async (req, res) => {
  try {
    const obligation = await Obligation.findById(req.params.id);
    if (!obligation) {
      return res.status(404).json({ success: false, error: 'Obligation not found' });
    }
    res.status(200).json({ success: true, data: obligation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/obligations/dashboard — returns summary stats
exports.getDashboard = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    // See getObligations — the lifecycle field is `status`, not `active`.
    const allRules = await ComplianceRule.find({ status: 'ACTIVE' });

    let applies = 0, doesNotApply = 0, insufficientData = 0;
    let critical = 0, high = 0, medium = 0, low = 0;
    let applicable = [];
    let allMissingFields = new Set();

    if (business) {
      const evaluated = evaluateRules(business.toObject(), allRules);
      for (const e of evaluated) {
        if (e.status === 'APPLIES') {
          applies++;
          applicable.push(e);
          if (e.severity === 'CRITICAL') critical++;
          if (e.severity === 'HIGH') high++;
          if (e.severity === 'MEDIUM') medium++;
          if (e.severity === 'LOW') low++;
        } else if (e.status === 'DOES_NOT_APPLY') {
          doesNotApply++;
        } else {
          insufficientData++;
          if (e.missingFields) {
            e.missingFields.forEach(f => allMissingFields.add(f));
          }
        }
      }
    } else {
      insufficientData = allRules.length;
    }

    const total = allRules.length;
    const readinessScore = total > 0 ? Math.round((applies / total) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalObligations: total,
        applies,
        doesNotApply,
        insufficientData,
        readinessScore,
        missingFields: Array.from(allMissingFields),
        riskBreakdown: { critical, high, medium, low },
        applicableObligations: applicable,
        businessName: business ? business.entityType : null,
        industry: business ? business.industry : null,
        state: business ? business.state : null,
        hasProfile: !!business
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
