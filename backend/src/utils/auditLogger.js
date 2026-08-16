const AuditLog = require('../models/AuditLog');

/**
 * Standardized function to log audit events.
 * Fire and forget (does not block execution unless awaited).
 */
exports.logAudit = async ({
  req, // Express request object to extract user, IP, etc.
  action,
  entity = null,
  entityId = null,
  businessId = null,
  previousValue = null,
  newValue = null,
  metadata = null,
}) => {
  try {
    const user = req?.user;
    const ip = req?.ip || req?.socket?.remoteAddress;

    const logEntry = new AuditLog({
      user: user ? user.id : null,
      actorRole: user ? user.role : 'SYSTEM',
      business: businessId || (user ? user.business : null),
      action,
      entity,
      entityId,
      previousValue,
      newValue,
      metadata,
      ip,
    });

    await logEntry.save();
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
