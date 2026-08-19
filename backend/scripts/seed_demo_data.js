// backend/scripts/seed_demo_data.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');
const Business = require('../src/models/Business');
const Evidence = require('../src/models/Evidence');
const AuditLog = require('../src/models/AuditLog');
const ComplianceAction = require('../src/models/ComplianceAction');
const ComplianceRule = require('../src/models/ComplianceRule');

async function seed() {
  let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/surakshasetu';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB at', uri);

  // Clear existing demo data
  await User.deleteMany({ email: 'gokulra2006@gmail.com' });
  await Business.deleteMany({});
  await Evidence.deleteMany({});
  await AuditLog.deleteMany({});
  await ComplianceAction.deleteMany({});

  // 1. Create User
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);
  const user = new User({
    name: 'Gokul R',
    email: 'gokulra2006@gmail.com',
    password: hashedPassword,
    role: 'OWNER'
  });
  await user.save();
  console.log('User created');

  // 2. Create Business Profile (Highly realistic for Sakthi Textiles)
  const business = new Business({
    user: user._id,
    companyName: 'Sakthi',
    entityType: 'Private Limited',
    udyamRegistrationStatus: true,
    udyamRegistration: 'UDYAM-TN-03-0012345',
    pan: 'AACCS1234E',
    gstRegistrationStatus: true,
    gstin: '33AACCS1234E1Z1',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    city: 'Coimbatore',
    industry: 'Manufacturing',
    subIndustry: 'Spinning, Weaving and Finishing of Textiles',
    factoryStatus: true,
    boiler: true,
    effluent: true,
    hazardousWaste: false,
    nightShift: true,
    exportActivity: true,
    annualTurnoverBand: '5-50Cr',
    totalWorkers: 85,
    onRollWorkers: 45,
    contractWorkers: 40,
    womenWorkers: 35,
    contractorCount: 2
  });
  await business.save();
  user.business = business._id;
  await user.save();
  console.log('Business Profile created');

  const now = new Date();
  const daysFromNow = (n) => new Date(now.getTime() + n * 86400000);
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000);

  // 3. Create Compliance Actions (Calendar)
  const actions = [
    { title: 'GST Monthly Return (GSTR-3B)', description: 'File GST return by 20th.', ruleCode: 'GST-001', category: 'Tax', priority: 'CRITICAL', dueDate: daysFromNow(-3), status: 'PENDING', evidenceRequired: ['GST Registration Certificate', 'GSTR-3B Filing'] },
    { title: 'EPF Monthly Contribution', description: 'Monthly contribution for EPF.', ruleCode: 'EPF-001', category: 'Labour', priority: 'HIGH', dueDate: daysFromNow(5), status: 'PENDING', evidenceRequired: ['EPF Registration', 'ECR Challan'] },
    { title: 'ESI Half-Yearly Return', description: 'Submit ESI half-yearly return.', ruleCode: 'ESIC-001', category: 'Labour', priority: 'HIGH', dueDate: daysFromNow(15), status: 'PENDING', evidenceRequired: ['ESI Registration', 'Monthly Contribution Challan'] },
    { title: 'Fire Safety NOC Renewal', description: 'Renew Fire Safety NOC.', ruleCode: 'FACTORY-001', category: 'Safety', priority: 'CRITICAL', dueDate: daysFromNow(-10), status: 'PENDING', evidenceRequired: ['Fire Safety NOC'] },
    { title: 'Pollution Board Consent to Operate', description: 'Apply for PCB consent.', ruleCode: 'MPCB-001', category: 'Environment', priority: 'CRITICAL', dueDate: daysFromNow(45), status: 'PENDING', evidenceRequired: ['Pollution Board Consent'] },
    { title: 'Udyam Registration Renewal', description: 'Renew Udyam Registration.', ruleCode: 'UDYAM-001', category: 'Business', priority: 'HIGH', dueDate: daysFromNow(365), status: 'PENDING', evidenceRequired: ['Udyam Registration'] },
    { title: 'Shops & Establishments License Renewal', description: 'Renew Shops & Establishments License.', ruleCode: 'SHOPS-001', category: 'Labour', priority: 'MEDIUM', dueDate: daysFromNow(90), status: 'APPROVED', evidenceRequired: ['Shops and Establishments License'] },
    { title: 'Professional Tax Annual Return', description: 'File Professional Tax Annual Return.', ruleCode: 'PT-001', category: 'Tax', priority: 'HIGH', dueDate: daysFromNow(120), status: 'PENDING', evidenceRequired: ['Professional Tax Registration'] },
    { title: 'BOCW Registration', description: 'Registration for Building and Other Construction Workers.', ruleCode: 'BOCW-001', category: 'Labour', priority: 'MEDIUM', dueDate: daysFromNow(60), status: 'PENDING', evidenceRequired: ['BOCW Registration Certificate'] },
    { title: 'EPR Annual Filing', description: 'Extended Producer Responsibility Annual Filing.', ruleCode: 'EPR-001', category: 'Environment', priority: 'CRITICAL', dueDate: daysFromNow(200), status: 'PENDING', evidenceRequired: ['EPR Certificate'] }
  ];

  for (const act of actions) {
    const rule = await ComplianceRule.findOne({ ruleCode: act.ruleCode });
    await new ComplianceAction({
      business: business._id,
      title: act.title,
      description: act.description,
      ruleCode: act.ruleCode,
      obligationId: rule ? rule._id : null,
      category: act.category,
      priority: act.priority,
      applicability: 'APPLIES',
      status: act.status,
      dueDate: act.dueDate,
      evidenceRequired: act.evidenceRequired || [],
      source: 'MANUAL'
    }).save();
  }
  console.log('Compliance Actions created');

  // 4. Create Evidences (Vault)
  const evidences = [
    { documentType: 'GST Registration Certificate', documentName: 'GST_Cert_Sakthi.pdf', obligationCode: 'GST-001', status: 'VERIFIED', uploadDate: daysAgo(45), expiryDate: null },
    { documentType: 'GSTR-3B Filing', documentName: 'GSTR_3B_July.pdf', obligationCode: 'GST-001', status: 'VERIFIED', uploadDate: daysAgo(10), expiryDate: daysFromNow(20) },
    { documentType: 'Udyam Registration', documentName: 'Udyam_Certificate.pdf', obligationCode: 'UDYAM-001', status: 'VERIFIED', uploadDate: daysAgo(90), expiryDate: null },
    { documentType: 'Fire Safety NOC', documentName: 'Fire_NOC_2022.pdf', obligationCode: 'FACTORY-001', status: 'EXPIRED', uploadDate: daysAgo(400), expiryDate: daysAgo(10) },
    { documentType: 'EPF Registration', documentName: 'EPF_Reg.pdf', obligationCode: 'EPF-001', status: 'PENDING', uploadDate: daysAgo(5), expiryDate: null },
    { documentType: 'ECR Challan', documentName: 'EPF_Challan_July.pdf', obligationCode: 'EPF-001', status: 'VERIFIED', uploadDate: daysAgo(15), expiryDate: null },
    { documentType: 'ESI Registration', documentName: 'ESI_Reg.pdf', obligationCode: 'ESIC-001', status: 'UNDER_REVIEW', uploadDate: daysAgo(2), expiryDate: null },
    { documentType: 'Shops and Establishments License', documentName: 'Shops_Est_Sakthi.pdf', obligationCode: 'SHOPS-001', status: 'VERIFIED', uploadDate: daysAgo(150), expiryDate: daysFromNow(215) },
    { documentType: 'Professional Tax Registration', documentName: 'PT_Reg.pdf', obligationCode: 'PT-001', status: 'REJECTED', uploadDate: daysAgo(30), expiryDate: null }
  ];

  for (const ev of evidences) {
    await new Evidence({
      business: business._id,
      documentType: ev.documentType,
      documentName: ev.documentName,
      obligationCode: ev.obligationCode,
      verificationStatus: ev.status,
      uploadedAt: ev.uploadDate,
      expiryDate: ev.expiryDate,
      isLatestVersion: true,
      uploadedBy: user._id,
      originalFileName: ev.documentName,
      filePath: '/uploads/dummy_file.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf'
    }).save();
  }
  console.log('Evidence Vault populated');

  // 5. Create Audit Logs
  const logs = [
    { action: 'LOGIN', details: { method: 'EMAIL_PASSWORD' }, ip: '103.21.244.15', createdAt: daysAgo(0) },
    { action: 'EVIDENCE_UPLOADED', details: { documentType: 'EPF Registration' }, ip: '103.21.244.15', createdAt: daysAgo(5) },
    { action: 'EVIDENCE_VERIFIED', details: { documentType: 'GST Registration Certificate' }, ip: '103.21.244.15', createdAt: daysAgo(45) },
    { action: 'PROFILE_UPDATED', details: { field: 'employeeCount', newValue: '85' }, ip: '103.21.244.15', createdAt: daysAgo(10) },
    { action: 'EVIDENCE_REJECTED', details: { documentType: 'Professional Tax Registration', reason: 'Image quality is too low' }, ip: '103.21.244.15', createdAt: daysAgo(29) }
  ];

  for (const log of logs) {
    await new AuditLog({
      action: log.action,
      user: user._id,
      actorRole: 'OWNER',
      ip: log.ip,
      metadata: log.details,
      createdAt: log.createdAt
    }).save();
  }
  console.log('Audit Logs created');

  console.log('✅ Demo Database Seeded Successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
