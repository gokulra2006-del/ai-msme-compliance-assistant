require('dotenv').config({ path: require('path').resolve('.env') });
const mongoose = require('mongoose');
const ComplianceAction = require('./src/models/ComplianceAction');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/surakshasetu');
  console.log('Connected to DB');

  const updates = [
    { ruleCode: 'GST-001', req: ['GST Registration Certificate'] },
    { ruleCode: 'EPF-001', req: ['EPF Registration'] },
    { ruleCode: 'ESIC-001', req: ['ESI Registration'] },
    { ruleCode: 'FACTORY-001', req: ['Fire Safety NOC'] },
    { ruleCode: 'MPCB-001', req: ['Pollution Board Consent'] },
  ];

  for (const update of updates) {
    await ComplianceAction.updateMany(
      { ruleCode: update.ruleCode },
      { $set: { evidenceRequired: update.req } }
    );
  }

  // Also need to create an action for UDYAM-001 if it doesn't exist
  const udyamAction = await ComplianceAction.findOne({ ruleCode: 'UDYAM-001' });
  if (!udyamAction) {
    const Business = require('./src/models/Business');
    const b = await Business.findOne();
    if (b) {
      await ComplianceAction.create({
        business: b._id,
        title: 'Udyam Registration Renewal',
        description: 'Renew Udyam Registration',
        ruleCode: 'UDYAM-001',
        category: 'Business',
        priority: 'HIGH',
        applicability: 'APPLIES',
        status: 'PENDING',
        evidenceRequired: ['Udyam Registration'],
        source: 'MANUAL'
      });
    }
  }
  console.log('Updated Compliance Actions');
  process.exit(0);
}
run();
