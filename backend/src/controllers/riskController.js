const { calculateRiskScore } = require('../engine/riskScoring');
const Business = require('../models/Business');
const RiskHistory = require('../models/RiskHistory');

exports.getRiskScore = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) {
      return res.status(403).json({ success: false, error: 'Business profile not found.' });
    }

    const riskData = await calculateRiskScore(business._id);

    // Save to history if the score has significantly changed or if it's been a while,
    // but for simplicity, we'll store a history record if the score is different from the latest one.
    const latestHistory = await RiskHistory.findOne({ business: business._id }).sort({ calculatedAt: -1 });
    
    if (!latestHistory || latestHistory.score !== riskData.score) {
      await RiskHistory.create({
        business: business._id,
        score: riskData.score,
        riskLevel: riskData.riskLevel,
        majorRiskDrivers: riskData.riskDrivers,
        calculatedAt: riskData.calculatedAt
      });
    }

    res.status(200).json({ success: true, data: riskData });
  } catch (err) {
    console.error('Error calculating risk score:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate risk score.' });
  }
};

exports.getRiskHistory = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) {
      return res.status(403).json({ success: false, error: 'Business profile not found.' });
    }

    const history = await RiskHistory.find({ business: business._id })
      .sort({ calculatedAt: -1 })
      .select('score riskLevel calculatedAt')
      .limit(10);
      
    res.status(200).json({ success: true, data: history });
  } catch (err) {
    console.error('Error fetching risk history:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch risk history.' });
  }
};
