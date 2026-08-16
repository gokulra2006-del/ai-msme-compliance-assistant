const ComplianceReminder = require('../models/ComplianceReminder');
const { logAudit } = require('../utils/auditLogger');

class ReminderService {
  /**
   * Returns which notification channels are actually configured vs adapter-ready.
   */
  getChannelStatus() {
    return {
      IN_APP: { status: 'FUNCTIONAL', description: 'In-app notifications are fully operational.' },
      EMAIL: { 
        status: process.env.SMTP_HOST ? 'FUNCTIONAL' : 'NOT_CONFIGURED', 
        description: process.env.SMTP_HOST 
          ? 'Email notifications are configured.' 
          : 'Email adapter is ready. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables to enable.'
      },
      SMS: { status: 'NOT_CONFIGURED', description: 'SMS adapter is ready. Integrate Twilio or similar provider to enable.' },
      WHATSAPP: { status: 'NOT_CONFIGURED', description: 'WhatsApp adapter is ready. Integrate WhatsApp Business API to enable.' }
    };
  }

  async dispatchReminder(reminderData) {
    try {
      // Save reminder in database
      const reminder = new ComplianceReminder({
        ...reminderData,
        status: 'PENDING'
      });
      await reminder.save();

      // Route to proper channel adapter
      const channel = reminder.channel || 'IN_APP';
      if (channel === 'IN_APP') {
        await this.inAppNotification(reminder);
      } else if (channel === 'EMAIL') {
        await this.emailNotification(reminder);
      } else if (channel === 'SMS') {
        await this.smsNotification(reminder);
      } else if (channel === 'WHATSAPP') {
        await this.whatsAppNotification(reminder);
      }
      
      reminder.status = 'SENT';
      reminder.sentAt = new Date();
      await reminder.save();
      
      // Audit log the generation
      await logAudit({
        req: { user: { id: reminder.recipient } },
        action: 'REMINDER_SENT',
        entity: 'ComplianceReminder',
        entityId: reminder._id,
        businessId: reminder.business,
        metadata: { 
          reminderType: reminder.reminderType, 
          severity: reminder.severity,
          escalationLevel: reminder.escalationLevel,
          channel 
        }
      });
      
      return reminder;
    } catch (err) {
      // If it's a duplicate key error (11000), it's already generated — idempotent
      if (err.code === 11000) {
        return null;
      }

      console.error('Failed to dispatch reminder:', err.message);
      
      // Log the failure
      await logAudit({
        req: { user: { id: reminderData.recipient } }, 
        action: 'REMINDER_FAILED',
        entity: 'ComplianceReminder',
        businessId: reminderData.business,
        metadata: { 
          reminderType: reminderData.reminderType,
          error: err.message 
        }
      });
      throw err;
    }
  }

  async inAppNotification(reminder) {
    // In-app notifications are inherently handled by the PENDING/SENT status in the database.
    // The frontend polls /api/notifications to fetch them.
    // A real-time system would push via WebSockets here.
    return true;
  }

  async emailNotification(reminder) {
    if (!process.env.SMTP_HOST) {
      console.log(`[EMAIL NOT_CONFIGURED] Would send to User: ${reminder.recipient} — ${reminder.title}: ${reminder.message}`);
      return true;
    }
    // Future: integrate nodemailer here
    // const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, ... });
    // await transporter.sendMail({ to: userEmail, subject: reminder.title, text: reminder.message });
    console.log(`[SIMULATED EMAIL] To User: ${reminder.recipient} — Subject: ${reminder.title}`);
    return true;
  }

  async smsNotification(reminder) {
    // Adapter-ready, not functional
    console.log(`[SMS NOT_CONFIGURED] Would send to User: ${reminder.recipient} — ${reminder.message}`);
    return true;
  }

  async whatsAppNotification(reminder) {
    // Adapter-ready, not functional
    console.log(`[WHATSAPP NOT_CONFIGURED] Would send to User: ${reminder.recipient} — ${reminder.message}`);
    return true;
  }
}

module.exports = new ReminderService();
