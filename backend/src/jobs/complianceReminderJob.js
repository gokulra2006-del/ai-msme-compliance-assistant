const ComplianceAction = require('../models/ComplianceAction');
const Business = require('../models/Business');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const ComplianceRule = require('../models/ComplianceRule');
const reminderService = require('../services/reminderService');

// ─── Configurable Thresholds (days before deadline) ────────────────────────
const THRESHOLDS = [
  { days: 30, type: 'EARLY_REMINDER',  severity: 'LOW',      escalationLevel: 0, title: 'Early Compliance Reminder' },
  { days: 7,  type: 'DUE_SOON',        severity: 'MEDIUM',   escalationLevel: 0, title: 'Compliance Due Soon' },
  { days: 1,  type: 'DUE_TOMORROW',    severity: 'HIGH',     escalationLevel: 1, title: 'Compliance Due Tomorrow' },
  { days: 0,  type: 'DUE_TODAY',       severity: 'HIGH',     escalationLevel: 1, title: 'Compliance Due Today' },
];

// Overdue escalation stages
const OVERDUE_STAGES = [
  { daysOverdue: 0,  escalationLevel: 1, title: 'Compliance Overdue' },
  { daysOverdue: 1,  escalationLevel: 2, title: 'Overdue Escalation — Compliance Officer' },
  { daysOverdue: 7,  escalationLevel: 3, title: 'Critical Overdue Escalation — Owner' },
];

const EVIDENCE_EXPIRY_DAYS = 30;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Truncate a date to midnight for safe day-boundary comparisons */
function toMidnight(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Get the diff in calendar days between two dates (positive = future, negative = past) */
function diffDays(fromDate, toDate) {
  const from = toMidnight(fromDate);
  const to = toMidnight(toDate);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/** Determine the domain-appropriate role for escalation */
function getResponsibleRole(category) {
  const financialDomains = ['Tax & GST', 'Tax', 'GST', 'Financial'];
  if (financialDomains.some(d => (category || '').toLowerCase().includes(d.toLowerCase()))) {
    return 'ACCOUNTANT';
  }
  return 'COMPLIANCE_OFFICER';
}

/** Find users to notify based on escalation level, business, and action category */
async function getRecipients(business, action, escalationLevel) {
  const recipients = new Map(); // userId -> role (dedup by user)

  // Level 0: Assigned user or business owner
  if (escalationLevel >= 0) {
    if (action.assignedTo) {
      const assignedUser = await User.findById(action.assignedTo).lean();
      if (assignedUser) recipients.set(assignedUser._id.toString(), assignedUser.role || 'OWNER');
    }
    // Always include business owner as baseline
    if (business.user) {
      const owner = await User.findById(business.user).lean();
      if (owner) recipients.set(owner._id.toString(), owner.role || 'OWNER');
    }
  }

  // Level 1: + responsible role users for this business
  if (escalationLevel >= 1) {
    const responsibleRole = getResponsibleRole(action.category);
    const roleUsers = await User.find({ business: business._id, role: responsibleRole }).lean();
    roleUsers.forEach(u => recipients.set(u._id.toString(), u.role));
  }

  // Level 2: + COMPLIANCE_OFFICER
  if (escalationLevel >= 2) {
    const officers = await User.find({ business: business._id, role: 'COMPLIANCE_OFFICER' }).lean();
    officers.forEach(u => recipients.set(u._id.toString(), u.role));
  }

  // Level 3: + OWNER (already included at level 0, but this ensures it)
  if (escalationLevel >= 3) {
    if (business.user) {
      const owner = await User.findById(business.user).lean();
      if (owner) recipients.set(owner._id.toString(), 'OWNER');
    }
  }

  return Array.from(recipients.entries()).map(([id, role]) => ({
    userId: id,
    role
  }));
}

// ─── Main Job ────────────────────────────────────────────────────────────────

async function runReminderJob() {
  console.log('[ReminderJob] Starting compliance reminder scan...');
  const now = new Date();
  let generatedCount = 0;
  let errorCount = 0;

  try {
    // ── PHASE 1: Compliance Action Reminders ──────────────────────────────
    const actions = await ComplianceAction.find({
      applicability: { $ne: 'DOES_NOT_APPLY' },
      completionDate: null,
      dueDate: { $ne: null }
    }).populate('business');

    for (const action of actions) {
      try {
        if (!action.business || !action.business.user) continue;

        const daysUntilDue = diffDays(now, action.dueDate);
        const isOverdue = daysUntilDue < 0;
        const daysOverdue = Math.abs(daysUntilDue);

        // Check if this is a critical/high severity action (for aggressive escalation)
        const isCriticalOrHigh = ['CRITICAL', 'HIGH'].includes(action.priority);

        if (isOverdue) {
          // ── Overdue Escalation ────────────────────────────────────────
          let effectiveStage = OVERDUE_STAGES[0]; // default: just overdue
          for (const stage of OVERDUE_STAGES) {
            if (daysOverdue >= stage.daysOverdue) {
              effectiveStage = stage;
            }
          }

          // Critical/high severity items escalate immediately to level 3
          const escalationLevel = isCriticalOrHigh 
            ? Math.max(effectiveStage.escalationLevel, 2)
            : effectiveStage.escalationLevel;

          const recipients = await getRecipients(action.business, action, escalationLevel);

          for (const r of recipients) {
            try {
              const dispatched = await reminderService.dispatchReminder({
                complianceAction: action._id,
                business: action.business._id,
                recipient: r.userId,
                recipientRole: r.role,
                reminderType: escalationLevel >= 2 ? 'ESCALATION' : 'OVERDUE',
                severity: 'CRITICAL',
                escalationLevel,
                title: effectiveStage.title,
                message: `"${action.title}" is ${daysOverdue} day(s) overdue. ${action.priority === 'CRITICAL' ? 'This is a critical compliance obligation.' : ''}`.trim(),
                channel: 'IN_APP',
                scheduledFor: now,
                metadata: { 
                  daysOverdue, 
                  priority: action.priority,
                  category: action.category,
                  ruleCode: action.ruleCode
                }
              });
              if (dispatched) generatedCount++;
            } catch (err) {
              // Duplicate key = already sent, which is fine (idempotent)
              if (err.code !== 11000) errorCount++;
            }
          }

        } else {
          // ── Upcoming Reminders ────────────────────────────────────────
          for (const threshold of THRESHOLDS) {
            if (daysUntilDue <= threshold.days) {
              // For DUE_TOMORROW and DUE_TODAY, only fire on the exact day
              if ((threshold.type === 'DUE_TOMORROW' && daysUntilDue !== 1) ||
                  (threshold.type === 'DUE_TODAY' && daysUntilDue !== 0)) {
                continue;
              }

              const recipients = await getRecipients(action.business, action, threshold.escalationLevel);

              for (const r of recipients) {
                try {
                  const dispatched = await reminderService.dispatchReminder({
                    complianceAction: action._id,
                    business: action.business._id,
                    recipient: r.userId,
                    recipientRole: r.role,
                    reminderType: threshold.type,
                    severity: threshold.severity,
                    escalationLevel: threshold.escalationLevel,
                    title: threshold.title,
                    message: daysUntilDue === 0 
                      ? `"${action.title}" is due today!`
                      : `"${action.title}" is due in ${daysUntilDue} day(s).`,
                    channel: 'IN_APP',
                    scheduledFor: now,
                    metadata: { 
                      daysUntilDue, 
                      priority: action.priority,
                      category: action.category,
                      ruleCode: action.ruleCode
                    }
                  });
                  if (dispatched) generatedCount++;
                } catch (err) {
                  if (err.code !== 11000) errorCount++;
                }
              }
            }
          }
        }
      } catch (actionErr) {
        console.error(`[ReminderJob] Error processing action ${action._id}:`, actionErr.message);
        errorCount++;
        // Continue processing other actions
      }
    }

    // ── PHASE 2: Evidence Expiry Alerts ──────────────────────────────────
    const expiryThreshold = new Date(now.getTime() + EVIDENCE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    const expiringEvidence = await Evidence.find({
      expiryDate: { $ne: null, $lte: expiryThreshold, $gt: now }
    }).populate('business');

    for (const ev of expiringEvidence) {
      try {
        if (!ev.business || !ev.business.user) continue;

        const daysUntilExpiry = diffDays(now, ev.expiryDate);

        // Only generate at key thresholds: 30, 7, 1, 0 days
        if (![30, 7, 1, 0].some(d => daysUntilExpiry === d || (d === 30 && daysUntilExpiry <= 30 && daysUntilExpiry > 7))) {
          // Allow the first alert at any point within 30 days, then specific days
          if (daysUntilExpiry > 7) {
            // This is the "within 30 days" window — generate once
          } else {
            continue;
          }
        }

        const severity = daysUntilExpiry <= 1 ? 'HIGH' : daysUntilExpiry <= 7 ? 'MEDIUM' : 'LOW';

        const owner = await User.findById(ev.business.user).lean();
        if (!owner) continue;

        try {
          const dispatched = await reminderService.dispatchReminder({
            complianceAction: null, // No action linked
            business: ev.business._id,
            recipient: owner._id,
            recipientRole: owner.role || 'OWNER',
            reminderType: 'EVIDENCE_EXPIRING',
            severity,
            escalationLevel: 0,
            title: 'Evidence Document Expiring',
            message: `Document "${ev.documentName}" (${ev.documentType}) expires in ${daysUntilExpiry} day(s).`,
            channel: 'IN_APP',
            scheduledFor: now,
            metadata: {
              evidenceId: ev._id,
              documentType: ev.documentType,
              obligationCode: ev.obligationCode,
              expiryDate: ev.expiryDate
            }
          });
          if (dispatched) generatedCount++;
        } catch (err) {
          if (err.code !== 11000) errorCount++;
        }
      } catch (evErr) {
        console.error(`[ReminderJob] Error processing evidence ${ev._id}:`, evErr.message);
        errorCount++;
      }
    }

    console.log(`[ReminderJob] Scan complete. Generated ${generatedCount} new reminders. Errors: ${errorCount}.`);
  } catch (err) {
    console.error('[ReminderJob] Fatal error during scan:', err);
  }
}

module.exports = runReminderJob;
