require('dotenv').config({ path: 'backend/.env' });
const mongoose = require('mongoose');
const RulePack = require('../models/RulePack');
const ComplianceRule = require('../models/ComplianceRule');
const RegulatorySource = require('../models/RegulatorySource');
const User = require('../models/User');
const Business = require('../models/Business');

// The original 12 rules, mapped to JSON applicability conditions
const originalRules = [
  {
    ruleCode: 'FSSAI-001',
    title: 'FSSAI State License',
    description: 'All food processing units with turnover above ₹12 lakh must obtain and renew the FSSAI State Manufacturing License.',
    complianceDomain: 'Food Safety',
    jurisdictionLevel: 'STATE',
    state: 'Maharashtra',
    regulator: 'FSSAI',
    applicabilityConditions: { industry: 'Food Processing' },
    requiredEvidence: ['FSSAI License Copy', 'Application Receipt', 'Lab Test Reports'],
    complianceFrequency: 'Annual',
    severity: 'CRITICAL',
    penaltyDescription: 'Up to ₹5 lakh fine + imprisonment up to 6 months',
    imprisonmentRisk: true,
    licenseSuspensionRisk: true,
    sourceMetadata: {
      sourceName: 'Food Safety and Standards Act',
      actName: 'Food Safety and Standards Act, 2006',
      sectionNumber: 'Section 31',
      authority: 'Food Safety and Standards Authority of India (State)',
      effectiveDate: new Date('2006-08-23'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'FSSAI-002',
    title: 'Food Safety Supervisor Training',
    description: 'At least one trained Food Safety Supervisor is required per 25 food handlers.',
    complianceDomain: 'Food Safety',
    jurisdictionLevel: 'CENTRAL',
    regulator: 'FSSAI',
    applicabilityConditions: { industry: 'Food Processing', minTotalWorkers: 5 },
    requiredEvidence: ['FoSTaC Certificate', 'Supervisor ID Card'],
    complianceFrequency: 'One-time',
    severity: 'MEDIUM',
    penaltyDescription: 'Warning + ₹25,000 fine on repeat offense',
    imprisonmentRisk: false,
    licenseSuspensionRisk: false,
    sourceMetadata: {
      sourceName: 'FSS (Licensing and Registration of Food Businesses) Regulations',
      actName: 'Food Safety and Standards Act, 2006',
      sectionNumber: 'Regulation 2.1',
      authority: 'FSSAI (Central)',
      effectiveDate: new Date('2011-08-05'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'FACTORY-001',
    title: 'Factory License (Maharashtra)',
    description: 'All manufacturing premises employing 10+ workers with power (or 20+ without) must register under the Factories Act.',
    complianceDomain: 'Factory Safety',
    jurisdictionLevel: 'STATE',
    state: 'Maharashtra',
    regulator: 'DISH Maharashtra',
    applicabilityConditions: { state: 'Maharashtra', minTotalWorkers: 10 },
    requiredEvidence: ['Factory License Copy', 'Plan Approval', 'Stability Certificate'],
    complianceFrequency: 'Annual',
    severity: 'HIGH',
    penaltyDescription: 'Up to ₹2 lakh fine + closure order',
    imprisonmentRisk: true,
    licenseSuspensionRisk: true,
    sourceMetadata: {
      sourceName: 'Factories Act',
      actName: 'Factories Act, 1948',
      sectionNumber: 'Section 6',
      authority: 'DISH Maharashtra',
      effectiveDate: new Date('1948-09-23'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'BOILER-001',
    title: 'Boiler Inspector Certificate',
    description: 'Steam boilers used in food processing must be certified annually by the Inspector of Boilers.',
    complianceDomain: 'Factory Safety',
    jurisdictionLevel: 'STATE',
    state: 'Maharashtra',
    regulator: 'Directorate of Steam Boilers',
    applicabilityConditions: { boiler: true },
    requiredEvidence: ['Boiler Certificate', 'Insurance Policy', 'Fitness Certificate'],
    complianceFrequency: 'Annual',
    severity: 'HIGH',
    penaltyDescription: 'Immediate shutdown order + ₹50,000 fine',
    imprisonmentRisk: false,
    licenseSuspensionRisk: true,
    sourceMetadata: {
      sourceName: 'Boilers Act',
      actName: 'The Boilers Act, 1923',
      sectionNumber: 'Section 7',
      authority: 'Directorate of Steam Boilers',
      effectiveDate: new Date('1924-01-01'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'EPF-001',
    title: 'EPF Monthly Contribution',
    description: 'Establishments with 20+ employees must register and remit monthly EPF contributions.',
    complianceDomain: 'Labour',
    jurisdictionLevel: 'CENTRAL',
    regulator: 'EPFO',
    applicabilityConditions: { minTotalWorkers: 20 },
    requiredEvidence: ['ECR Challan', 'Monthly Return'],
    complianceFrequency: 'Monthly',
    severity: 'HIGH',
    penaltyDescription: '100% penalty on delayed remittance + criminal prosecution',
    imprisonmentRisk: true,
    licenseSuspensionRisk: false,
    sourceMetadata: {
      sourceName: 'EPF & MP Act',
      actName: 'Employees Provident Funds and Miscellaneous Provisions Act, 1952',
      sectionNumber: 'Section 6',
      authority: 'EPFO',
      effectiveDate: new Date('1952-03-04'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'ESIC-001',
    title: 'ESIC Registration & Contribution',
    description: 'Factories with 10+ employees (where wages ≤ ₹21,000/month) must register under ESI Act.',
    complianceDomain: 'Labour',
    jurisdictionLevel: 'CENTRAL',
    regulator: 'ESIC',
    applicabilityConditions: { minTotalWorkers: 10 },
    requiredEvidence: ['ESIC Registration Certificate', 'Monthly Contribution Challan'],
    complianceFrequency: 'Monthly',
    severity: 'MEDIUM',
    penaltyDescription: 'Up to 5% simple interest on delayed payment',
    imprisonmentRisk: false,
    licenseSuspensionRisk: false,
    sourceMetadata: {
      sourceName: 'ESI Act',
      actName: 'Employees State Insurance Act, 1948',
      sectionNumber: 'Section 38',
      authority: 'ESIC',
      effectiveDate: new Date('1948-04-19'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'MPCB-001',
    title: 'Consent to Establish & Operate (CTO)',
    description: 'Food processing units classified as Orange/Red category must obtain consent from MPCB before operating.',
    complianceDomain: 'Environmental',
    jurisdictionLevel: 'STATE',
    state: 'Maharashtra',
    regulator: 'MPCB',
    applicabilityConditions: { state: 'Maharashtra', effluent: true },
    requiredEvidence: ['CTO Certificate', 'Environmental Clearance', 'Effluent Test Reports'],
    complianceFrequency: 'Every 5 Years',
    severity: 'CRITICAL',
    penaltyDescription: 'Closure direction under Section 31A of Water Act',
    imprisonmentRisk: false,
    licenseSuspensionRisk: true,
    sourceMetadata: {
      sourceName: 'Water (Prevention and Control of Pollution) Act',
      actName: 'Water (Prevention and Control of Pollution) Act, 1974',
      sectionNumber: 'Section 25',
      authority: 'MPCB',
      effectiveDate: new Date('1974-03-23'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'MPCB-002',
    title: 'Hazardous Waste Authorization',
    description: 'Units generating hazardous waste must obtain authorization from MPCB.',
    complianceDomain: 'Environmental',
    jurisdictionLevel: 'STATE',
    state: 'Maharashtra',
    regulator: 'MPCB',
    applicabilityConditions: { hazardousWaste: true },
    requiredEvidence: ['HW Authorization', 'Manifest Forms', 'Annual Returns'],
    complianceFrequency: 'Every 5 Years',
    severity: 'HIGH',
    penaltyDescription: 'Up to ₹1 lakh per day of violation',
    imprisonmentRisk: false,
    licenseSuspensionRisk: false,
    sourceMetadata: {
      sourceName: 'Hazardous and Other Wastes Rules',
      actName: 'Environment (Protection) Act, 1986',
      sectionNumber: 'Rule 6',
      authority: 'MPCB',
      effectiveDate: new Date('2016-04-04'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'GST-001',
    title: 'GST Registration & Monthly Return',
    description: 'Businesses with turnover above ₹40 lakh (goods) or ₹20 lakh (services) must register.',
    complianceDomain: 'Tax & GST',
    jurisdictionLevel: 'CENTRAL',
    regulator: 'GST Department',
    applicabilityConditions: { hasGstOrTurnover: true },
    requiredEvidence: ['GSTIN Certificate', 'GSTR-3B Filing', 'GSTR-1 Filing'],
    complianceFrequency: 'Monthly',
    severity: 'MEDIUM',
    penaltyDescription: '₹10,000 per return or 10% of tax due (whichever is higher)',
    imprisonmentRisk: false,
    licenseSuspensionRisk: false,
    sourceMetadata: {
      sourceName: 'CGST Act',
      actName: 'Central Goods and Services Tax Act, 2017',
      sectionNumber: 'Section 22',
      authority: 'GST Council / CBIC',
      effectiveDate: new Date('2017-07-01'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'CLRA-001',
    title: 'Contract Labour License',
    description: 'Principal employers engaging 20+ contract workers must obtain a license.',
    complianceDomain: 'Labour',
    jurisdictionLevel: 'STATE',
    state: 'Maharashtra',
    regulator: 'Labour Commissioner',
    applicabilityConditions: { minContractWorkers: 20 },
    requiredEvidence: ['CLRA License', 'Contractor Register', 'Wage Register'],
    complianceFrequency: 'Annual',
    severity: 'MEDIUM',
    penaltyDescription: 'Up to ₹1,000 fine per day of contravention',
    imprisonmentRisk: false,
    licenseSuspensionRisk: false,
    sourceMetadata: {
      sourceName: 'CLRA Act',
      actName: 'Contract Labour (Regulation and Abolition) Act, 1970',
      sectionNumber: 'Section 7',
      authority: 'Labour Commissioner',
      effectiveDate: new Date('1970-09-05'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'COLD-001',
    title: 'Cold Storage License',
    description: 'Cold storage facilities for food products require specific licensing under the Cold Storage Order.',
    complianceDomain: 'Food Safety',
    jurisdictionLevel: 'STATE',
    state: 'Maharashtra',
    regulator: 'Agricultural Marketing Department',
    applicabilityConditions: { coldStorage: true },
    requiredEvidence: ['Cold Storage License', 'Temperature Log Records'],
    complianceFrequency: 'Annual',
    severity: 'MEDIUM',
    penaltyDescription: 'Suspension of operations',
    imprisonmentRisk: false,
    licenseSuspensionRisk: true,
    sourceMetadata: {
      sourceName: 'Cold Storage Order',
      actName: 'Essential Commodities Act, 1955',
      sectionNumber: 'Clause 3',
      authority: 'Agricultural Marketing Department',
      effectiveDate: new Date('1980-01-01'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  },
  {
    ruleCode: 'PLASTIC-001',
    title: 'Extended Producer Responsibility (EPR)',
    description: 'Producers/importers/brand owners using plastic packaging must obtain EPR authorization.',
    complianceDomain: 'Environmental',
    jurisdictionLevel: 'CENTRAL',
    regulator: 'CPCB',
    applicabilityConditions: { plasticPackaging: true },
    requiredEvidence: ['EPR Certificate', 'Annual Filing'],
    complianceFrequency: 'Annual',
    severity: 'MEDIUM',
    penaltyDescription: 'Environmental compensation + cancellation of consent',
    imprisonmentRisk: false,
    licenseSuspensionRisk: true,
    sourceMetadata: {
      sourceName: 'Plastic Waste Management Rules',
      actName: 'Environment (Protection) Act, 1986',
      sectionNumber: 'Rule 9',
      authority: 'CPCB',
      effectiveDate: new Date('2016-03-18'),
      officialUrl: 'NOT AVAILABLE IN GAWK',
      verificationStatus: 'VERIFIED'
    }
  }
];

async function migrate() {
  if (mongoose.connection.readyState !== 1) {
    console.log('Connecting to DB for rule migration...');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/surakshasetu';
    await mongoose.connect(uri);
  }

  console.log('Clearing old configurable rules...');
  await RulePack.deleteMany({});
  await ComplianceRule.deleteMany({});
  await RegulatorySource.deleteMany({});

  console.log('Creating Prototype Rule Pack...');
  const pack = new RulePack({
    name: 'Maharashtra Food Processing Prototype Rule Pack',
    description: 'The 12 original prototype rules migrated to the new configurable architecture.',
    state: 'Maharashtra',
    industry: 'Food Processing',
    active: true
  });
  await pack.save();

  console.log('Migrating 12 original rules with Regulatory Sources...');
  for (const ruleData of originalRules) {
    let sourceId = null;
    if (ruleData.sourceMetadata) {
      const source = new RegulatorySource({
        ...ruleData.sourceMetadata,
        regulator: ruleData.regulator,
        jurisdiction: ruleData.jurisdictionLevel
      });
      await source.save();
      sourceId = source._id;
      // also attach fields to the rule itself as requested by ComplianceRuleSchema
      ruleData.sourceName = ruleData.sourceMetadata.sourceName;
      ruleData.authority = ruleData.sourceMetadata.authority;
      ruleData.actName = ruleData.sourceMetadata.actName;
      ruleData.section = ruleData.sourceMetadata.sectionNumber;
      ruleData.sourceUrl = ruleData.sourceMetadata.officialUrl;
      ruleData.verificationStatus = ruleData.sourceMetadata.verificationStatus;
    }
    
    const rule = new ComplianceRule({
      ...ruleData,
      regulatorySource: sourceId,
      status: 'ACTIVE'
    });
    await rule.save();
    console.log(`Migrated ${rule.ruleCode}`);
  }

  console.log('Migration complete.');

  console.log('Checking for demo user...');
  let demoUser = await User.findOne({ email: 'test@example.com' });
  if (!demoUser) {
    console.log('Creating demo user test@example.com');
    demoUser = new User({
      name: 'Demo User',
      email: 'test@example.com',
      password: 'password123',
      role: 'OWNER'
    });
    await demoUser.save();
  }

  let demoBusiness = await Business.findOne({ user: demoUser._id });
  if (!demoBusiness) {
    console.log('Creating demo business profile...');
    demoBusiness = new Business({
      user: demoUser._id,
      entityType: 'Private Limited Company',
      industry: 'Food Processing',
      state: 'Maharashtra',
      totalWorkers: 25,
      contractWorkers: 8,
      boiler: true,
      coldStorage: true,
      effluent: true,
      hazardousWaste: true,
      plasticPackaging: true,
      packagedRetail: true,
      gstin: '27AAAAA0000A1Z5'
    });
    await demoBusiness.save();
    
    demoUser.business = demoBusiness._id;
    await demoUser.save();
  }
}

// Allow running from CLI directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = migrate;
