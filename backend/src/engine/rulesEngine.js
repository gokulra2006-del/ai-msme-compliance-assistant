// backend/src/engine/rulesEngine.js
// Deterministic Rules Engine — decides which obligations apply to a business profile
// Evaluates rules sourced from the configurable ComplianceRule database models.

const fieldNames = {
  totalWorkers: 'workers',
  contractWorkers: 'contract workers',
  gstin_or_turnover: 'GSTIN or Turnover',
  state: 'Business state',
  district: 'Business district',
  industry: 'Industry',
  subIndustry: 'Sub-industry',
  boiler: 'Boiler',
  coldStorage: 'Cold storage',
  effluent: 'Effluent discharge',
  solidWaste: 'Solid waste',
  hazardousWaste: 'Hazardous waste',
  plasticPackaging: 'Plastic packaging',
  packagedRetail: 'Packaged retail'
};

const getFieldName = (field) => fieldNames[field] || field.replace(/([A-Z])/g, ' $1').toLowerCase();

function getOperatorAndExpected(key, expectedValue) {
  if (key === 'minTotalWorkers') return { field: 'totalWorkers', operator: '>=', expected: expectedValue };
  if (key === 'minContractWorkers') return { field: 'contractWorkers', operator: '>=', expected: expectedValue };
  if (key === 'hasGstOrTurnover') return { field: 'gstin_or_turnover', operator: 'REQUIRED', expected: true };
  return { field: key, operator: 'EQUALS', expected: expectedValue };
}

function evaluateSingleCondition(key, expectedValue, businessProfile) {
  const { field, operator, expected } = getOperatorAndExpected(key, expectedValue);
  let actualValue = businessProfile[field];
  
  if (key === 'hasGstOrTurnover') {
    actualValue = !!(businessProfile.gstin || businessProfile.annualTurnoverBand);
  } else if (field === 'totalWorkers' || field === 'contractWorkers') {
    if (actualValue === undefined || actualValue === null) actualValue = null;
  }
  
  const readableField = getFieldName(field);

  // Check for missing data
  if (actualValue === undefined || actualValue === null) {
     return {
       field, 
       operator, 
       expectedValue: expected, 
       actualValue: null,
       matched: false, 
       missing: true,
       explanation: `${readableField.charAt(0).toUpperCase() + readableField.slice(1)} information is required to evaluate this rule.`,
       readableField
     };
  }

  let matched = false;
  let explanation = '';
  
  if (operator === '>=') {
    matched = actualValue >= expected;
    explanation = matched 
      ? `${readableField.charAt(0).toUpperCase() + readableField.slice(1)} count meets the configured threshold of ${expected}.` 
      : `${readableField.charAt(0).toUpperCase() + readableField.slice(1)} count of ${actualValue} is below the configured threshold of ${expected}.`;
  } else if (operator === 'EQUALS') {
    matched = actualValue === expected;
    explanation = matched 
      ? `Business ${readableField} matches.` 
      : `Business ${readableField} does not match.`;
  } else if (operator === 'REQUIRED') {
    matched = actualValue === expected;
    explanation = matched 
      ? `Meets requirement.` 
      : `Requirement is not met.`;
  }
  
  return { field, operator, expectedValue: expected, actualValue, matched, missing: false, explanation, readableField };
}

function evaluateCondition(condition, businessProfile) {
  if (!condition || Object.keys(condition).length === 0) {
    return {
      status: 'APPLIES',
      conditionsEvaluated: [],
      conditionsMatched: [],
      conditionsNotMatched: [],
      missingFields: []
    };
  }

  const condObj = condition instanceof Map ? Object.fromEntries(condition) : condition;
  
  const conditionsEvaluated = [];
  const conditionsMatched = [];
  const conditionsNotMatched = [];
  const missingFields = [];
  
  let hasMissing = false;
  let hasFailed = false;

  for (const [key, expectedValue] of Object.entries(condObj)) {
    const result = evaluateSingleCondition(key, expectedValue, businessProfile);
    conditionsEvaluated.push(result);
    
    if (result.missing) {
      hasMissing = true;
      missingFields.push(result.field);
    } else if (result.matched) {
      conditionsMatched.push(result);
    } else {
      hasFailed = true;
      conditionsNotMatched.push(result);
    }
  }

  let status = 'APPLIES';
  if (hasMissing) status = 'INSUFFICIENT_DATA';
  else if (hasFailed) status = 'DOES_NOT_APPLY';

  return {
    status,
    conditionsEvaluated,
    conditionsMatched,
    conditionsNotMatched,
    missingFields
  };
}

function generateExplanation(status, ruleTitle, evalResult, businessProfile) {
  if (status === 'INSUFFICIENT_DATA') {
    const readableFields = evalResult.missingFields.map(f => getFieldName(f)).join(' and ');
    return `${ruleTitle} cannot be evaluated because ${readableFields} information is missing.`;
  }
  
  if (status === 'DOES_NOT_APPLY') {
    if (evalResult.conditionsNotMatched.length === 0) return `This obligation does not apply.`;
    
    // Pick the most impactful failed condition to explain
    const fail = evalResult.conditionsNotMatched[0];
    const readableField = getFieldName(fail.field);
    
    if (fail.operator === '>=') {
      return `The configured threshold is ${fail.expectedValue} ${readableField}, but this business has ${fail.actualValue} ${readableField}.`;
    }
    
    const formattedVal = typeof fail.actualValue === 'boolean' ? (fail.actualValue ? 'Yes' : 'No') : fail.actualValue;
    return `${ruleTitle} does not apply because the business profile indicates that ${readableField} is ${formattedVal}.`;
  }
  
  if (status === 'APPLIES') {
    if (evalResult.conditionsMatched.length === 0) {
      return `${ruleTitle} applies universally based on configured rules.`;
    }
    
    // Build explanation from matches
    let stateStr = businessProfile.state ? `is in ${businessProfile.state}` : 'is registered';
    const matchGt = evalResult.conditionsMatched.find(c => c.operator === '>=');
    
    if (matchGt) {
      return `${ruleTitle} applies because the business ${stateStr} and has ${matchGt.actualValue} ${getFieldName(matchGt.field)}, which meets the configured threshold of ${matchGt.expectedValue} ${getFieldName(matchGt.field)}.`;
    } else {
      const matchEq = evalResult.conditionsMatched[0];
      return `${ruleTitle} applies because the business profile matches the required ${getFieldName(matchEq.field)}.`;
    }
  }
  
  return 'Explanation unavailable.';
}

function getRecommendedAction(rule) {
  const domain = rule.complianceDomain || '';
  if (domain.includes('Food')) return `Upload the required FSSAI license or documentation.`;
  if (domain.includes('Labour')) return `Review the applicable ${rule.title} filing requirement.`;
  if (domain.includes('Environment')) return `Verify the pollution consent certificate.`;
  return `Review the obligation details and required evidence.`;
}

function checkJurisdiction(rule, businessProfile) {
  // Assume CENTRAL if jurisdictionLevel is not set for backwards compatibility with legacy rules
  if (!rule.jurisdictionLevel || rule.jurisdictionLevel === 'CENTRAL') {
    return 'MATCH';
  }

  const profileState = (businessProfile.state || '').toUpperCase().trim();
  const profileStateCode = (businessProfile.stateCode || '').toUpperCase().trim();

  // If rule needs state information, check if business profile has it
  if (rule.jurisdictionLevel === 'STATE' || rule.jurisdictionLevel === 'UT' || rule.jurisdictionLevel === 'LOCAL') {
    if (!profileState && !profileStateCode) {
      return 'MISSING_DATA';
    }
  }

  if (rule.jurisdictionLevel === 'STATE' || rule.jurisdictionLevel === 'UT') {
    const ruleState = (rule.state || '').toUpperCase().trim();
    const ruleCode = (rule.jurisdictionCode || '').toUpperCase().trim();

    if (ruleCode && profileStateCode && ruleCode === profileStateCode) return 'MATCH';
    if (ruleState && profileState && ruleState === profileState) return 'MATCH';
    
    // As a simplistic fallback for names and codes where one side has a code and the other has a full name.
    // E.g., MH == Maharashtra, TN == Tamil Nadu
    const stateCodeMap = {
      'MAHARASHTRA': 'MH',
      'TAMIL NADU': 'TN',
      'KARNATAKA': 'KA',
      'GUJARAT': 'GJ'
      // Extend as necessary
    };

    if (profileState && ruleCode) {
      if (stateCodeMap[profileState] === ruleCode) return 'MATCH';
    }
    if (ruleState && profileStateCode) {
      if (stateCodeMap[ruleState] === profileStateCode) return 'MATCH';
    }

    return 'MISMATCH';
  }

  if (rule.jurisdictionLevel === 'LOCAL') {
    // Basic stub for local rules
    const profileCity = (businessProfile.city || '').toUpperCase().trim();
    const profileDistrict = (businessProfile.district || '').toUpperCase().trim();
    const ruleCity = (rule.city || '').toUpperCase().trim();
    const ruleDistrict = (rule.district || '').toUpperCase().trim();

    // In a real implementation this would be more robust.
    if (ruleCity && profileCity && ruleCity === profileCity) return 'MATCH';
    if (ruleDistrict && profileDistrict && ruleDistrict === profileDistrict) return 'MATCH';

    return 'MISMATCH';
  }

  return 'MATCH'; // Default fallback
}

function evaluateRules(businessProfile, rulesFromDb = []) {
  const results = [];
  const now = new Date();

  for (const rule of rulesFromDb) {
    if (rule.status !== 'ACTIVE') continue;
    if (rule.effectiveDate && new Date(rule.effectiveDate) > now) continue;
    if (rule.expiryDate && new Date(rule.expiryDate) < now) continue;

    const jurisdictionStatus = checkJurisdiction(rule, businessProfile);

    if (jurisdictionStatus === 'MISMATCH') {
      continue; // completely skip mismatched state rules
    }

    let evalResult;
    
    if (jurisdictionStatus === 'MISSING_DATA') {
      evalResult = {
        status: 'INSUFFICIENT_DATA',
        conditionsEvaluated: [],
        conditionsMatched: [],
        conditionsNotMatched: [],
        missingFields: ['state']
      };
    } else {
      evalResult = evaluateCondition(rule.applicabilityConditions, businessProfile);
    }
    const explanation = generateExplanation(evalResult.status, rule.title, evalResult, businessProfile);
    
    const sourceData = rule.regulatorySource && typeof rule.regulatorySource === 'object' 
      ? rule.regulatorySource 
      : rule; // Fall back to rule object properties if not populated
      
    const realSource = {
      sourceName: sourceData.sourceName || 'NOT AVAILABLE IN GAWK',
      actName: sourceData.actName || 'NOT AVAILABLE IN GAWK',
      sectionNumber: sourceData.sectionNumber || sourceData.section || 'NOT AVAILABLE IN GAWK',
      authority: sourceData.authority || sourceData.regulator || 'NOT AVAILABLE IN GAWK',
      officialUrl: sourceData.officialUrl || sourceData.sourceUrl || 'NOT AVAILABLE IN GAWK',
      effectiveDate: sourceData.effectiveDate || sourceData.effectiveFrom || null,
      lastVerifiedDate: sourceData.lastVerifiedDate || new Date().toISOString(),
      verificationStatus: sourceData.verificationStatus || 'PENDING_REVIEW'
    };

    results.push({
      ruleCode: rule.ruleCode,
      obligationTitle: rule.title,
      description: rule.description,
      domain: rule.complianceDomain,
      regulator: rule.regulator,
      jurisdiction: rule.jurisdictionLevel,
      complianceFrequency: rule.complianceFrequency,
      severity: rule.severity,
      penaltyDescription: rule.penaltyDescription,
      imprisonmentRisk: rule.imprisonmentRisk,
      licenseSuspensionRisk: rule.licenseSuspensionRisk,
      requiredEvidence: rule.requiredEvidence,
      status: evalResult.status,
      explanation,
      conditionsEvaluated: evalResult.conditionsEvaluated,
      conditionsMatched: evalResult.conditionsMatched,
      conditionsNotMatched: evalResult.conditionsNotMatched,
      missingFields: evalResult.missingFields,
      regulatorySource: realSource,
      recommendedNextAction: getRecommendedAction(rule),
      
      // legacy fields for compatibility with existing UI temporarily
      code: rule.ruleCode,
      title: rule.title,
      applicability: evalResult.status,
      cadence: rule.complianceFrequency,
      requiredEvidenceTypes: rule.requiredEvidence,
      imprisonmentFlag: rule.imprisonmentRisk,
      licenceSuspensionFlag: rule.licenseSuspensionRisk
    });
  }
  return results;
}

module.exports = { evaluateRules, evaluateCondition };
