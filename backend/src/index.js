// backend/src/index.js
require('dotenv').config({ override: true });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const nodemailer = require('nodemailer');
// Needed by the error handler below to recognise MulterError instances.
const multer = require('multer');

// Firewall / Security middlewares
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

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
const submissionRoutes = require('./routes/submissionRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');
const businessUpdatesRoutes = require('./routes/businessUpdates');
const workflowRoutes = require('./routes/workflowRoutes');
const migrateRules = require('./engine/migrateRules');
const runReminderJob = require('./jobs/complianceReminderJob');

const app = express();
// 1. Large Payload Protection (DoS prevention)
app.use(express.json({ limit: '10kb' }));
app.use(cors());
app.use(helmet());

// Apply WAF/Firewall protections
app.use(mongoSanitize()); // Prevent NoSQL injections
app.use(xss()); // Sanitize against XSS
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Advanced AI Deep Packet Inspection & Phishing Blocker
app.use((req, res, next) => {
  // 2. Bot / Scraper Detection
  const userAgent = req.get('User-Agent') || '';
  if (userAgent.includes('python-requests') || userAgent.includes('curl/') || userAgent.includes('PostmanRuntime/')) {
    return res.status(403).json({ success: false, error: 'FIREWALL BLOCKED: Automated bot or scraper detected.' });
  }

  const payload = JSON.stringify(req.body || {}) + JSON.stringify(req.query || {});
  const lowerPayload = payload.toLowerCase();
  
  // 3. Phishing / Malicious Link Detection
  if (lowerPayload.includes('free-money') || lowerPayload.includes('login-update') || lowerPayload.includes('bit.ly/')) {
    return res.status(403).json({ success: false, error: 'FIREWALL BLOCKED: Phishing attempt or malicious link detected in payload.' });
  }
  
  // 4. SQL Injection / Command Injection (Catch-All)
  if (lowerPayload.includes('union select') || lowerPayload.includes('drop table') || lowerPayload.includes('; rm -rf')) {
    return res.status(403).json({ success: false, error: 'FIREWALL BLOCKED: SQL/Command Injection signature detected.' });
  }
  
  // 5. Path Traversal
  if (payload.includes('../') || payload.includes('..\\') || lowerPayload.includes('/etc/passwd')) {
    return res.status(403).json({ success: false, error: 'FIREWALL BLOCKED: Path Traversal attack detected.' });
  }

  next();
});

app.use(passport.initialize());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Setup Email Transporter for Firewall Alerts
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Cache to prevent spamming emails from the same IP (temporarily disabled for hackathon demo)
const alertCache = new Set();

// Strict rate limiter for authentication to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs for auth
  handler: (req, res, next, options) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`[FIREWALL] Brute force detected from ${ip}. Dispatching email alert...`);
    
    const mailOptions = {
      from: `"${process.env.GMAIL_FROM_NAME || 'SurakshaSetu Security'}" <${process.env.GMAIL_USER}>`,
      to: 'gokulra2006@gmail.com, gokul.r2024c@vitstudent.ac.in',
      subject: '⚠️ SECURITY ALERT: Brute Force Attack Blocked!',
      html: `
        <h2 style="color: #d9534f;">SurakshaSetu Firewall Alert</h2>
        <p>The Web Application Firewall has detected and blocked a brute-force password attack.</p>
        <ul>
          <li><strong>Target:</strong> /api/auth/login</li>
          <li><strong>Attacker IP:</strong> ${ip}</li>
          <li><strong>Action Taken:</strong> IP temporarily banned for 15 minutes.</li>
        </ul>
        <p>No further action is required. The system is secure.</p>
      `
    };

    transporter.sendMail(mailOptions)
      .then(info => console.log(`[FIREWALL] Email successfully sent: ${info.messageId}`))
      .catch(err => console.error('[FIREWALL] Email failed to send:', err));

    res.status(429).json({ success: false, error: 'Too many authentication attempts, please try again later.' });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/business/updates', businessUpdatesRoutes);
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
app.use('/api/workflow', workflowRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/simulator', simulatorRoutes);

// simple health endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Errors thrown by middleware (rather than inside a controller's try/catch)
// had no handler, so Express answered with its default HTML page. The frontend
// reads `error` off a JSON body, so a rejected upload surfaced only as a bare
// "Upload failed" with no reason. Multer is the case that matters: its file
// filter and size limit both throw here, never in the controller.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The file is larger than the 10 MB limit.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected file field. Attach the document to the "file" field.'
          : `Upload rejected: ${err.message}`;
    return res.status(400).json({ success: false, error: message });
  }

  // The upload file filter rejects with a plain Error carrying a readable
  // reason (wrong MIME type, or an extension that disagrees with it).
  if (err instanceof Error && /not allowed|does not match the declared type/i.test(err.message)) {
    return res.status(400).json({ success: false, error: err.message });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Unexpected server error.' });
});

const startServer = async () => {
  let uri = process.env.MONGODB_URI;
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB Atlas connection error:', err.message);
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

  // The backend is pinned to port 5000 - the frontend calls http://localhost:5000/api
  // directly, so never fall back to another port.
  const PORT = 5000;

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the process using it and start again (Windows: netstat -ano | findstr :${PORT} then taskkill /PID <pid> /F).`);
      process.exit(1);
      return;
    }

    throw error;
  });
};

startServer();
