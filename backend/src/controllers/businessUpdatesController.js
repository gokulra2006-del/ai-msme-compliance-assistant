const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const Business = require('../models/Business');
const ComplianceAction = require('../models/ComplianceAction');

exports.getBusinessImpacts = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user._id });
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business profile not found' });
    }

    // Only fetch APPROVED and EFFECTIVE updates that have analyzed impacts
    const updates = await RegulatoryUpdate.find({
      status: { $in: ['APPROVED', 'EFFECTIVE'] },
      'impactAnalysisResult.affectedBusinesses.businessId': business._id
    }).populate('source').sort({ effectiveDate: -1, createdAt: -1 });

    const businessImpacts = [];

    for (const update of updates) {
      // Find the specific impact for THIS business only
      const bizImpact = update.impactAnalysisResult.affectedBusinesses.find(
        b => b.businessId.toString() === business._id.toString()
      );

      if (bizImpact) {
        // Find if any compliance actions were generated from this update
        const actions = await ComplianceAction.find({
          business: business._id,
          sourceUpdate: update._id
        });

        businessImpacts.push({
          updateId: update._id,
          title: update.title,
          description: update.description,
          source: update.source,
          effectiveDate: update.effectiveDate,
          status: update.status,
          impactDetails: {
            affectedRule: bizImpact.affectedRule,
            ruleName: bizImpact.ruleName,
            beforeStatus: bizImpact.beforeStatus,
            afterStatus: bizImpact.afterStatus,
            impactReason: bizImpact.impactReason,
            actionList: bizImpact.actionList,
            deadlineImpact: bizImpact.deadlineImpact,
            docImpact: bizImpact.docImpact,
            riskDelta: bizImpact.riskDelta
          },
          generatedActions: actions.map(a => ({
            id: a._id,
            title: a.title,
            status: a.status,
            dueDate: a.dueDate
          }))
        });
      }
    }

    res.status(200).json({ success: true, count: businessImpacts.length, data: businessImpacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
