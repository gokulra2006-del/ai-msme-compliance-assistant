const { buildContext } = require('../services/contextBuilder');
const { generateComplianceAnswer } = require('../services/aiProvider');
const { logAudit } = require('../utils/auditLogger');
const Business = require('../models/Business');

exports.chat = async (req, res) => {
  try {
    const { question, language, simulationId } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    const business = await Business.findOne({ user: req.user.id }).lean();
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business profile not found' });
    }
    const context = await buildContext(business._id, question, simulationId);
    if (!context) {
      return res.status(404).json({ success: false, error: 'Business profile not found' });
    }

    // Call AI Provider
    const aiResponse = await generateComplianceAnswer(context, question, language);

    // Audit Log the interaction
    await logAudit({
      req,
      action: 'AI_ASSISTANT_QUERY',
      businessId: business._id,
      metadata: { question }
    });

    res.json({
      success: true,
      data: aiResponse
    });
  } catch (err) {
    console.error('Assistant Chat Error:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'The compliance assistant is temporarily unavailable.' 
    });
  }
};
