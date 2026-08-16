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

    // ── PHASE 1B: Compliance Action Workflow States ─────────────────────
    const workflowActions = await ComplianceAction.find({
      status: { $in: ['SUBMITTED_FOR_REVIEW', 'REJECTED'] }
    }).populate('business');

    for (const action of workflowActions) {
      try {
        if (!action.business || !action.business.user) continue;

        if (action.status === 'SUBMITTED_FOR_REVIEW') {
          // Notify COMPLIANCE_OFFICER (Level 2) that approval is pending
          const recipients = await getRecipients(action.business, action, 2);
          for (const r of recipients) {
            // Only notify reviewers, not the assignee who submitted it
            if (r.userId === (action.assignedTo && action.assignedTo.toString())) continue;
            
            try {
              const dispatched = await reminderService.dispatchReminder({
                complianceAction: action._id,
                business: action.business._id,
                recipient: r.userId,
                recipientRole: r.role,
                reminderType: 'PENDING_APPROVAL',
                severity: 'MEDIUM',
                escalationLevel: 2,
                title: 'Action Pending Approval',
                message: `"${action.title}" was submitted for review and is pending your approval.`,
                channel: 'IN_APP',
                scheduledFor: now,
                metadata: { priority: action.priority, category: action.category, ruleCode: action.ruleCode }
              });
              if (dispatched) generatedCount++;
            } catch (err) {
              if (err.code !== 11000) errorCount++;
            }
          }
        } else if (action.status === 'REJECTED') {
          // Notify assignee (Level 0)
          const recipients = await getRecipients(action.business, action, 0);
          for (const r of recipients) {
            try {
              const dispatched = await reminderService.dispatchReminder({
                complianceAction: action._id,
                business: action.business._id,
                recipient: r.userId,
                recipientRole: r.role,
                reminderType: 'REJECTED_EVIDENCE', // Reusing this for rejected action
                severity: 'HIGH',
                escalationLevel: 0,
                title: 'Action Rejected',
                message: `Your submitted action "${action.title}" was rejected. Please review and correct it.`,
                channel: 'IN_APP',
                scheduledFor: now,
                metadata: { priority: action.priority, category: action.category, ruleCode: action.ruleCode, rejectionReason: action.rejectionReason }
              });
              if (dispatched) generatedCount++;
            } catch (err) {
              if (err.code !== 11000) errorCount++;
            }
          }
        }
      } catch (workflowErr) {
        console.error(`[ReminderJob] Error processing workflow action ${action._id}:`, workflowErr.message);
        errorCount++;
      }
    }

    // ── PHASE 2: Evidence Expiry Alerts ──────────────────────────────────
    // Uses the existing reminder engine — no separate notification system is
    // introduced. Only the current, non-archived version of a document can
    // trigger an expiry reminder, so a replaced or archived file never generates
    // a reminder for a document that is no longer in use. Documents with no
    // expiry date on record are simply not in scope; no expiry is assumed.
    const expiryThreshold = new Date(now.getTime() + EVIDENCE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Include both future expiring and already expired (up to 30 days ago to prevent endless spam)
    const expiredThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expiringEvidence = await Evidence.find({
      expiryDate: { $ne: null, $lte: expiryThreshold, $gte: expiredThreshold },
      isLatestVersion: { $ne: false },
      archived: { $ne: true },
      verificationStatus: { $nin: ['ARCHIVED', 'REJECTED'] }
    }).populate('business');

    for (const ev of expiringEvidence) {
      try {
        if (!ev.business || !ev.business.user) continue;

        const daysUntilExpiry = diffDays(now, ev.expiryDate);
        const isExpired = daysUntilExpiry < 0;

        // Only generate at key thresholds: 30, 7, 1, 0, and then every 7 days when expired
        if (!isExpired) {
          if (![30, 7, 1, 0].some(d => daysUntilExpiry === d || (d === 30 && daysUntilExpiry <= 30 && daysUntilExpiry > 7))) {
            if (daysUntilExpiry > 7) {
              // This is the "within 30 days" window — generate once
            } else {
              continue;
            }
          }
        } else {
          // If expired, only remind if it's a multiple of 7 days
          if (Math.abs(daysUntilExpiry) % 7 !== 0 && Math.abs(daysUntilExpiry) !== 1) continue;
        }

        const severity = isExpired ? 'CRITICAL' : daysUntilExpiry <= 1 ? 'HIGH' : daysUntilExpiry <= 7 ? 'MEDIUM' : 'LOW';
        const reminderType = isExpired ? 'EXPIRED_EVIDENCE' : 'EVIDENCE_EXPIRING';
        
        const owner = await User.findById(ev.business.user).lean();
        if (!owner) continue;

        try {
          const dispatched = await reminderService.dispatchReminder({
            complianceAction: null, // No action linked
            business: ev.business._id,
            recipient: owner._id,
            recipientRole: owner.role || 'OWNER',
            reminderType,
            severity,
            escalationLevel: isExpired ? 1 : 0,
            title: isExpired ? 'Evidence Document Expired' : 'Evidence Document Expiring',
            message: isExpired 
              ? `Document "${ev.documentName}" (${ev.documentType}) expired ${Math.abs(daysUntilExpiry)} day(s) ago.`
              : `Document "${ev.documentName}" (${ev.documentType}) expires in ${daysUntilExpiry} day(s).`,
            channel: 'IN_APP',
            scheduledFor: now,
            metadata: { evidenceId: ev._id, documentType: ev.documentType, obligationCode: ev.obligationCode, expiryDate: ev.expiryDate }
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

    // ── PHASE 3: Evidence Workflow Reminders ──────────────────────────────
    // Superseded and archived documents are excluded — a document that has been
    // replaced no longer needs a review or correction reminder.
    const workflowEvidence = await Evidence.find({
      verificationStatus: { $in: ['UNDER_REVIEW', 'REJECTED'] },
      isLatestVersion: { $ne: false },
      archived: { $ne: true }
    }).populate('business');

    for (const ev of workflowEvidence) {
      try {
        if (!ev.business || !ev.business.user) continue;
        const owner = await User.findById(ev.business.user).lean();
        if (!owner) continue;

        if (ev.verificationStatus === 'UNDER_REVIEW') {
          // PENDING_REVIEW logic: If under review for more than 2 days, escalate
          const daysInReview = diffDays(ev.updatedAt || ev.createdAt, now);
          if (daysInReview >= 2) {
            // Find COMPLIANCE_OFFICERs to notify
            const officers = await User.find({ business: ev.business._id, role: 'COMPLIANCE_OFFICER' }).lean();
            const recipients = officers.length > 0 ? officers : [owner];
            
            for (const r of recipients) {
              try {
                const dispatched = await reminderService.dispatchReminder({
                  complianceAction: null,
                  business: ev.business._id,
                  recipient: r._id,
                  recipientRole: r.role || 'OWNER',
                  reminderType: 'PENDING_REVIEW',
                  severity: 'MEDIUM',
                  escalationLevel: 2,
                  title: 'Evidence Pending Review',
                  message: `Document "${ev.documentName}" has been waiting for review for ${daysInReview} days.`,
                  channel: 'IN_APP',
                  scheduledFor: now,
                  metadata: { evidenceId: ev._id, documentType: ev.documentType, obligationCode: ev.obligationCode }
                });
                if (dispatched) generatedCount++;
              } catch (err) {
                if (err.code !== 11000) errorCount++;
              }
            }
          }
        } else if (ev.verificationStatus === 'REJECTED') {
          // Notify assignee (Accountant)
          // Evidence doesn't have `assignedTo`, so notify Accountant or Owner
          const accountants = await User.find({ business: ev.business._id, role: 'ACCOUNTANT' }).lean();
          const recipients = accountants.length > 0 ? accountants : [owner];
          
          for (const r of recipients) {
            try {
              const dispatched = await reminderService.dispatchReminder({
                complianceAction: null,
                business: ev.business._id,
                recipient: r._id,
                recipientRole: r.role || 'OWNER',
                reminderType: 'REJECTED_EVIDENCE',
                severity: 'HIGH',
                escalationLevel: 0,
                title: 'Evidence Rejected',
                message: `Document "${ev.documentName}" was rejected and requires correction.`,
                channel: 'IN_APP',
                scheduledFor: now,
                metadata: { evidenceId: ev._id, documentType: ev.documentType, obligationCode: ev.obligationCode }
              });
              if (dispatched) generatedCount++;
            } catch (err) {
              if (err.code !== 11000) errorCount++;
            }
          }
        }
      } catch (evErr) {
        console.error(`[ReminderJob] Error processing workflow evidence ${ev._id}:`, evErr.message);
        errorCount++;
      }
    }

    console.log(`[ReminderJob] Scan complete. Generated ${generatedCount} new reminders. Errors: ${errorCount}.`);
  } catch (err) {
    console.error('[ReminderJob] Fatal error during scan:', err);
  }
}

module.exports = runReminderJob;
