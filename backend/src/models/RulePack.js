const mongoose = require('mongoose');

const RulePackSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  state: { type: String },
  district: { type: String },
  industry: { type: String },
  subIndustry: { type: String },
  entityType: { type: String },
  turnoverBand: { type: String },
  active: { type: Boolean, default: true },
  version: { type: String, default: '1.0' },
}, { timestamps: true });

module.exports = mongoose.model('RulePack', RulePackSchema);
