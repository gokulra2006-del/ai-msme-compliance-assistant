/**
 * Company-details import for the onboarding profile.
 *
 * The option vocabularies below are the single source of truth: the onboarding
 * `<select>` elements render from them and the importer resolves against them.
 * A value this module returns is therefore always selectable in the form — the
 * previous importer wrote free text that matched no `<option>`, so the field
 * silently stayed blank.
 *
 * Nothing here decides a compliance obligation. It only maps what the user
 * pasted onto the profile vocabulary the rules engine already expects, and
 * reports anything it could not map rather than guessing.
 */

export interface ImportOption {
  /** Canonical value stored on the profile and sent to the backend. */
  value: string;
  labelKey: string;
  labelFallback: string;
  /** Shorthand and common spellings that resolve to this value. */
  aliases?: string[];
}

export const ENTITY_TYPES: ImportOption[] = [
  {
    value: 'Proprietorship',
    labelKey: 'form.entity.proprietorship',
    labelFallback: 'Proprietorship',
    aliases: ['sole proprietorship', 'sole proprietor', 'proprietor', 'prop', 'individual']
  },
  {
    value: 'Partnership',
    labelKey: 'form.entity.partnership',
    labelFallback: 'Partnership',
    aliases: ['partnership firm', 'firm', 'general partnership']
  },
  {
    value: 'Private Limited',
    labelKey: 'form.entity.privateLimited',
    labelFallback: 'Private Limited',
    aliases: ['pvt ltd', 'pvt. ltd.', 'private ltd', 'private limited company', 'pvt', 'company']
  },
  {
    value: 'LLP',
    labelKey: 'form.entity.llp',
    labelFallback: 'LLP',
    aliases: ['limited liability partnership']
  }
];

export const TURNOVER_BANDS: ImportOption[] = [
  {
    value: '< 5Cr',
    labelKey: 'form.turnover.below5',
    labelFallback: 'Below ₹5 Crore',
    aliases: ['below 5cr', 'under 5cr', 'less than 5cr', 'upto 5cr', 'up to 5cr', '<5cr']
  },
  {
    value: '5-50Cr',
    labelKey: 'form.turnover.5to50',
    labelFallback: '₹5 - ₹50 Crore',
    aliases: ['5 to 50cr', '5-50 cr', 'between 5 and 50cr', '5cr to 50cr']
  },
  {
    value: '> 50Cr',
    labelKey: 'form.turnover.above50',
    labelFallback: 'Above ₹50 Crore',
    aliases: ['above 50cr', 'more than 50cr', 'over 50cr', 'greater than 50cr', '>50cr']
  }
];

export const INDUSTRIES: ImportOption[] = [
  {
    value: 'Food Processing',
    labelKey: 'form.ind.food',
    labelFallback: 'Food Processing',
    aliases: ['food', 'food and beverage', 'fnb', 'f&b', 'food manufacturing', 'food processing unit']
  },
  {
    value: 'Manufacturing',
    labelKey: 'form.ind.mfg',
    labelFallback: 'Manufacturing',
    aliases: ['mfg', 'manufacture', 'production', 'industrial']
  },
  {
    value: 'IT / Software',
    labelKey: 'form.ind.it',
    labelFallback: 'IT / Software',
    aliases: ['it', 'software', 'information technology', 'it services', 'saas', 'technology']
  },
  {
    value: 'Retail',
    labelKey: 'form.ind.retail',
    labelFallback: 'Retail',
    aliases: ['trading', 'shop', 'store', 'wholesale']
  },
  {
    value: 'Healthcare',
    labelKey: 'form.ind.health',
    labelFallback: 'Healthcare',
    aliases: ['health', 'medical', 'pharma', 'pharmaceutical', 'hospital', 'clinic']
  }
];

export const FOOD_CATEGORIES: ImportOption[] = [
  {
    value: 'Spices and Condiments',
    labelKey: 'form.food.spices',
    labelFallback: 'Spices and Condiments',
    aliases: ['spices', 'condiments', 'masala']
  },
  {
    value: 'Packaged Foods',
    labelKey: 'form.food.packaged',
    labelFallback: 'Packaged Foods',
    aliases: ['packaged food', 'packaged']
  },
  {
    value: 'Dairy Products',
    labelKey: 'form.food.dairy',
    labelFallback: 'Dairy Products',
    aliases: ['dairy', 'milk', 'milk products']
  },
  {
    value: 'Ready to Eat',
    labelKey: 'form.food.rte',
    labelFallback: 'Ready to Eat',
    aliases: ['rte', 'ready-to-eat', 'ready meals']
  },
  {
    value: 'Bakery Products',
    labelKey: 'form.food.bakery',
    labelFallback: 'Bakery Products',
    aliases: ['bakery', 'bread', 'confectionery']
  },
  {
    value: 'Beverages',
    labelKey: 'form.food.beverages',
    labelFallback: 'Beverages',
    aliases: ['beverage', 'drinks', 'juice', 'water']
  }
];

/* ============================================================
   Value resolution
   ============================================================ */

/** Strips punctuation, spacing and case so "Pvt. Ltd." and "pvt ltd" compare equal. */
const norm = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Resolves pasted text onto one canonical option.
 *
 * Exact matches (value, English label, alias) are tried first. Only then does it
 * fall back to containment, longest candidate first so "private limited company"
 * cannot be claimed by a shorter key. Containment keys shorter than 4 characters
 * are excluded — short tokens such as "it" belong in `aliases`, where they match
 * exactly, rather than matching loosely inside unrelated words.
 */
export const matchOption = (options: ImportOption[], raw: unknown): string | null => {
  if (raw === undefined || raw === null) return null;
  const needle = norm(String(raw));
  if (!needle) return null;

  for (const option of options) {
    const exact = [option.value, option.labelFallback, ...(option.aliases || [])];
    if (exact.some(candidate => norm(candidate) === needle)) return option.value;
  }

  const candidates = options
    .flatMap(option =>
      [option.value, option.labelFallback, ...(option.aliases || [])].map(text => ({
        value: option.value,
        key: norm(text)
      }))
    )
    .filter(candidate => candidate.key.length >= 4)
    .sort((a, b) => b.key.length - a.key.length);

  for (const candidate of candidates) {
    if (needle.includes(candidate.key)) return candidate.value;
  }
  return null;
};

/** Same two-pass resolution against a plain list, for states, districts and cities. */
export const matchFromList = (list: string[], raw: unknown): string | null => {
  if (raw === undefined || raw === null) return null;
  const needle = norm(String(raw));
  if (!needle) return null;

  const exact = list.find(item => norm(item) === needle);
  if (exact) return exact;

  return (
    [...list]
      .filter(item => norm(item).length >= 4)
      .sort((a, b) => norm(b).length - norm(a).length)
      .find(item => needle.includes(norm(item))) || null
  );
};

const bandForCrore = (crore: number): string => {
  if (crore > 50) return '> 50Cr';
  if (crore >= 5) return '5-50Cr';
  return '< 5Cr';
};

/**
 * Resolves a turnover figure or band onto one of the three options.
 *
 * A range is tested before a bare number, because "5-50Cr" describes the middle
 * band — reading the first number it finds would have classified it as "< 5Cr",
 * and matching on the substring "50" first (as the previous version did) made
 * the app's own placeholder example import as "> 50Cr".
 */
export const resolveTurnoverBand = (raw: unknown): string | null => {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? bandForCrore(raw) : null;

  const text = String(raw).trim();
  if (!text) return null;

  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)/i);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (high > 50) return '> 50Cr';
    if (high <= 5 && low < 5) return '< 5Cr';
    return '5-50Cr';
  }

  const named = matchOption(TURNOVER_BANDS, text);
  if (named) return named;

  const single = text.match(/(\d+(?:\.\d+)?)/);
  if (single) {
    const amount = Number(single[1]);
    if (!Number.isFinite(amount)) return null;
    // "12Cr" and a bare "12" are read as crore; a large bare figure as rupees.
    const crore = /cr|crore/i.test(text) || amount < 10000 ? amount : amount / 1e7;
    return bandForCrore(crore);
  }
  return null;
};

const TRUE_WORDS = ['true', 'yes', 'y', '1', 'active', 'registered', 'available', 'present', 'have', 'has', 'applicable'];
const FALSE_WORDS = ['false', 'no', 'n', '0', 'inactive', 'notregistered', 'unregistered', 'none', 'nil', 'absent', 'notapplicable', 'na'];

/**
 * Resolves a yes/no answer. Returns null for anything unrecognised, so an
 * unparseable answer stays "Unknown / Skip" instead of becoming a silent `true`
 * that the compliance engine would act on. (The previous version fell back to
 * `Boolean(value)`, which turned any stray word into "yes".)
 */
export const resolveBoolean = (raw: unknown): boolean | null => {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  const value = norm(String(raw));
  if (!value) return null;
  if (TRUE_WORDS.includes(value)) return true;
  if (FALSE_WORDS.includes(value)) return false;
  return null;
};

/** Resolves a worker count, tolerating text such as "42 employees". */
export const resolveCount = (raw: unknown): number | null => {
  if (raw === undefined || raw === null || raw === '') return null;
  const numeric = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
};

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/* ============================================================
   Parsing
   ============================================================ */

/**
 * Reads `Key: value` pairs. Splits on newlines and semicolons only — commas are
 * left alone so a value may contain one.
 */
const parseKeyValueText = (rawText: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  rawText
    .split(/[\n;]+/)
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const match = line.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
      if (!match) return;
      const key = match[1].trim().replace(/\s+/g, ' ');
      const value = match[2].trim();
      if (key && value) parsed[key] = value;
    });
  return parsed;
};

/** Field aliases accepted for each profile field, in addition to its own name. */
const FIELD_ALIASES: Record<string, string[]> = {
  entityType: ['entityType', 'businessEntity', 'legalEntity', 'companyType', 'entity', 'organizationType', 'constitution'],
  industry: ['industry', 'sector', 'businessIndustry', 'businessSector', 'businessType'],
  subIndustry: ['subIndustry', 'businessSubIndustry', 'subIndustryType', 'subSector'],
  foodProductCategory: ['foodProductCategory', 'foodCategory', 'productCategory'],
  annualTurnoverBand: ['annualTurnoverBand', 'annualTurnover', 'turnoverBand', 'turnover', 'turnoverRange', 'revenue'],
  state: ['state', 'stateName'],
  district: ['district', 'districtName'],
  city: ['city', 'cityName', 'locationCity', 'town'],
  municipality: ['municipality', 'municipalCouncil', 'localBody', 'municipalCorporation'],
  gstin: ['gstin', 'gstNumber', 'gstNo', 'gst', 'gstRegistrationNumber', 'gstinNumber'],
  gstRegistrationStatus: ['gstRegistrationStatus', 'gstRegistered', 'hasGST', 'hasGSTIN', 'isGstRegistered'],
  udyamRegistration: ['udyamRegistration', 'udyamNo', 'udyamRegistrationNumber', 'udyam', 'udyamNumber'],
  udyamRegistrationStatus: ['udyamRegistrationStatus', 'udyamRegistered', 'hasUdyam', 'isUdyamRegistered', 'msmeRegistered'],
  totalWorkers: ['totalWorkers', 'employees', 'employeeCount', 'totalEmployees', 'headcount', 'workers'],
  onRollWorkers: ['onRollWorkers', 'onRollEmployees', 'permanentWorkers', 'permanentEmployees'],
  contractWorkers: ['contractWorkers', 'contractualWorkers', 'temporaryWorkers', 'contractLabour'],
  womenWorkers: ['womenWorkers', 'femaleWorkers', 'womenEmployees'],
  factoryStatus: ['factoryStatus', 'hasFactory', 'factory', 'manufacturingUnit'],
  nightShift: ['nightShift', 'nightShiftOperations', 'hasNightShift'],
  boiler: ['boiler', 'usesBoiler', 'steamBoiler'],
  coldStorage: ['coldStorage', 'coldStorageFacility', 'hasColdStorage'],
  effluent: ['effluent', 'generatesEffluent', 'hasEffluent', 'effluents'],
  hazardousWaste: ['hazardousWaste', 'hasHazardousWaste', 'hazardousWasteGeneration'],
  plasticPackaging: ['plasticPackaging', 'usesPlasticPackaging', 'hasPlasticPackaging', 'plastic'],
  packagedRetail: ['packagedRetail', 'retailPackaging', 'hasPackagedRetail', 'packagedForRetail'],
  dairy: ['dairy', 'dairyProducts', 'hasDairy'],
  importActivity: ['importActivity', 'imports', 'hasImportActivity', 'importExport'],
  exportActivity: ['exportActivity', 'exports', 'hasExportActivity'],
  ecommerceActivity: ['ecommerceActivity', 'eCommerceActivity', 'onlineSales', 'ecommerce'],
  commercialEstablishmentStatus: ['commercialEstablishmentStatus', 'commercialEstablishment', 'hasCommercialEstablishment', 'shopEstablishment']
};

/** Human labels for the import summary, keyed to the form's own label keys. */
const FIELD_LABELS: Record<string, { key: string; fallback: string }> = {
  entityType: { key: 'form.entityType', fallback: 'Entity Type' },
  industry: { key: 'form.industry', fallback: 'Industry' },
  subIndustry: { key: 'form.subIndustry', fallback: 'Sub Industry' },
  foodProductCategory: { key: 'form.foodCategory', fallback: 'Food Product Category' },
  annualTurnoverBand: { key: 'form.annualTurnover', fallback: 'Annual Turnover' },
  state: { key: 'form.state', fallback: 'State' },
  district: { key: 'form.district', fallback: 'District' },
  city: { key: 'form.city', fallback: 'City' },
  municipality: { key: 'form.municipality', fallback: 'Municipality' },
  gstin: { key: 'form.gstin', fallback: 'GSTIN' },
  gstRegistrationStatus: { key: 'form.gstReg', fallback: 'GST Registered?' },
  udyamRegistration: { key: 'form.udyamNo', fallback: 'Udyam Registration Number' },
  udyamRegistrationStatus: { key: 'form.udyamReg', fallback: 'Udyam Registered?' },
  totalWorkers: { key: 'form.totalWorkers', fallback: 'Total Workers' },
  onRollWorkers: { key: 'form.onRollWorkers', fallback: 'On-roll Workers' },
  contractWorkers: { key: 'form.contractWorkers', fallback: 'Contract Workers' },
  womenWorkers: { key: 'form.womenWorkers', fallback: 'Women Workers' },
  factoryStatus: { key: 'form.factory', fallback: 'Factory' },
  nightShift: { key: 'form.nightShift', fallback: 'Night Shift Operations?' },
  boiler: { key: 'form.boiler', fallback: 'Uses Steam Boiler?' },
  coldStorage: { key: 'form.coldStorage', fallback: 'Cold Storage Facility?' },
  effluent: { key: 'form.effluent', fallback: 'Generates Effluents?' },
  hazardousWaste: { key: 'form.hazardousWaste', fallback: 'Hazardous Waste?' },
  plasticPackaging: { key: 'form.plastic', fallback: 'Plastic Packaging?' },
  packagedRetail: { key: 'form.retail', fallback: 'Packaged for Retail?' },
  dairy: { key: 'form.dairy', fallback: 'Dairy Products?' },
  importActivity: { key: 'form.importExport', fallback: 'Import Activity?' },
  exportActivity: { key: 'form.exportActivity', fallback: 'Export Activity?' },
  ecommerceActivity: { key: 'form.ecommerce', fallback: 'E-commerce Activity?' },
  commercialEstablishmentStatus: { key: 'form.commercialEstablishment', fallback: 'Commercial Establishment?' }
};

const BOOLEAN_FIELDS = [
  'factoryStatus', 'nightShift', 'boiler', 'coldStorage', 'effluent', 'hazardousWaste',
  'plasticPackaging', 'packagedRetail', 'dairy', 'importActivity', 'exportActivity',
  'ecommerceActivity', 'commercialEstablishmentStatus'
];

const COUNT_FIELDS = ['totalWorkers', 'onRollWorkers', 'contractWorkers', 'womenWorkers'];

export interface FilledField {
  field: string;
  labelKey: string;
  labelFallback: string;
  display: string;
}

export interface UnresolvedField {
  field: string;
  labelKey: string;
  labelFallback: string;
  raw: string;
  reason: string;
}

export interface ImportResult {
  /** Values to merge into the form. Only fields that resolved are present. */
  values: Record<string, any>;
  filled: FilledField[];
  /** Recognised field, unusable value — reported instead of being dropped. */
  unresolved: UnresolvedField[];
  /** Keys in the paste that match no profile field. */
  unknownKeys: string[];
  warnings: string[];
  error: string | null;
}

export interface ImportContext {
  stateNames: string[];
  districtsForState: (state: string) => string[];
  citiesForState: (state: string) => string[];
}

const labelFor = (field: string) =>
  FIELD_LABELS[field] || { key: `form.${field}`, fallback: field };

/**
 * Parses pasted JSON or `Key: value` text into profile values.
 *
 * Every field is either resolved to a value the form can display, or reported —
 * as `unresolved` when the field was recognised but the value was not, or as an
 * `unknownKey` when nothing claimed the key at all. Nothing is dropped silently.
 */
export const parseCompanyImport = (rawData: string, ctx: ImportContext): ImportResult => {
  const result: ImportResult = {
    values: {},
    filled: [],
    unresolved: [],
    unknownKeys: [],
    warnings: [],
    error: null
  };

  if (!rawData || !rawData.trim()) {
    result.error = 'Please paste company details first.';
    return result;
  }

  let source: any;
  const trimmed = rawData.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      source = JSON.parse(trimmed);
    } catch {
      result.error = 'That looks like JSON but could not be parsed. Check for a missing comma, quote or brace.';
      return result;
    }
    if (Array.isArray(source)) source = source[0];
  } else {
    source = parseKeyValueText(trimmed);
  }

  if (!source || typeof source !== 'object' || Object.keys(source).length === 0) {
    result.error =
      'Could not read any details. Use one "Field: value" pair per line, or paste a JSON object.';
    return result;
  }

  const sourceKeys = Object.keys(source);
  const consumedKeys = new Set<string>();

  /** Looks up a field's value by any of its aliases, recording the key it used. */
  const take = (field: string): { raw: any; key: string } | null => {
    const aliases = FIELD_ALIASES[field] || [field];
    for (const alias of aliases) {
      const target = norm(alias);
      for (const sourceKey of sourceKeys) {
        if (norm(sourceKey) !== target) continue;
        consumedKeys.add(sourceKey);
        const raw = source[sourceKey];
        if (raw === undefined || raw === null || raw === '') return null;
        return { raw, key: sourceKey };
      }
    }
    return null;
  };

  const accept = (field: string, value: any, display: string) => {
    result.values[field] = value;
    const label = labelFor(field);
    result.filled.push({ field, labelKey: label.key, labelFallback: label.fallback, display });
  };

  const reject = (field: string, raw: any, reason: string) => {
    const label = labelFor(field);
    result.unresolved.push({
      field,
      labelKey: label.key,
      labelFallback: label.fallback,
      raw: String(raw),
      reason
    });
  };

  /** Resolves against an option vocabulary, so the value is always selectable. */
  const applyOption = (field: string, options: ImportOption[]) => {
    const found = take(field);
    if (!found) return;
    const value = matchOption(options, found.raw);
    if (value) accept(field, value, value);
    else reject(field, found.raw, `Not one of: ${options.map(o => o.value).join(', ')}`);
  };

  const applyText = (field: string, transform?: (value: string) => string) => {
    const found = take(field);
    if (!found) return;
    const value = transform ? transform(String(found.raw).trim()) : String(found.raw).trim();
    if (value) accept(field, value, value);
  };

  // --- Business basics ---
  applyOption('entityType', ENTITY_TYPES);
  applyOption('industry', INDUSTRIES);
  applyText('subIndustry');

  const turnover = take('annualTurnoverBand');
  if (turnover) {
    const band = resolveTurnoverBand(turnover.raw);
    if (band) accept('annualTurnoverBand', band, band);
    else reject('annualTurnoverBand', turnover.raw, 'Could not read a turnover figure or band');
  }

  // Only offered by the form when the industry is Food Processing, so it is
  // applied only when that holds — otherwise it would be submitted unseen.
  const foodCategory = take('foodProductCategory');
  if (foodCategory) {
    const value = matchOption(FOOD_CATEGORIES, foodCategory.raw);
    if (!value) {
      reject('foodProductCategory', foodCategory.raw, `Not one of: ${FOOD_CATEGORIES.map(o => o.value).join(', ')}`);
    } else if (result.values.industry === 'Food Processing') {
      accept('foodProductCategory', value, value);
    } else {
      reject('foodProductCategory', foodCategory.raw, 'Only applies when Industry is Food Processing');
    }
  }

  // --- Location: resolved against the same lists the dropdowns render ---
  const state = take('state');
  let resolvedState = '';
  if (state) {
    const value = matchFromList(ctx.stateNames, state.raw);
    if (value) {
      resolvedState = value;
      accept('state', value, value);
    } else {
      reject('state', state.raw, 'Not a recognised Indian state or union territory');
    }
  }

  const district = take('district');
  if (district) {
    if (!resolvedState) {
      reject('district', district.raw, 'A recognised State is needed first');
    } else {
      const value = matchFromList(ctx.districtsForState(resolvedState), district.raw);
      if (value) accept('district', value, value);
      else reject('district', district.raw, `Not a district of ${resolvedState}`);
    }
  }

  const city = take('city');
  if (city) {
    if (!resolvedState) {
      reject('city', city.raw, 'A recognised State is needed first');
    } else {
      const value = matchFromList(ctx.citiesForState(resolvedState), city.raw);
      if (value) accept('city', value, value);
      else reject('city', city.raw, `Not a city listed under ${resolvedState}`);
    }
  }

  applyText('municipality');

  // --- Registrations ---
  const gstin = take('gstin');
  if (gstin) {
    const value = String(gstin.raw).trim().toUpperCase().replace(/\s+/g, '');
    accept('gstin', value, value);
    // Holding a GSTIN is what the flag records, so it follows the number.
    accept('gstRegistrationStatus', true, 'Yes');
    if (!GSTIN_PATTERN.test(value)) {
      result.warnings.push(`GSTIN "${value}" does not match the 15-character GSTIN format — check it before continuing.`);
    }
  }

  const gstStatus = take('gstRegistrationStatus');
  if (gstStatus) {
    const value = resolveBoolean(gstStatus.raw);
    if (value === null) reject('gstRegistrationStatus', gstStatus.raw, 'Expected yes or no');
    else if (result.values.gstin === undefined) accept('gstRegistrationStatus', value, value ? 'Yes' : 'No');
    else if (value === false) {
      result.warnings.push('A GSTIN was given but GST registration was marked "no" — kept as registered. Remove the GSTIN if that is wrong.');
    }
  }

  const udyam = take('udyamRegistration');
  if (udyam) {
    const value = String(udyam.raw).trim().toUpperCase();
    accept('udyamRegistration', value, value);
    accept('udyamRegistrationStatus', true, 'Yes');
  }

  const udyamStatus = take('udyamRegistrationStatus');
  if (udyamStatus) {
    const value = resolveBoolean(udyamStatus.raw);
    if (value === null) reject('udyamRegistrationStatus', udyamStatus.raw, 'Expected yes or no');
    else if (result.values.udyamRegistration === undefined) {
      accept('udyamRegistrationStatus', value, value ? 'Yes' : 'No');
    } else if (value === false) {
      result.warnings.push('A Udyam number was given but Udyam registration was marked "no" — kept as registered. Remove the number if that is wrong.');
    }
  }

  // --- Workforce ---
  COUNT_FIELDS.forEach(field => {
    const found = take(field);
    if (!found) return;
    const value = resolveCount(found.raw);
    if (value === null) reject(field, found.raw, 'Expected a whole number of workers');
    else accept(field, value, String(value));
  });

  // --- Operations ---
  BOOLEAN_FIELDS.forEach(field => {
    const found = take(field);
    if (!found) return;
    const value = resolveBoolean(found.raw);
    if (value === null) reject(field, found.raw, 'Expected yes or no');
    else accept(field, value, value ? 'Yes' : 'No');
  });

  result.unknownKeys = sourceKeys.filter(key => !consumedKeys.has(key));

  if (result.filled.length === 0 && result.unresolved.length === 0) {
    result.error =
      'None of those field names were recognised. Try names such as Industry, State, GSTIN, Annual Turnover or Total Workers.';
  }

  // Contract workers above the total would be blocked at Step 3; flag it now.
  const total = result.values.totalWorkers;
  const contract = result.values.contractWorkers;
  if (typeof total === 'number' && typeof contract === 'number' && contract > total) {
    result.warnings.push(`Contract workers (${contract}) exceed total workers (${total}).`);
  }

  return result;
};
