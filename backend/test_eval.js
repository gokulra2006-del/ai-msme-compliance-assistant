const mongoose = require('mongoose');
require('dotenv').config();

const { evaluateRules } = require('./src/engine/rulesEngine');
const ComplianceRule = require('./src/models/ComplianceRule');

const businessProfile = {
  state: 'Maharashtra',
  industry: 'Food Processing',
  totalWorkers: 25,
  contractWorkers: 8,
  boiler: true,
  coldStorage: true,
  effluent: true,
  hazardousWaste: true,
  plasticPackaging: true,
  gstin: '27AAAAA0000A1Z5', // simulates GST registered
  packagedRetail: true
};

async function run() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Seed the rules using the migrate script
  const migrateRules = require('./src/engine/migrateRules');
  await migrateRules();

  const rules = await ComplianceRule.find({ active: true });
  console.log(`Loaded ${rules.length} rules.`);

  const results = evaluateRules(businessProfile, rules);

  results.forEach(res => {
    console.log(`\n==================================================`);
    console.log(`Rule: ${res.obligationTitle} (${res.ruleCode})`);
    console.log(`Status: ${res.evaluationStatus}`);
    console.log(`Explanation: ${res.explanation}`);
    console.log(`Action: ${res.recommendedNextAction}`);
    console.log(`Conditions:`);
    res.conditionsEvaluated.forEach(c => {
      console.log(`  [${c.matched ? '✓' : c.missing ? '⚠️' : '❌'}] ${c.readableField || c.field}: ${c.actualValue} (expected: ${c.operator} ${c.expectedValue}) -> ${c.explanation}`);
    });
  });

  console.log(`\n\n>>> RUNNING EDGE CASES <<<`);
  
  // 1. Worker count below threshold
  console.log(`\n--- Worker count below threshold (9) ---`);
  const resBelow = evaluateRules({ state: 'Maharashtra', totalWorkers: 9 }, rules.filter(r => r.ruleCode === 'FACTORY-001'));
  console.log(resBelow[0].status || resBelow[0].evaluationStatus, '-', resBelow[0].explanation);
  
  // 2. Worker count exactly at threshold
  console.log(`\n--- Worker count at threshold (10) ---`);
  const resExact = evaluateRules({ state: 'Maharashtra', totalWorkers: 10 }, rules.filter(r => r.ruleCode === 'FACTORY-001'));
  console.log(resExact[0].status || resExact[0].evaluationStatus, '-', resExact[0].explanation);

  // 3. Worker count above threshold
  console.log(`\n--- Worker count above threshold (11) ---`);
  const resAbove = evaluateRules({ state: 'Maharashtra', totalWorkers: 11 }, rules.filter(r => r.ruleCode === 'FACTORY-001'));
  console.log(resAbove[0].status || resAbove[0].evaluationStatus, '-', resAbove[0].explanation);

  // 4. Missing state
  console.log(`\n--- Missing State ---`);
  const resMissingState = evaluateRules({ totalWorkers: 25 }, rules.filter(r => r.ruleCode === 'FACTORY-001'));
  console.log(resMissingState[0].status || resMissingState[0].evaluationStatus, '-', resMissingState[0].explanation);

  // 5. Inactive rule
  console.log(`\n--- Inactive Rule ---`);
  const inactiveRule = { ...rules[0].toObject(), active: false };
  const resInactive = evaluateRules({ state: 'Maharashtra', industry: 'Food Processing' }, [inactiveRule]);
  console.log(`Results length (should be 0):`, resInactive.length);

  // 6. Future effective rule
  console.log(`\n--- Future effective rule ---`);
  const futureRule = { ...rules[0].toObject(), effectiveDate: new Date('2030-01-01') };
  const resFuture = evaluateRules({ state: 'Maharashtra', industry: 'Food Processing' }, [futureRule]);
  console.log(`Results length (should be 0):`, resFuture.length);

  // 7. Expired rule
  console.log(`\n--- Expired rule ---`);
  const expiredRule = { ...rules[0].toObject(), expiryDate: new Date('2020-01-01') };
  const resExpired = evaluateRules({ state: 'Maharashtra', industry: 'Food Processing' }, [expiredRule]);
  console.log(`Results length (should be 0):`, resExpired.length);


  await mongoose.disconnect();
  await mongoServer.stop();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
