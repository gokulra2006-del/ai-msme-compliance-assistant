// backend/src/engine/seedObligations.js
// Seeds the Obligation collection from the rules engine definitions
const Obligation = require('../models/Obligation');
const { rules } = require('./rulesEngine');

async function seedObligations() {
  for (const rule of rules) {
    const { condition, obligationCode, ...data } = rule;
    try {
      await Obligation.findOneAndUpdate(
        { code: obligationCode },
        { ...data, code: obligationCode, status: 'ACTIVE' },
        { upsert: true, new: true }
      );
    } catch (err) {
      // Ignore duplicate key errors during seeding
      if (err.code !== 11000) {
        console.error(`Seed error for ${obligationCode}:`, err.message);
      }
    }
  }
  console.log(`Seeded ${rules.length} obligations into database.`);
}

module.exports = seedObligations;
