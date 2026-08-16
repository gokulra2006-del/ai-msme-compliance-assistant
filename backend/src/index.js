// backend/src/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load models
require('./models/User');
require('./models/Obligation');
require('./models/Business');
require('./models/Evidence');
require('./models/DocumentDraft');
require('./models/AuditLog');
require('./models/ProposedRuleChange');
require('./models/RegulatoryUpdate');

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const obligationRoutes = require('./routes/obligations');
const evidenceRoutes = require('./routes/evidence');
const adminRulesRoutes = require('./routes/adminRules');
const complianceActionRoutes = require('./routes/complianceActions');
const riskRoutes = require('./routes/risk');
const assistantRoutes = require('./routes/assistant');
const auditRoutes = require('./routes/audit');
const adminSourcesRoutes = require('./routes/adminSources');
const adminUpdatesRoutes = require('./routes/adminUpdates');
const inspectionRoutes = require('./routes/inspection');
const notificationRoutes = require('./routes/notifications');
const documentDraftRoutes = require('./routes/documentDrafts');
const migrateRules = require('./engine/migrateRules');
const runReminderJob = require('./jobs/complianceReminderJob');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/obligations', obligationRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/admin/rules', adminRulesRoutes);
app.use('/api/admin/sources', adminSourcesRoutes);
app.use('/api/admin/updates', adminUpdatesRoutes);
app.use('/api/compliance-actions', complianceActionRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/inspection', inspectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/document-drafts', documentDraftRoutes);

// simple health endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const startServer = async () => {
  let uri = process.env.MONGODB_URI;
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.log('Local MongoDB failed, starting in-memory DB fallback...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('MongoDB Memory Server connected at', uri);
  }

  // Seed rules into the in-memory or real DB on startup
  try {
    await migrateRules();
  } catch(err) {
    console.error('Failed to migrate rules on startup', err);
  }

  // Start background jobs
  setTimeout(runReminderJob, 5000); // run 5s after startup
  setInterval(runReminderJob, 15 * 60 * 1000); // run every 15 minutes

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();
