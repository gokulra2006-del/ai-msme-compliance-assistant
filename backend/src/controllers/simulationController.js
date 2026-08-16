const Business = require('../models/Business');
const ComplianceRule = require('../models/ComplianceRule');
const SimulationHistory = require('../models/SimulationHistory');
const ComplianceAction = require('../models/ComplianceAction');
const AuditLog = require('../models/AuditLog');
const rulesEngine = require('../engine/rulesEngine');
const { calculateRiskScore, WEIGHTS } = require('../engine/riskScoring'); // for weights

exports.runSimulation = async (req, res) => {
  try {
    const { simulatedChanges } = req.body;
    let businessId = req.user.businessId;

    // Admin override or Accountant/Compliance Officer override
    if ((req.user.role === 'ADMIN' || req.user.role === 'ACCOUNTANT' || req.user.role === 'COMPLIANCE_OFFICER') && req.body.businessId) {
      businessId = req.body.businessId;
    }

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business ID is required' });
    }

    // 1. Fetch Current Profile
    const currentBusiness = await Business.findById(businessId).lean();
    if (!currentBusiness) {
      return res.status(404).json({ success: false, error: 'Business profile not found' });
    }

    // 2. Clone and Apply Changes (In-Memory)
    const simulatedBusiness = { ...currentBusiness, ...simulatedChanges };

    // 3. Fetch Active Rules
    const activeRules = await ComplianceRule.find({ status: 'ACTIVE' });

    // 4. Evaluate Both Profiles
    const beforeEval = rulesEngine.evaluateRules(currentBusiness, activeRules);
    const afterEval = rulesEngine.evaluateRules(simulatedBusiness, activeRules);

    // 5. Diff Analysis
    const newRules = [];
    const removedRules = [];
    const changedObligations = [];
    let riskDelta = 0;
    const preparationPlan = [];
    const evidenceImpact = { added: [], removed: [] };
    const calendarImpact = { addedEvents: [], removedEvents: [] };
    const riskDrivers = [];

    // Map existing obligations for easy comparison
    const beforeRulesMap = new Map(beforeEval.map(r => [r.ruleCode, r]));
    const afterRulesMap = new Map(afterEval.map(r => [r.ruleCode, r]));

    // Check newly applied or changed rules
    for (const after of afterEval) {
      const before = beforeRulesMap.get(after.ruleCode);
      const severityWeight = after.severity === 'CRITICAL' ? WEIGHTS.CRITICAL_OBLIGATION : WEIGHTS.HIGH_OBLIGATION;

      if (!before || before.status !== 'APPLIES') {
        if (after.status === 'APPLIES') {
          // Rule is NEWLY APPLICABLE
          newRules.push({
            ruleCode: after.ruleCode,
            title: after.obligationTitle,
            reason: after.explanation,
            severity: after.severity,
            source: after.regulatorySource,
            complianceFrequency: after.complianceFrequency,
            requiredEvidence: after.requiredEvidence || []
          });
          riskDelta += severityWeight;
          riskDrivers.push(`New ${after.severity} obligation: ${after.obligationTitle}`);
          
          if (after.requiredEvidence && after.requiredEvidence.length > 0) {
            evidenceImpact.added.push(...after.requiredEvidence.map(doc => ({ doc, rule: after.ruleCode })));
            preparationPlan.push(`Prepare new document: ${after.requiredEvidence.join(', ')} for ${after.obligationTitle}`);
          }
          if (after.complianceFrequency !== 'ON_DEMAND') {
            calendarImpact.addedEvents.push({ rule: after.ruleCode, title: after.obligationTitle, frequency: after.complianceFrequency });
          }
        }
      } else if (before.status === 'APPLIES' && after.status === 'APPLIES') {
        // Rule remains applicable, check for changes
        let changed = false;
        let changeDesc = '';

        if (before.complianceFrequency !== after.complianceFrequency) {
          changed = true;
          changeDesc += `Frequency changed from ${before.complianceFrequency} to ${after.complianceFrequency}. `;
          calendarImpact.removedEvents.push({ rule: before.ruleCode, title: before.obligationTitle, frequency: before.complianceFrequency });
          if (after.complianceFrequency !== 'ON_DEMAND') {
            calendarImpact.addedEvents.push({ rule: after.ruleCode, title: after.obligationTitle, frequency: after.complianceFrequency });
          }
        }
        
        const beforeEv = before.requiredEvidence || [];
        const afterEv = after.requiredEvidence || [];
        const newEvDocs = afterEv.filter(e => !beforeEv.includes(e));
        const removedEvDocs = beforeEv.filter(e => !afterEv.includes(e));

        if (newEvDocs.length > 0 || removedEvDocs.length > 0) {
          changed = true;
          changeDesc += `Required evidence changed. `;
          if (newEvDocs.length > 0) {
            evidenceImpact.added.push(...newEvDocs.map(doc => ({ doc, rule: after.ruleCode })));
            preparationPlan.push(`Prepare new documents for ${after.obligationTitle}: ${newEvDocs.join(', ')}`);
          }
          if (removedEvDocs.length > 0) {
            evidenceImpact.removed.push(...removedEvDocs.map(doc => ({ doc, rule: before.ruleCode })));
          }
        }

        if (changed) {
          changedObligations.push({
            ruleCode: after.ruleCode,
            title: after.obligationTitle,
            changeDescription: changeDesc
          });
        }
      }
    }

    // Check removed rules
    for (const before of beforeEval) {
      if (before.status === 'APPLIES') {
        const after = afterRulesMap.get(before.ruleCode);
        if (!after || after.status !== 'APPLIES') {
          // Rule is NO LONGER APPLICABLE
          removedRules.push({
            ruleCode: before.ruleCode,
            title: before.obligationTitle,
            reason: after ? `No longer applies because: ${after.explanation}` : 'No longer applies.',
            severity: before.severity
          });
          const severityWeight = before.severity === 'CRITICAL' ? WEIGHTS.CRITICAL_OBLIGATION : WEIGHTS.HIGH_OBLIGATION;
          riskDelta -= severityWeight;
          riskDrivers.push(`Removed ${before.severity} obligation: ${before.obligationTitle}`);

          if (before.requiredEvidence && before.requiredEvidence.length > 0) {
            evidenceImpact.removed.push(...before.requiredEvidence.map(doc => ({ doc, rule: before.ruleCode })));
          }
          if (before.complianceFrequency !== 'ON_DEMAND') {
            calendarImpact.removedEvents.push({ rule: before.ruleCode, title: before.obligationTitle, frequency: before.complianceFrequency });
          }
        }
      }
    }

    if (preparationPlan.length === 0) {
      preparationPlan.push("No immediate preparation steps required based on this simulation.");
    }

    // Knowledge Graph Summary
    const graphImpact = {
      nodesAdded: newRules.length + evidenceImpact.added.length + calendarImpact.addedEvents.length,
      nodesRemoved: removedRules.length + evidenceImpact.removed.length + calendarImpact.removedEvents.length
    };

    // 6. Save Simulation History
    const simulation = await SimulationHistory.create({
      business: currentBusiness._id,
      createdBy: req.user._id,
      simulatedChanges,
      currentProfileSnapshot: currentBusiness,
      simulatedProfileSnapshot: simulatedBusiness,
      results: {
        newRules,
        removedRules,
        changedObligations,
        riskDelta,
        riskDrivers,
        preparationPlan,
        evidenceImpact,
        calendarImpact,
        graphImpact
      },
      status: 'SIMULATED'
    });

    res.status(200).json({ success: true, data: simulation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSimulationHistory = async (req, res) => {
  try {
    let businessId = req.user.businessId;
    if ((req.user.role === 'ADMIN' || req.user.role === 'ACCOUNTANT' || req.user.role === 'COMPLIANCE_OFFICER') && req.query.businessId) {
      businessId = req.query.businessId;
    }

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business ID is required' });
    }

    const history = await SimulationHistory.find({ business: businessId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.status(200).json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.applySimulation = async (req, res) => {
  try {
    const { id } = req.params;
    const simulation = await SimulationHistory.findById(id);

    if (!simulation) return res.status(404).json({ success: false, error: 'Simulation not found' });
    if (simulation.status === 'APPLIED') return res.status(400).json({ success: false, error: 'Already applied' });
    if (simulation.status === 'DISCARDED') return res.status(400).json({ success: false, error: 'Simulation was discarded' });

    // Permission check
    if (req.user.role === 'USER' && simulation.business.toString() !== req.user.businessId.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Update real business profile
    const business = await Business.findById(simulation.business);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    for (const [key, value] of Object.entries(simulation.simulatedChanges)) {
      business[key] = value;
    }
    await business.save();

    // The businessController.js already has an evaluate-eligibility method, but we can do a lightweight update here
    // or just let the client trigger a recalculation.
    // For safety and integration, we'll mark this applied.
    simulation.status = 'APPLIED';
    simulation.appliedAt = new Date();
    await simulation.save();

    await AuditLog.create({
      user: req.user._id,
      actorRole: req.user.role,
      action: 'WHAT_IF_SIMULATION_APPLIED',
      entity: 'Business',
      entityId: business._id,
      metadata: { simulatedChanges: simulation.simulatedChanges, simulationId: simulation._id }
    });

    res.status(200).json({ success: true, message: 'Changes applied successfully', data: business });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.discardSimulation = async (req, res) => {
  try {
    const { id } = req.params;
    const simulation = await SimulationHistory.findById(id);
    if (!simulation) return res.status(404).json({ success: false, error: 'Simulation not found' });
    
    simulation.status = 'DISCARDED';
    await simulation.save();
    
    res.status(200).json({ success: true, message: 'Simulation discarded' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
