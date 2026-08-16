const mongoose = require('mongoose');

const SimulationHistorySchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  simulatedChanges: { type: mongoose.Schema.Types.Mixed, required: true },
  
  currentProfileSnapshot: { type: mongoose.Schema.Types.Mixed },
  simulatedProfileSnapshot: { type: mongoose.Schema.Types.Mixed },
  
  results: {
    newRules: [{ type: mongoose.Schema.Types.Mixed }],
    removedRules: [{ type: mongoose.Schema.Types.Mixed }],
    changedObligations: [{ type: mongoose.Schema.Types.Mixed }],
    riskDelta: { type: Number, default: 0 },
    preparationPlan: [{ type: String }]
  },
  
  status: {
    type: String,
    enum: ['SIMULATED', 'APPLIED', 'DISCARDED'],
    default: 'SIMULATED'
  },
  
  createdAt: { type: Date, default: Date.now },
  appliedAt: { type: Date }
});

module.exports = mongoose.model('SimulationHistory', SimulationHistorySchema);
