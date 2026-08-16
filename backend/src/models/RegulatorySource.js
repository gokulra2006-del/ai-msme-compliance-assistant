const mongoose = require('mongoose');

const RegulatorySourceSchema = new mongoose.Schema({
  sourceName: { type: String, required: true },
  actName: { type: String },
  regulationName: { type: String },
  sectionNumber: { type: String },
  officialUrl: { type: String },
  publicationDate: { type: Date },
  effectiveDate: { type: Date },
  lastVerifiedDate: { type: Date },
  verificationNotes: { type: String },
  verificationStatus: { 
    type: String, 
    enum: ['VERIFIED', 'PENDING_REVIEW', 'OUTDATED', 'REJECTED'],
    default: 'PENDING_REVIEW'
  },
  regulator: { type: String },
  jurisdiction: { 
    type: String, 
    enum: ['CENTRAL', 'STATE', 'DISTRICT', 'MUNICIPAL']
  },
  state: { type: String },
  industry: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('RegulatorySource', RegulatorySourceSchema);
