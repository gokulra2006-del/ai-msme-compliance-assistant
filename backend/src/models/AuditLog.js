// backend/src/models/AuditLog.js
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional, could be system action
  actorRole: { type: String },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  action: { type: String, required: true }, // e.g. LOGIN, EVIDENCE_UPLOADED
  entity: { type: String }, // e.g. Evidence
  entityId: { type: mongoose.Schema.Types.ObjectId },
  previousValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed }, // flexible payload for extra details
  ip: { type: String },
}, { timestamps: true });

AuditLogSchema.index({ business: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ user: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
