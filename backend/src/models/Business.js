const mongoose = require('mongoose');
require('./Obligation');
const BusinessSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Basic Info
  entityType: { type: String }, // e.g., Proprietorship, Private Limited
  udyamRegistration: { type: String },
  udyamRegistrationStatus: { type: Boolean },
  pan: { type: String },
  gstin: { type: String },
  gstRegistrationStatus: { type: Boolean },
  
  // Location
  state: { type: String },
  district: { type: String },
  taluka: { type: String },
  city: { type: String },
  municipality: { type: String },
  municipalMidcArea: { type: String },
  
  // Industry & Category
  industry: { type: String },
  subIndustry: { type: String },
  foodProductCategory: { type: String },
  
  // Operations (Booleans without defaults to support INSUFFICIENT_DATA)
  packagedRetail: { type: Boolean },
  dairy: { type: Boolean },
  rte: { type: Boolean }, // Ready to eat
  factoryStatus: { type: Boolean },
  boiler: { type: Boolean },
  coldStorage: { type: Boolean },
  effluent: { type: Boolean },
  solidWaste: { type: Boolean },
  hazardousWaste: { type: Boolean },
  plasticPackaging: { type: Boolean },
  importActivity: { type: Boolean },
  exportActivity: { type: Boolean },
  ecommerceActivity: { type: Boolean },
  commercialEstablishmentStatus: { type: Boolean },
  nightShift: { type: Boolean },
  
  // Financials
  annualTurnoverBand: { type: String }, // e.g., < 5Cr, 5-50Cr, > 50Cr
  interstateSales: { type: Boolean },
  export: { type: Boolean },
  
  // Labour
  totalWorkers: { type: Number, min: 0 },
  onRollWorkers: { type: Number, min: 0 },
  contractWorkers: { type: Number, min: 0 },
  womenWorkers: { type: Number, min: 0 },
  contractorCount: { type: Number, min: 0 },
  
  // Factory/Equipment (Legacy numeric/string fields)
  connectedLoad: { type: Number }, // in kW or HP
  boilerCapacity: { type: Number },
  machinery: { type: String },
  
  // Environmental (Legacy numeric/string fields)
  waterSource: { type: String },
  waterConsumption: { type: Number }, // LLD
  
  // Store result from eligibility engine
  applicableObligations: [{
    obligation: { type: mongoose.Schema.Types.ObjectId, ref: 'Obligation' },
    status: { type: String, enum: ['APPLIES', 'DOES_NOT_APPLY', 'INSUFFICIENT_DATA'] }
  }],
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Business', BusinessSchema);