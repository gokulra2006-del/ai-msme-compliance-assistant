import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Assistant from './pages/Assistant';
import Onboarding from './pages/Onboarding';
import Obligations from './pages/Obligations';
import EvidenceVault from './pages/EvidenceVault';
import ErrorBoundary from './components/ErrorBoundary';
import ComplianceCalendar from './pages/ComplianceCalendar';
import AuditLogs from './pages/AuditLogs';
import AdminRoute from './components/AdminRoute';
import RuleManagement from './pages/admin/RuleManagement';
import RegulatoryUpdates from './pages/admin/RegulatoryUpdates';
import UpdateImpactAnalysis from './pages/admin/UpdateImpactAnalysis';
import AdminRuleManagement from './pages/admin/RuleManagement';
import SourceManagement from './pages/admin/SourceManagement';
import InspectionReadiness from './pages/InspectionReadiness';
import InspectionPackView from './pages/InspectionPackView';
import SubmissionGuide from './pages/SubmissionGuide';
import DocumentPreparation from './pages/DocumentPreparation';
import RegulatorySubmission from './pages/RegulatorySubmission';
import DigitalTwin from './pages/DigitalTwin';
import WhatIfSimulator from './pages/WhatIfSimulator';
import BusinessImpactSimulator from './pages/BusinessImpactSimulator';
import './index.css';

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <Login />
          </motion.div>
        } />
        <Route path="/register" element={
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <Register />
          </motion.div>
        } />
        <Route path="/onboarding" element={
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <Onboarding />
          </motion.div>
        } />
        <Route path="/dashboard" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <Dashboard />
          </motion.div>
        } />
        <Route path="/assistant" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <Assistant />
          </motion.div>
        } />
        <Route path="/obligations" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <Obligations />
          </motion.div>
        } />
        <Route path="/evidence" element={
          <ErrorBoundary>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <EvidenceVault />
            </motion.div>
          </ErrorBoundary>
        } />
        <Route path="/calendar" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <ComplianceCalendar />
          </motion.div>
        } />
        <Route path="/inspection-readiness" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <InspectionReadiness />
          </motion.div>
        } />
        <Route path="/inspection-pack" element={<InspectionPackView />} />
        <Route path="/submission-guide/:id" element={<SubmissionGuide />} />
        <Route path="/submissions/:actionId" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <RegulatorySubmission />
          </motion.div>
        } />
        <Route path="/document-preparation/:obligationCode" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <DocumentPreparation />
          </motion.div>
        } />
        <Route path="/document-preparation" element={<DocumentPreparation />} />
        <Route path="/audit-logs" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AuditLogs />
          </motion.div>
        } />
        <Route path="/digital-twin" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <DigitalTwin />
          </motion.div>
        } />
        <Route path="/simulator" element={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <WhatIfSimulator />
          </motion.div>
        } />
        
        {/* Admin Routes */}
        <Route path="/admin/sources" element={
          <AdminRoute>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <SourceManagement />
            </motion.div>
          </AdminRoute>
        } />

          <Route path="/admin/updates" element={<AdminRoute><RegulatoryUpdates /></AdminRoute>} />
          <Route path="/admin/updates/:id/impact" element={<AdminRoute><UpdateImpactAnalysis /></AdminRoute>} />
          <Route path="/admin/rules" element={<AdminRoute><AdminRuleManagement /></AdminRoute>} />
          
          <Route path="/updates/impact" element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <BusinessImpactSimulator />
            </motion.div>
          } />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <div className="min-h-screen">
            <AnimatedRoutes />
          </div>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
