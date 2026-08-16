import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../context/LanguageContext';
import { State, City } from 'country-state-city';
import indianDistricts from '../data/indianDistricts.json';

const Onboarding = () => {
  const { token } = useContext(AuthContext);
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // Step 0 is Language Selection
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
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
    commercialEstablishmentStatus: null as boolean | null,
  });

  const update = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/business', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data && res.data.data) {
          // Merge existing data into form
          const d = res.data.data;
          setForm(prev => ({ ...prev, ...d }));
        }
      } catch (err: any) {
        // If 404, they don't have a profile yet, which is fine
        if (err.response?.status !== 404) {
          console.error('Failed to fetch profile', err);
        }
      }
    };
    if (token) fetchProfile();
  }, [token]);

  // Derived state for dropdowns
  const indianStates = State.getStatesOfCountry('IN');
  
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
      if (form.gstRegistrationStatus && form.gstin) {
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin)) {
          setError('Invalid GSTIN format.');
          return false;
        }
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
      try {
        await axios.post('http://localhost:5000/api/business', form, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e: any) {
        if (e.response?.status === 400 && e.response?.data?.error?.includes('already exists')) {
          await axios.put('http://localhost:5000/api/business', form, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } else {
          throw e;
        }
      }
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
                    <option>{t('form.entity.proprietorship', 'Proprietorship')}</option>
                    <option>{t('form.entity.partnership', 'Partnership')}</option>
                    <option>{t('form.entity.privateLimited', 'Private Limited')}</option>
                    <option>{t('form.entity.llp', 'LLP')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.annualTurnover', 'Annual Turnover')}</label>
                  <select className="form-input" value={form.annualTurnoverBand} onChange={e => update('annualTurnoverBand', e.target.value)}>
                    <option value="">{t('form.selectTurnover', 'Select Turnover')}</option>
                    <option value="< 5Cr">{t('form.turnover.below5', 'Below ₹5 Crore')}</option>
                    <option value="5-50Cr">{t('form.turnover.5to50', '₹5 - ₹50 Crore')}</option>
                    <option value="> 50Cr">{t('form.turnover.above50', 'Above ₹50 Crore')}</option>
                  </select>
                </div>
              </div>
              
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{t('form.industry', 'Industry')}</label>
                  <select className="form-input" value={form.industry} onChange={e => update('industry', e.target.value)}>
                    <option value="">{t('form.selectIndustry', 'Select Industry')}</option>
                    <option>{t('form.ind.food', 'Food Processing')}</option>
                    <option>{t('form.ind.mfg', 'Manufacturing')}</option>
                    <option>{t('form.ind.it', 'IT / Software')}</option>
                    <option>{t('form.ind.retail', 'Retail')}</option>
                    <option>{t('form.ind.health', 'Healthcare')}</option>
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
                    <option>{t('form.food.spices', 'Spices and Condiments')}</option>
                    <option>{t('form.food.packaged', 'Packaged Foods')}</option>
                    <option>{t('form.food.dairy', 'Dairy Products')}</option>
                    <option>{t('form.food.rte', 'Ready to Eat')}</option>
                    <option>{t('form.food.bakery', 'Bakery Products')}</option>
                    <option>{t('form.food.beverages', 'Beverages')}</option>
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
                  <input type="number" className="form-input" value={form.totalWorkers} onChange={e => update('totalWorkers', parseInt(e.target.value) || 0)} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.contractWorkers', 'Contract Workers')}</label>
                  <input type="number" className="form-input" value={form.contractWorkers} onChange={e => update('contractWorkers', parseInt(e.target.value) || 0)} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.womenWorkers', 'Women Workers')}</label>
                  <input type="number" className="form-input" value={form.womenWorkers} onChange={e => update('womenWorkers', parseInt(e.target.value) || 0)} min="0" />
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
