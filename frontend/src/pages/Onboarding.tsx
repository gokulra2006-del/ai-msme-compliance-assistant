import React, { useState, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../context/LanguageContext';
import { State, City } from 'country-state-city';
import indianDistricts from '../data/indianDistricts.json';
import {
  parseCompanyImport,
  GSTIN_PATTERN,
  ENTITY_TYPES,
  TURNOVER_BANDS,
  INDUSTRIES,
  FOOD_CATEGORIES
} from '../data/companyImport';
import type { ImportResult } from '../data/companyImport';
import { Upload, FileText, Loader2 } from 'lucide-react';

const API = 'http://localhost:5000/api';

/**
 * Shown as the placeholder and filled in by "Fill in an example". One constant
 * for both, so the sample the hint promises is exactly the sample the button
 * pastes.
 */
const EXAMPLE_IMPORT = [
  'GSTIN: 27AAACR5055K1Z5',
  'State: Maharashtra',
  'Industry: Food Processing',
  'Annual Turnover: 5-50Cr'
].join('\n');

/**
 * The profile fields this wizard owns, and the shape the deterministic engine
 * reads. Declared at module scope for two reasons: the payload sent to the API
 * can be narrowed to exactly these keys, and the list cannot drift from the
 * form's own initial state.
 */
const INITIAL_FORM = {
  // Step 1: Business Basics
  entityType: '',
  industry: '',
  subIndustry: '',
  foodProductCategory: '',
  annualTurnoverBand: '',

  // Step 2: Location & Registration
  state: '',
  district: '',
  city: '',
  municipality: '',
  gstRegistrationStatus: null as boolean | null,
  gstin: '',
  udyamRegistrationStatus: null as boolean | null,
  udyamRegistration: '',

  // Step 3: Workforce & Operations
  totalWorkers: 0,
  onRollWorkers: 0,
  contractWorkers: 0,
  womenWorkers: 0,

  // Operations (boolean|null for tristate)
  factoryStatus: null as boolean | null,
  nightShift: null as boolean | null,
  boiler: null as boolean | null,
  coldStorage: null as boolean | null,
  effluent: null as boolean | null,
  hazardousWaste: null as boolean | null,
  plasticPackaging: null as boolean | null,
  packagedRetail: null as boolean | null,
  dairy: null as boolean | null,
  importActivity: null as boolean | null,
  exportActivity: null as boolean | null,
  ecommerceActivity: null as boolean | null,
  commercialEstablishmentStatus: null as boolean | null
};

type ProfileForm = typeof INITIAL_FORM;

const PROFILE_FIELDS = Object.keys(INITIAL_FORM) as Array<keyof ProfileForm>;

/**
 * Narrows an object to the profile fields alone. The saved Business document is
 * merged into the form on load, which brings `_id`, `user`, `__v` and
 * `applicableObligations` with it; posting those back is rejected by Mongoose.
 */
const toProfilePayload = (source: Record<string, any>): Record<string, any> => {
  const payload: Record<string, any> = {};
  PROFILE_FIELDS.forEach(field => {
    const value = source[field as string];
    // `null` is meaningful — it is the tri-state "unknown", which the engine
    // reads as INSUFFICIENT_DATA rather than as a negative answer. Only
    // genuinely absent keys are dropped.
    if (value !== undefined) payload[field as string] = value;
  });
  return payload;
};

/**
 * The checks the API enforces as well, applied before any save so an invalid
 * paste is reported here instead of coming back as a 400.
 */
const validateProfile = (data: ProfileForm): string | null => {
  if (data.gstin && !GSTIN_PATTERN.test(data.gstin)) return 'Invalid GSTIN format.';
  if (data.totalWorkers < 0 || data.contractWorkers < 0) return 'Worker counts cannot be negative.';
  if (data.contractWorkers > data.totalWorkers) return 'Contract workers cannot exceed total workers.';
  return null;
};

/** What the engine reports after evaluating the saved profile. */
interface EngineSummary {
  applies: number;
  insufficientData: number;
  total: number;
}

const Onboarding = () => {
  const { token } = useContext(AuthContext);
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // Step 0 is Language Selection
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyImportText, setCompanyImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [engineResult, setEngineResult] = useState<EngineSummary | null>(null);

  const [form, setForm] = useState<ProfileForm>(INITIAL_FORM);

  // File upload for Import data
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  /**
   * Reads a file the user selected, extracts its text, and feeds it into
   * the existing parseCompanyImport() pipeline. Supports PDF (text-only),
   * plain text, JSON, and DOCX (extracted as raw XML text, which still
   * contains the key-value content the parser needs).
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setFileUploading(true);
    setError('');
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string) || '');
        reader.onerror = () => reject(new Error('Could not read file.'));
        // PDF: read as text (works for text-based PDFs; binary PDFs return garbled but parser handles gracefully)
        reader.readAsText(file);
      });
      setCompanyImportText(text.slice(0, 4000)); // Show a snippet in the textarea
      await applyCompanyImport(text);
    } catch (err: any) {
      setError('Could not read the file. Please paste the details manually.');
    } finally {
      setFileUploading(false);
      // Reset the input so the same file can be re-uploaded if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Latest form value, readable after an `await` without going stale. Import
   * saves to the server, so it must merge into the profile that has actually
   * loaded — not into whatever this closure captured.
   */
  const formRef = useRef(form);
  formRef.current = form;

  /** Resolves once the saved profile has been loaded (or confirmed absent). */
  const profileLoad = useRef<Promise<void> | null>(null);

  /**
   * What the saved profile contained, captured synchronously. Awaiting the load
   * guarantees the response arrived, but not that React has committed the
   * resulting setForm — so the merge reads this rather than trusting timing.
   */
  const loadedProfile = useRef<Partial<ProfileForm>>({});

  const update = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  // Derived state for dropdowns
  const indianStates = State.getStatesOfCountry('IN');

  /**
   * Saves the profile through the existing endpoint pair — POST creates, PUT
   * updates when one already exists. Both the wizard's Complete Profile button
   * and the importer call this, so there is exactly one save path and one place
   * the deterministic engine receives data from.
   */
  const persistProfile = async (data: ProfileForm) => {
    const payload = toProfilePayload(data);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.post(`${API}/business`, payload, { headers });
    } catch (e: any) {
      if (e.response?.status === 400 && e.response?.data?.error?.includes('already exists')) {
        await axios.put(`${API}/business`, payload, { headers });
      } else {
        throw e;
      }
    }
  };

  /**
   * Reads back what the engine now concludes. This is the check that the import
   * actually reached it: the counts come from a fresh evaluation of the *saved*
   * profile against the ACTIVE ruleset, not from anything held in this page.
   */
  const fetchEngineSummary = async (): Promise<EngineSummary | null> => {
    const res = await axios.get(`${API}/obligations/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = res.data?.data;
    if (!d) return null;
    return {
      applies: d.applies ?? 0,
      insufficientData: d.insufficientData ?? 0,
      total: d.totalObligations ?? 0
    };
  };

  /**
   * Resolves the pasted details against the same option lists the dropdowns
   * render, merges what resolved into the form, then saves so the deterministic
   * engine recalculates from it. Filling the form alone was the bug: the engine
   * evaluates the saved Business document, so an unsaved import changed nothing.
   *
   * The paste is left in the box so a wrong key or value can be corrected and
   * re-imported.
   */
  const applyCompanyImport = async (rawData: string) => {
    // The placeholder renders the example in grey, which reads as filled-in
    // content. Disabling the button on an empty box therefore looked like a
    // broken button rather than an empty input — so say what is missing instead.
    if (!rawData.trim()) {
      setImportResult(null);
      setEngineResult(null);
      setError('Paste your company details into the box first, then press Import data.');
      return;
    }

    const result = parseCompanyImport(rawData, {
      stateNames: indianStates.map(s => s.name),
      districtsForState: (state) => (indianDistricts as Record<string, string[]>)[state] || [],
      citiesForState: (state) => {
        const stateObj = indianStates.find(s => s.name === state);
        return stateObj ? (City.getCitiesOfState('IN', stateObj.isoCode) || []).map(c => c.name) : [];
      }
    });

    setImportResult(result);
    setEngineResult(null);

    if (result.error) {
      setError(`Unable to import company details. ${result.error}`);
      return;
    }
    setError('');

    // Wait for the saved profile to be in the form before merging on top of it.
    // Import writes to the server, so merging into the blank defaults mid-load
    // would save those blanks over a profile that already exists.
    if (profileLoad.current) {
      try {
        await profileLoad.current;
      } catch {
        /* Already logged in the effect; a missing profile is a valid state. */
      }
    }

    // Merge first, so the fields show the paste even if the save then fails.
    // Only resolved values are present, so nothing valid is overwritten with
    // undefined. Fields still sitting at their untouched default take the saved
    // value, so a load React has not committed yet is never saved away — while
    // anything the user actually edited is left alone.
    const base: ProfileForm = { ...formRef.current };
    (Object.keys(loadedProfile.current) as Array<keyof ProfileForm>).forEach(key => {
      if (base[key] === INITIAL_FORM[key]) (base as any)[key] = loadedProfile.current[key];
    });

    const merged: ProfileForm = { ...base, ...(result.values as Partial<ProfileForm>) };
    setForm(merged);

    const invalid = validateProfile(merged);
    if (invalid) {
      setError(`Imported into the form, but not saved — ${invalid}`);
      return;
    }

    setImporting(true);
    try {
      await persistProfile(merged);
      setEngineResult(await fetchEngineSummary());
    } catch (err: any) {
      setError(
        `Imported into the form, but saving failed. ${err.response?.data?.error || err.message}`
      );
    } finally {
      setImporting(false);
    }
  };

  /**
   * The report renders only when it has something to say. A failed parse is
   * already surfaced through `error`, and a paste whose keys all carried empty
   * values would otherwise leave an empty panel behind.
   */
  const importReport =
    importResult &&
    !importResult.error &&
    (importResult.filled.length > 0 ||
      importResult.unresolved.length > 0 ||
      importResult.unknownKeys.length > 0 ||
      importResult.warnings.length > 0)
      ? importResult
      : null;

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API}/business`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data && res.data.data) {
          // Merge the saved profile in, narrowed to the fields this form owns.
          const saved = toProfilePayload(res.data.data) as Partial<ProfileForm>;
          loadedProfile.current = saved;
          setForm(prev => ({ ...prev, ...saved }));
        }
      } catch (err: any) {
        // If 404, they don't have a profile yet, which is fine
        if (err.response?.status !== 404) {
          console.error('Failed to fetch profile', err);
        }
      }
    };
    // Held so import can wait for it before writing back (see applyCompanyImport).
    if (token) profileLoad.current = fetchProfile();
  }, [token]);

  const [districts, setDistricts] = useState<string[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  React.useEffect(() => {
    if (form.state) {
      try {
        const stateDistricts = (indianDistricts as Record<string, string[]>)[form.state] || [];
        setDistricts(stateDistricts);
        
        const stateObj = indianStates.find(s => s.name === form.state);
        if (stateObj) {
          const stateCities = City.getCitiesOfState('IN', stateObj.isoCode) || [];
          setCities(stateCities);
        } else {
          setCities([]);
        }
      } catch (e) {
        setDistricts([]);
        setCities([]);
      }
    } else {
      setDistricts([]);
      setCities([]);
    }
  }, [form.state]);

  // Helper for tr-state selects
  const renderTriStateSelect = (label: string, field: keyof typeof form) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select 
        className="form-input" 
        value={form[field] === null ? '' : (form[field] ? 'true' : 'false')}
        onChange={(e) => {
          if (e.target.value === '') update(field, null);
          else update(field, e.target.value === 'true');
        }}
      >
        <option value="">{t('form.unknown', 'Unknown / Skip')}</option>
        <option value="true">{t('form.yes', 'Yes')}</option>
        <option value="false">{t('form.no', 'No')}</option>
      </select>
    </div>
  );

  const validateStep = () => {
    setError('');
    if (step === 2) {
      // Same pattern the API checks against, imported rather than repeated.
      if (form.gstin && !GSTIN_PATTERN.test(form.gstin)) {
        setError('Invalid GSTIN format.');
        return false;
      }
    }
    if (step === 3) {
      if (form.totalWorkers < 0 || form.contractWorkers < 0) {
        setError('Worker counts cannot be negative.');
        return false;
      }
      if (form.contractWorkers > form.totalWorkers) {
        setError('Contract workers cannot exceed total workers.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 0 || validateStep()) {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    setError('');
    try {
      await persistProfile(form);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: '700px' }} className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%' }} />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>SurakshaSetu AI</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/dashboard')}>← {t('common.backToDashboard', 'Back to Dashboard')}</button>
        </div>

        <h1 className="page-title">{t('onboarding.title', 'Set up your business profile')}</h1>
        <p className="page-subtitle">{t('onboarding.subtitle', 'The deterministic engine uses this data to calculate your exact compliance obligations.')}</p>

        <div className="card" style={{ marginBottom: '24px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Import company details</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Hidden file input — triggered by the Import data button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.json,.docx,.doc,.csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                aria-label="Upload company details file"
              />
              <button
                className="btn btn-outline btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || fileUploading}
                title="Upload a PDF, TXT, JSON or DOCX file with your company details"
              >
                {fileUploading ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Reading file…</>
                ) : (
                  <><Upload size={14} /> Upload file</>
                )}
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => applyCompanyImport(companyImportText)}
                disabled={importing || fileUploading}
              >
                {importing ? 'Importing…' : 'Import data'}
              </button>
            </div>
          </div>

          {/* Uploaded file indicator */}
          {uploadedFileName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 10px', background: '#f0f9f7', border: '1px solid rgba(80,200,168,0.3)', borderRadius: '6px', fontSize: '0.83rem', color: '#1a1f36' }}>
              <FileText size={14} color="#50c8a8" />
              <span>Uploaded: <strong>{uploadedFileName}</strong></span>
              <button type="button" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} onClick={() => { setUploadedFileName(null); setCompanyImportText(''); }} title="Remove file">&times;</button>
            </div>
          )}
          <textarea
            className="form-input"
            rows={4}
            value={companyImportText}
            onChange={(e) => setCompanyImportText(e.target.value)}
            placeholder={`Paste company details like:\n${EXAMPLE_IMPORT}`}
            style={{ resize: 'vertical' }}
          />
          <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Paste JSON or simple key-value company details and the profile fields will be
            auto-filled.{' '}
            <button
              type="button"
              className="doc-cat-note__link"
              onClick={() => setCompanyImportText(EXAMPLE_IMPORT)}
            >
              Fill in an example
            </button>
          </p>

          {/* What the import actually did. Most imported fields live on Steps 2-3,
              so without this the page looks unchanged and the import looks broken. */}
          {importReport && (
            <div className="import-report">
              {importReport.filled.length > 0 && (
                <>
                  <div className="import-report__head">
                    <span className="badge badge-green">
                      {importReport.filled.length} field{importReport.filled.length === 1 ? '' : 's'} filled
                    </span>
                    <strong className="import-report__success">Company details imported successfully.</strong>
                  </div>

                  {/* What the deterministic engine concluded from the saved
                      profile. Read back from the API, so it is evidence the
                      import reached the engine rather than a local claim. */}
                  {engineResult ? (
                    <p className="import-report__note import-report__note--engine">
                      Saved to your profile. The deterministic engine re-evaluated{' '}
                      {engineResult.total} rule{engineResult.total === 1 ? '' : 's'}:{' '}
                      <strong>{engineResult.applies} now apply</strong>
                      {engineResult.insufficientData > 0 && (
                        <> · {engineResult.insufficientData} still need more profile detail</>
                      )}
                      . Your documents and obligations are up to date.
                    </p>
                  ) : (
                    <p className="import-report__note">
                      {importing
                        ? 'Saving to your profile so the engine can recalculate…'
                        : 'Review each step and press ' +
                          t('common.completeProfile', 'Complete Profile') +
                          ' to finish.'}
                    </p>
                  )}

                  <div className="import-report__grid">
                    {importReport.filled.map(item => (
                      <div key={item.field} className="import-report__row">
                        <span className="import-report__label">{t(item.labelKey, item.labelFallback)}</span>
                        <span className="import-report__value">{item.display}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {importReport.warnings.map((warning, i) => (
                <p key={i} className="import-report__note import-report__note--warn">{warning}</p>
              ))}

              {importReport.unresolved.length > 0 && (
                <div className="import-report__block">
                  <span className="import-report__label">Could not be filled</span>
                  {importReport.unresolved.map(item => (
                    <p key={item.field} className="import-report__note">
                      <strong>{t(item.labelKey, item.labelFallback)}</strong> — "{item.raw}" · {item.reason}
                    </p>
                  ))}
                </div>
              )}

              {importReport.unknownKeys.length > 0 && (
                <div className="import-report__block">
                  <span className="import-report__label">Not a profile field</span>
                  <p className="import-report__note">{importReport.unknownKeys.join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
          {[0, 1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: '3px', borderRadius: '2px', background: s <= step ? 'var(--accent)' : 'var(--border)' }} />
          ))}
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="card">
          {step === 0 && (
            <>
              <h3 style={{ marginBottom: '20px' }}>{t('onboarding.chooseLanguage', 'Choose your preferred language')}</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                {t('onboarding.languageDesc', 'Select the language you are most comfortable using with SurakshaSetu.')}
              </p>
              
              <div className="form-group">
                <select 
                  className="form-input" 
                  value={language} 
                  onChange={e => setLanguage(e.target.value as Language)}
                  style={{ fontSize: '1.1rem', padding: '12px' }}
                >
                  <option value="ta" style={{ background: 'var(--bg-primary)' }}>தமிழ் (Tamil)</option>
                  <option value="en" style={{ background: 'var(--bg-primary)' }}>English</option>
                  <option value="as" style={{ background: 'var(--bg-primary)' }}>অসমীয়া (Assamese)</option>
                  <option value="bn" style={{ background: 'var(--bg-primary)' }}>বাংলা (Bengali)</option>
                  <option value="brx" style={{ background: 'var(--bg-primary)' }}>बड़ो (Bodo)</option>
                  <option value="doi" style={{ background: 'var(--bg-primary)' }}>डोगरी (Dogri)</option>
                  <option value="gu" style={{ background: 'var(--bg-primary)' }}>ગુજરાતી (Gujarati)</option>
                  <option value="hi" style={{ background: 'var(--bg-primary)' }}>हिन्दी (Hindi)</option>
                  <option value="kn" style={{ background: 'var(--bg-primary)' }}>ಕನ್ನಡ (Kannada)</option>
                  <option value="ks" style={{ background: 'var(--bg-primary)' }}>کأشُر (Kashmiri)</option>
                  <option value="kok" style={{ background: 'var(--bg-primary)' }}>कोंकणी (Konkani)</option>
                  <option value="mai" style={{ background: 'var(--bg-primary)' }}>मैथिली (Maithili)</option>
                  <option value="ml" style={{ background: 'var(--bg-primary)' }}>മലയാളം (Malayalam)</option>
                  <option value="mni" style={{ background: 'var(--bg-primary)' }}>ꯃꯤꯇꯩꯂꯣꯟ (Manipuri)</option>
                  <option value="mr" style={{ background: 'var(--bg-primary)' }}>मराठी (Marathi)</option>
                  <option value="ne" style={{ background: 'var(--bg-primary)' }}>नेपाली (Nepali)</option>
                  <option value="or" style={{ background: 'var(--bg-primary)' }}>ଓଡ଼ିଆ (Odia)</option>
                  <option value="pa" style={{ background: 'var(--bg-primary)' }}>ਪੰਜਾਬੀ (Punjabi)</option>
                  <option value="sa" style={{ background: 'var(--bg-primary)' }}>संस्कृतम् (Sanskrit)</option>
                  <option value="sat" style={{ background: 'var(--bg-primary)' }}>ᱥᱟᱱᱛᱟᱲᱤ (Santali)</option>
                  <option value="sd" style={{ background: 'var(--bg-primary)' }}>سنڌي (Sindhi)</option>
                  <option value="te" style={{ background: 'var(--bg-primary)' }}>తెలుగు (Telugu)</option>
                  <option value="ur" style={{ background: 'var(--bg-primary)' }}>اردو (Urdu)</option>
                </select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h3 style={{ marginBottom: '20px' }}>{t('form.step1', 'Step 1: Business Basics')}</h3>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{t('form.entityType', 'Entity Type')}</label>
                  <select className="form-input" value={form.entityType} onChange={e => update('entityType', e.target.value)}>
                    <option value="">{t('form.selectEntity', 'Select Entity Type')}</option>
                    {ENTITY_TYPES.map(o => (
                      <option key={o.value} value={o.value}>{t(o.labelKey, o.labelFallback)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.annualTurnover', 'Annual Turnover')}</label>
                  <select className="form-input" value={form.annualTurnoverBand} onChange={e => update('annualTurnoverBand', e.target.value)}>
                    <option value="">{t('form.selectTurnover', 'Select Turnover')}</option>
                    {TURNOVER_BANDS.map(o => (
                      <option key={o.value} value={o.value}>{t(o.labelKey, o.labelFallback)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{t('form.industry', 'Industry')}</label>
                  <select className="form-input" value={form.industry} onChange={e => update('industry', e.target.value)}>
                    <option value="">{t('form.selectIndustry', 'Select Industry')}</option>
                    {INDUSTRIES.map(o => (
                      <option key={o.value} value={o.value}>{t(o.labelKey, o.labelFallback)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.subIndustry', 'Sub Industry (Optional)')}</label>
                  <input className="form-input" placeholder={t('form.egSpices', 'e.g. Spices')} value={form.subIndustry} onChange={e => update('subIndustry', e.target.value)} />
                </div>
              </div>

              {form.industry === 'Food Processing' && (
                <div className="form-group">
                  <label className="form-label">{t('form.foodCategory', 'Food Product Category')}</label>
                  <select className="form-input" value={form.foodProductCategory} onChange={e => update('foodProductCategory', e.target.value)}>
                    <option value="">{t('form.selectFoodCategory', 'Select Category')}</option>
                    {FOOD_CATEGORIES.map(o => (
                      <option key={o.value} value={o.value}>{t(o.labelKey, o.labelFallback)}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h3 style={{ marginBottom: '20px' }}>{t('form.step2', 'Step 2: Location & Registration')}</h3>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{t('form.state', 'State')}</label>
                  <select 
                    className="form-input" 
                    value={form.state} 
                    onChange={e => {
                      update('state', e.target.value);
                      update('district', '');
                      update('city', '');
                    }}
                  >
                    <option value="">Select State</option>
                    {indianStates.map(s => (
                      <option key={s.isoCode} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.district', 'District')}</label>
                  <select 
                    className="form-input" 
                    value={form.district} 
                    onChange={e => update('district', e.target.value)}
                    disabled={!form.state || districts.length === 0}
                  >
                    <option value="">Select District</option>
                    {districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{t('form.city', 'City')}</label>
                  <select 
                    className="form-input" 
                    value={form.city} 
                    onChange={e => update('city', e.target.value)}
                    disabled={!form.state || cities.length === 0}
                  >
                    <option value="">Select City</option>
                    {cities.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.municipality', 'Municipality')}</label>
                  <input className="form-input" placeholder={t('form.egPMC', 'e.g. PMC')} value={form.municipality} onChange={e => update('municipality', e.target.value)} />
                </div>
              </div>
              
              <div className="grid-2">
                {renderTriStateSelect(t('form.gstReg', 'GST Registered?'), 'gstRegistrationStatus')}
                <div className="form-group">
                  <label className="form-label">{t('form.gstin', 'GSTIN (if registered)')}</label>
                  <input className="form-input" placeholder="27AAACR5055K1Z5" value={form.gstin} onChange={e => update('gstin', e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="grid-2">
                {renderTriStateSelect(t('form.udyamReg', 'Udyam Registered?'), 'udyamRegistrationStatus')}
                <div className="form-group">
                  <label className="form-label">{t('form.udyamNo', 'Udyam Registration Number')}</label>
                  <input className="form-input" placeholder="UDYAM-MH-00-0000000" value={form.udyamRegistration} onChange={e => update('udyamRegistration', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 style={{ marginBottom: '20px' }}>{t('form.step3', 'Step 3: Workforce & Operations')}</h3>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{t('form.totalWorkers', 'Total Workers')}</label>
                  <input type="number" className="form-input" value={form.totalWorkers} onChange={e => update('totalWorkers', e.target.value === '' ? '' : Number(e.target.value))} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.contractWorkers', 'Contract Workers')}</label>
                  <input type="number" className="form-input" value={form.contractWorkers} onChange={e => update('contractWorkers', e.target.value === '' ? '' : Number(e.target.value))} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.womenWorkers', 'Women Workers')}</label>
                  <input type="number" className="form-input" value={form.womenWorkers} onChange={e => update('womenWorkers', e.target.value === '' ? '' : Number(e.target.value))} min="0" />
                </div>
                {renderTriStateSelect(t('form.nightShift', 'Night Shift Operations?'), 'nightShift')}
              </div>
              
              <h4 style={{ marginTop: '24px', marginBottom: '12px' }}>{t('form.operational', 'Operational Fields')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {renderTriStateSelect(t('form.boiler', 'Uses Steam Boiler?'), 'boiler')}
                {renderTriStateSelect(t('form.coldStorage', 'Cold Storage Facility?'), 'coldStorage')}
                {renderTriStateSelect(t('form.effluent', 'Generates Effluents?'), 'effluent')}
                {renderTriStateSelect(t('form.hazardousWaste', 'Hazardous Waste?'), 'hazardousWaste')}
                {renderTriStateSelect(t('form.plastic', 'Plastic Packaging?'), 'plasticPackaging')}
                {renderTriStateSelect(t('form.retail', 'Packaged for Retail?'), 'packagedRetail')}
                {renderTriStateSelect(t('form.dairy', 'Dairy Products?'), 'dairy')}
                {renderTriStateSelect(t('form.importExport', 'Import/Export Activity?'), 'importActivity')}
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            {step > 0 ? <button className="btn btn-outline" onClick={() => setStep(s => s - 1)}>{t('common.back', 'Back')}</button> : <div />}
            {step < 3 ? (
              <button className="btn btn-accent" onClick={handleNext}>{t('common.continue', 'Continue')}</button>
            ) : (
              <button className="btn btn-accent" onClick={handleSubmit} disabled={loading}>
                {loading ? t('common.saving', 'Saving...') : t('common.completeProfile', 'Complete Profile')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
