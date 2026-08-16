const mongoose = require('mongoose');

const ComplianceReminderSchema = new mongoose.Schema({
  complianceAction: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceAction', index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientRole: { type: String },
  
  reminderType: { 
    type: String, 
    enum: [
      'EARLY_REMINDER',   // 30 days before
      'DUE_SOON',         // 7 days before
      'DUE_TOMORROW',     // 1 day before
      'DUE_TODAY',        // Day of deadline
      'OVERDUE',          // Past deadline
      'ESCALATION',       // Role-based escalation
      'EVIDENCE_EXPIRING',// Evidence document nearing expiry
      'EXPIRED_EVIDENCE', // Evidence document expired
      'PENDING_REVIEW',   // Evidence/action waiting review too long
      'REJECTED_EVIDENCE',// Evidence rejected
      'PENDING_APPROVAL', // Action submitted for review
      'SYSTEM'            // System-generated
    ], 
    required: true 
  },
  
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },

  escalationLevel: { type: Number, default: 0 }, // 0=initial, 1=role, 2=compliance_officer, 3=owner
  
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  status: { 
    type: String, 
    enum: ['PENDING', 'SENT', 'FAILED', 'READ'], 
    default: 'PENDING' 
  },
  
  channel: { 
    type: String, 
    enum: ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'], 
    default: 'IN_APP' 
  },
  
  metadata: { type: mongoose.Schema.Types.Mixed },
  
  scheduledFor: { type: Date, default: Date.now },
  sentAt: { type: Date },
  readAt: { type: Date },
  
}, { timestamps: true });

// Prevent duplicate reminders for the same action + type + recipient + escalation level
// This is the core idempotency key:
// One EARLY_REMINDER per action per recipient at escalation level 0
// One DUE_SOON per action per recipient at escalation level 0
// One ESCALATION per action per recipient at escalation level 2
// etc.
ComplianceReminderSchema.index(
  { complianceAction: 1, reminderType: 1, recipient: 1, escalationLevel: 1 }, 
  { unique: true, partialFilterExpression: { complianceAction: { $exists: true } } }
);

// For evidence-expiring reminders (no complianceAction), use metadata.evidenceId
ComplianceReminderSchema.index({ business: 1, reminderType: 1, 'metadata.evidenceId': 1, recipient: 1 }, { 
  unique: true, 
  partialFilterExpression: { reminderType: 'EVIDENCE_EXPIRING' } 
});

// For efficient notification queries
ComplianceReminderSchema.index({ recipient: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ComplianceReminder', ComplianceReminderSchema);
