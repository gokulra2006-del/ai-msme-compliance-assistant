require('dotenv').config({ path: 'backend/.env' });
const mongoose = require('mongoose');
const ComplianceRule = require('../models/ComplianceRule');
const RegulatorySource = require('../models/RegulatorySource');

async function auditSources() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/surakshasetu');
  console.log('Connected to MongoDB. Running Suraksha Rules Source Audit...\n');

  const rules = await ComplianceRule.find({ status: 'ACTIVE' }).populate('regulatorySource');
  let missingSource = 0;
  let unverified = 0;
  let missingUrl = 0;

  console.log('--- Rule Compliance with Suraksha Rules Grounding ---');
  for (const rule of rules) {
    if (!rule.regulatorySource) {
      console.log(`[WARNING] Rule ${rule.ruleCode} has no linked RegulatorySource.`);
      missingSource++;
      continue;
    }

    const source = rule.regulatorySource;
    if (source.verificationStatus !== 'VERIFIED') {
      console.log(`[ALERT] Rule ${rule.ruleCode} source (${source.sourceName}) is not VERIFIED. Status: ${source.verificationStatus}`);
      unverified++;
    }

    if (!source.officialUrl || source.officialUrl === 'NOT AVAILABLE IN SURAKSHA RULES') {
      console.log(`[INFO] Rule ${rule.ruleCode} lacks an official URL in Suraksha Rules.`);
      missingUrl++;
    }
  }

  console.log('\n--- Audit Summary ---');
  console.log(`Total Active Rules: ${rules.length}`);
  console.log(`Rules Missing Source Link: ${missingSource}`);
  console.log(`Rules Unverified: ${unverified}`);
  console.log(`Rules Missing URL: ${missingUrl}`);
  console.log('---------------------\n');

  await mongoose.disconnect();
}

auditSources().catch(console.error);
