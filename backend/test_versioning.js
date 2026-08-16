require('dotenv').config();
const mongoose = require('mongoose');
const ComplianceRule = require('./src/models/ComplianceRule');
const RuleVersion = require('./src/models/RuleVersion');
const RegulatorySource = require('./src/models/RegulatorySource');
const ProposedRuleChange = require('./src/models/ProposedRuleChange');
const User = require('./src/models/User');
const { evaluateRules } = require('./src/engine/rulesEngine');

async function runTest() {
  let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/surakshasetu';
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
  
  // Clean up previous test
  await ComplianceRule.deleteMany({ ruleCode: 'RULE-TEST-001' });
  await ProposedRuleChange.deleteMany({ ruleCode: 'RULE-TEST-001' });
  await RegulatorySource.deleteMany({ sourceName: 'Test Source 101' });

  // 1. Create a User
  let user = await User.findOne({ email: 'admin@surakshasetu.in' });
  if (!user) {
     user = await User.create({
       name: 'Admin',
       email: 'admin@surakshasetu.in',
       password: 'password123',
       role: 'ADMIN'
     });
  }

  // 2. Create a Regulatory Source
  const source = await RegulatorySource.create({
    sourceName: 'Test Source 101',
    officialUrl: 'https://example.com/test101',
    verificationStatus: 'VERIFIED',
    regulator: 'Test Regulator'
  });

  // 3. Create initial rule (Version 1.0)
  const ruleV1 = await ComplianceRule.create({
    ruleCode: 'RULE-TEST-001',
    title: 'Test Threshold Rule',
    description: 'Requires 20 workers',
    complianceDomain: 'Labour',
    jurisdictionLevel: 'CENTRAL',
    regulator: 'Test Regulator',
    applicabilityConditions: { minTotalWorkers: 20 },
    effectiveDate: new Date('2023-01-01T00:00:00Z'),
    regulatorySource: source._id,
    status: 'ACTIVE',
    version: '1.0'
  });

  console.log(`Created Rule V1.0: ${ruleV1.ruleCode} with minTotalWorkers = 20, effective = ${ruleV1.effectiveDate.toISOString()}`);

  // 4. Propose Rule Change (Version 1.1)
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  const proposal = await ProposedRuleChange.create({
    ruleCode: 'RULE-TEST-001',
    currentVersion: '1.0',
    proposedVersion: '1.1',
    proposedConditions: { minTotalWorkers: 25 }, // Changed threshold!
    proposedSource: source._id,
    effectiveDate: nextMonth,
    reason: 'Threshold increased by government',
    createdBy: user._id,
    status: 'PENDING'
  });

  console.log(`Proposed Rule V1.1: effective = ${proposal.effectiveDate.toISOString()}`);

  // 5. Approve Rule Change
  ruleV1.expiryDate = proposal.effectiveDate;
  await ruleV1.save();
  
  const ruleV2 = await ComplianceRule.create({
    ruleCode: 'RULE-TEST-001',
    title: ruleV1.title,
    description: ruleV1.description,
    complianceDomain: ruleV1.complianceDomain,
    jurisdictionLevel: ruleV1.jurisdictionLevel,
    regulator: ruleV1.regulator,
    applicabilityConditions: proposal.proposedConditions, // New condition
    effectiveDate: proposal.effectiveDate,
    regulatorySource: proposal.proposedSource,
    status: 'ACTIVE',
    version: proposal.proposedVersion
  });
  
  console.log(`Approved Rule V1.1: ${ruleV2.ruleCode} with minTotalWorkers = 25, effective = ${ruleV2.effectiveDate.toISOString()}`);
  console.log(`Rule V1.0 updated expiryDate = ${ruleV1.expiryDate.toISOString()}`);

  // 6. Evaluate Business Profile against rules at different simulated dates
  
  const businessProfile = { totalWorkers: 22 }; // Meets V1.0 threshold (20), fails V1.1 threshold (25)
  
  // We mock evaluateRules by passing all rules and mocking `new Date()` inside it (since we can't easily mock `new Date()` globally in this simple script, we'll manually filter them how `rulesEngine` does it).
  const allRules = await ComplianceRule.find({ ruleCode: 'RULE-TEST-001' });
  
  // Test 1: Evaluation TODAY
  const today = new Date();
  const activeToday = allRules.filter(r => r.status === 'ACTIVE' && r.effectiveDate <= today && (!r.expiryDate || r.expiryDate > today));
  const resultsToday = evaluateRules(businessProfile, activeToday);
  
  console.log(`\n--- Evaluation Today (${today.toISOString()}) ---`);
  console.log(`Active rules count: ${activeToday.length}`);
  console.log(`Rule Evaluated: Version ${activeToday[0].version}`);
  console.log(`Result: ${resultsToday[0].evaluationStatus}`); // Should be APPLIES

  // Test 2: Evaluation IN THE FUTURE
  const future = new Date(nextMonth.getTime() + 86400000); // 1 day after V1.1 effective date
  const activeFuture = allRules.filter(r => r.status === 'ACTIVE' && r.effectiveDate <= future && (!r.expiryDate || r.expiryDate > future));
  const resultsFuture = evaluateRules(businessProfile, activeFuture);
  
  console.log(`\n--- Evaluation Future (${future.toISOString()}) ---`);
  console.log(`Active rules count: ${activeFuture.length}`);
  console.log(`Rule Evaluated: Version ${activeFuture[0].version}`);
  console.log(`Result: ${resultsFuture[0].evaluationStatus}`); // Should be DOES_NOT_APPLY

  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
