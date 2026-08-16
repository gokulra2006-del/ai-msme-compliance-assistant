const { evaluateRules } = require('../src/engine/rulesEngine');

describe('Rules Engine (Configurable DB Format)', () => {
  const mockRules = [
    {
      ruleCode: 'FSSAI-001',
      title: 'FSSAI State License',
      status: 'ACTIVE',
      jurisdictionLevel: 'CENTRAL',
      applicabilityConditions: { industry: 'Food Processing' }
    },
    {
      ruleCode: 'FACTORY-001',
      title: 'Factory License',
      status: 'ACTIVE',
      jurisdictionLevel: 'CENTRAL',
      applicabilityConditions: { minTotalWorkers: 10 }
    },
    {
      ruleCode: 'TN-LABOUR-001',
      title: 'Tamil Nadu Labour Act',
      status: 'ACTIVE',
      jurisdictionLevel: 'STATE',
      jurisdictionCode: 'TN',
      applicabilityConditions: {}
    },
    {
      ruleCode: 'MH-POLLUTION-001',
      title: 'Maharashtra Pollution Board',
      status: 'ACTIVE',
      jurisdictionLevel: 'STATE',
      state: 'Maharashtra',
      applicabilityConditions: {}
    },
    {
      ruleCode: 'INACTIVE-001',
      title: 'Inactive Rule',
      status: 'INACTIVE',
      jurisdictionLevel: 'CENTRAL',
      applicabilityConditions: { industry: 'Food Processing' }
    },
    {
      ruleCode: 'EXPIRED-001',
      title: 'Expired Rule',
      status: 'ACTIVE',
      jurisdictionLevel: 'CENTRAL',
      expiryDate: new Date(Date.now() - 100000).toISOString(),
      applicabilityConditions: {}
    },
    {
      ruleCode: 'FUTURE-001',
      title: 'Future Rule',
      status: 'ACTIVE',
      jurisdictionLevel: 'CENTRAL',
      effectiveDate: new Date(Date.now() + 100000).toISOString(),
      applicabilityConditions: {}
    }
  ];

  it('TEST 5: should evaluate applicability correctly (existing regression fix)', () => {
    const profile = {
      industry: 'Food Processing',
      state: 'Tamil Nadu', // providing state so we don't get INSUFFICIENT_DATA for state rules
      totalWorkers: 5
    };

    const evaluated = evaluateRules(profile, mockRules);

    // FSSAI-001 applies (Food Processing)
    expect(evaluated.find(r => r.code === 'FSSAI-001').applicability).toBe('APPLIES');
    
    // FACTORY-001 doesn't apply (needs 10 workers)
    expect(evaluated.find(r => r.code === 'FACTORY-001').applicability).toBe('DOES_NOT_APPLY');
  });

  it('TEST 1: Business in Tamil Nadu -> Central and TN rules apply, MH do not', () => {
    const profile = { state: 'Tamil Nadu', stateCode: 'TN', industry: 'Food Processing' };
    const evaluated = evaluateRules(profile, mockRules);

    expect(evaluated.find(r => r.code === 'FSSAI-001').applicability).toBe('APPLIES');
    expect(evaluated.find(r => r.code === 'TN-LABOUR-001').applicability).toBe('APPLIES');
    expect(evaluated.find(r => r.code === 'MH-POLLUTION-001')).toBeUndefined();
  });

  it('TEST 2: Business in Maharashtra -> Central and MH rules apply, TN do not', () => {
    const profile = { state: 'Maharashtra', stateCode: 'MH', industry: 'Food Processing' };
    const evaluated = evaluateRules(profile, mockRules);

    expect(evaluated.find(r => r.code === 'FSSAI-001').applicability).toBe('APPLIES');
    expect(evaluated.find(r => r.code === 'MH-POLLUTION-001').applicability).toBe('APPLIES');
    expect(evaluated.find(r => r.code === 'TN-LABOUR-001')).toBeUndefined();
  });

  it('TEST 3: Business in Karnataka -> Central apply, TN and MH do not', () => {
    const profile = { state: 'Karnataka', stateCode: 'KA', industry: 'Food Processing' };
    const evaluated = evaluateRules(profile, mockRules);

    expect(evaluated.find(r => r.code === 'FSSAI-001').applicability).toBe('APPLIES');
    expect(evaluated.find(r => r.code === 'TN-LABOUR-001')).toBeUndefined();
    expect(evaluated.find(r => r.code === 'MH-POLLUTION-001')).toBeUndefined();
  });

  it('TEST 4: Business has no state -> State rules evaluate to INSUFFICIENT_DATA', () => {
    const profile = { industry: 'Food Processing' }; // Missing state
    const evaluated = evaluateRules(profile, mockRules);

    expect(evaluated.find(r => r.code === 'FSSAI-001').applicability).toBe('APPLIES');
    
    const tnRule = evaluated.find(r => r.code === 'TN-LABOUR-001');
    expect(tnRule).toBeDefined();
    expect(tnRule.applicability).toBe('INSUFFICIENT_DATA');
    expect(tnRule.missingFields).toContain('state');

    const mhRule = evaluated.find(r => r.code === 'MH-POLLUTION-001');
    expect(mhRule).toBeDefined();
    expect(mhRule.applicability).toBe('INSUFFICIENT_DATA');
    expect(mhRule.missingFields).toContain('state');
  });

  it('should filter out inactive rules', () => {
    const profile = { industry: 'Food Processing' };
    const evaluated = evaluateRules(profile, mockRules);
    
    // Inactive rule should not be evaluated
    expect(evaluated.find(r => r.code === 'INACTIVE-001')).toBeUndefined();
  });

  it('should filter out expired and future rules', () => {
    const profile = {};
    const evaluated = evaluateRules(profile, mockRules);
    
    expect(evaluated.find(r => r.code === 'EXPIRED-001')).toBeUndefined();
    expect(evaluated.find(r => r.code === 'FUTURE-001')).toBeUndefined();
  });
});
