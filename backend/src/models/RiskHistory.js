const mongoose = require('mongoose');

const RiskHistorySchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  score: { type: Number, required: true },
  riskLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'], required: true },
  majorRiskDrivers: [{ type: String }],
  calculatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RiskHistory', RiskHistorySchema);
