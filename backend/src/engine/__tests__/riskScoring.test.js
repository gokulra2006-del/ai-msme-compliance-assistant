const { calculateRiskScore, WEIGHTS } = require('../riskScoring');
const ComplianceAction = require('../../models/ComplianceAction');
const Evidence = require('../../models/Evidence');
const mongoose = require('mongoose');

// Manual mock Mongoose models

// In standard NodeJS without Jest, we can mock it manually for a simple script:
const mockActions = [];
const mockEvidences = [];

ComplianceAction.find = () => ({
  populate: () => Promise.resolve(mockActions)
});
Evidence.find = () => Promise.resolve(mockEvidences);

describe('Risk Scoring', () => {
  it('should calculate risk score correctly', async () => {
    let passed = 0;
    let failed = 0;
    
    function assertEqual(name, actual, expected) {
      expect(actual).toBe(expected);
    }

    const dummyBusinessId = new mongoose.Types.ObjectId();

    // Test 1: Low Risk (Empty)
    mockActions.length = 0;
    mockEvidences.length = 0;
    let res = await calculateRiskScore(dummyBusinessId);
    assertEqual('Empty database is LOW risk', res.riskLevel, 'LOW');
    assertEqual('Empty database score is 0', res.score, 0);

    // Test 2: Missing Evidence (+20) -> Moderate (20 is LOW, but let's check weight)
    // If score is 20, is it LOW? finalScore >= 21 is MODERATE. So 20 is LOW.
    mockActions.push({
      applicability: 'APPLIES',
      priority: 'MEDIUM',
      evidenceRequired: ['FSSAI License'],
      ruleCode: 'R1',
      title: 'Food Safety',
      obligationId: {} // no special risk
    });
    res = await calculateRiskScore(dummyBusinessId);
    assertEqual('Missing evidence is exactly 20 (LOW risk boundary)', res.score, 20);
    assertEqual('Missing evidence risk level', res.riskLevel, 'LOW');

    // Test 3: Missing Evidence (20) + Due Soon Action (5) -> 25 (MODERATE)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    mockActions[0].dueDate = futureDate;
    res = await calculateRiskScore(dummyBusinessId);
    assertEqual('Missing Evidence + Due Soon = 25', res.score, 25);
    assertEqual('Score 25 is MODERATE', res.riskLevel, 'MODERATE');

    // Test 4: High Risk -> Overdue Action (25) + Missing Evidence (20) = 45 (HIGH)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    mockActions[0].dueDate = pastDate;
    res = await calculateRiskScore(dummyBusinessId);
    assertEqual('Score 45 is HIGH', res.score, 45);
    assertEqual('Score 45 riskLevel', res.riskLevel, 'HIGH');

    // Test 5: Critical Risk -> > 70
    mockActions.push({
      applicability: 'APPLIES',
      priority: 'CRITICAL', // +15
      dueDate: pastDate, // +25
      ruleCode: 'R2',
      title: 'Critical safety',
      obligationId: { imprisonmentRisk: true, licenseSuspensionRisk: true } // +20 + 20
    });
    // Total expected: 
    // Action 1: Overdue (+25), Missing Ev (+20) = 45
    // Action 2: Critical (+15), Overdue (+25), Imprison (+20), Suspend (+20) = 80
    // Sum = 125. Capped at 100.
    res = await calculateRiskScore(dummyBusinessId);
    assertEqual('Cap at 100', res.score, 100);
    assertEqual('Score 100 is CRITICAL', res.riskLevel, 'CRITICAL');
    
    // Test 6: INSUFFICIENT_DATA
    mockActions.length = 0;
    mockActions.push({ applicability: 'INSUFFICIENT_DATA' });
    res = await calculateRiskScore(dummyBusinessId);
    assertEqual('Insufficient data adds 5', res.score, 5);
    assertEqual('Insufficient data sets flag', res.insufficientDataWarning, true);
  });
});
