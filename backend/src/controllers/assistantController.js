const { buildContext } = require('../services/contextBuilder');
const { generateComplianceAnswer } = require('../services/aiProvider');
const { logAudit } = require('../utils/auditLogger');
const Business = require('../models/Business');
const Evidence = require('../models/Evidence');
// Document type categories
const DOCUMENT_KEYWORDS = {
  LICENCE: ['licence', 'license', 'factory licence', 'factory license', 'trade licence', 'trade license', 'registration certificate'],
  PERMIT: ['permit', 'permission', 'noc', 'no objection certificate', 'permission letter'],
  CERTIFICATE: ['certificate', 'certified', 'cert', 'iso', 'quality', 'compliance'],
  REGISTRATION: ['registration', 'udyam', 'registered', 'gstin certificate', 'pan certificate'],
  FILING_ACKNOWLEDGEMENT: ['acknowledgement', 'acknowledgment', 'arn', 'filed on', 'submission receipt', 'challan', 'filed', 'form'],
  NOTICE: ['notice', 'show cause', 'memorandum', 'order', 'direction'],
  RETURN: ['return', 'monthly return', 'annual return', 'quarterly return', 'form filing'],
  DECLARATION: ['declaration', 'declared', 'undertaking', 'affidavit', 'sworn'],
  INSPECTION_REPORT: ['inspection report', 'inspection', 'inspection memo', 'audit report', 'compliance check'],
  ENVIRONMENTAL_DOCUMENT: ['environmental', 'pollution', 'consent to operate', 'consent to establish', 'emission', 'effluent'],
  LABOUR_DOCUMENT: ['labour', 'labor', 'employee', 'wage', 'epf', 'esi', 'workers', 'payroll', 'attendance'],
  TAX_DOCUMENT: ['gst', 'tax', 'gstin', 'invoice', 'bill', 'tax return'],
  SUPPORTING_DOCUMENT: ['invoice', 'agreement', 'lease', 'rent', 'electricity bill', 'bank statement', 'pan', 'proof']
};

exports.chat = async (req, res) => {
  try {
    const { question, language, simulationId } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    const business = await Business.findOne({ user: req.user.id }).lean();
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business profile not found' });
    }
    const context = await buildContext(business._id, question, simulationId);
    if (!context) {
      return res.status(404).json({ success: false, error: 'Business profile not found' });
    }

    // Call AI Provider
    const aiResponse = await generateComplianceAnswer(context, question, language);

    // Audit Log the interaction
    await logAudit({
      req,
      action: 'AI_ASSISTANT_QUERY',
      businessId: business._id,
      metadata: { question }
    });

    res.json({
      success: true,
      data: aiResponse
    });
  } catch (err) {
    console.error('Assistant Chat Error:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'The compliance assistant is temporarily unavailable.' 
    });
  }
};

// Classify documents based on name and content
exports.classifyDocument = async (req, res) => {
  try {
    const { documentName, documentContent } = req.body;
    
    if (!documentName) {
      return res.status(400).json({ success: false, error: 'Document name is required' });
    }

    const business = await Business.findOne({ user: req.user.id }).lean();
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business profile not found' });
    }

    // Classify based on keywords
    const searchText = `${documentName} ${documentContent || ''}`.toLowerCase();
    let bestMatch = null;
    let maxHits = 0;

    for (const [docType, keywords] of Object.entries(DOCUMENT_KEYWORDS)) {
      const hits = keywords.filter(kw => searchText.includes(kw.toLowerCase())).length;
      if (hits > maxHits) {
        maxHits = hits;
        bestMatch = docType;
      }
    }

    const confidence = maxHits > 0 ? Math.min(100, 50 + maxHits * 10) : 0;
    const classification = bestMatch || 'UNKNOWN';

    // Get available document types from obligations
    const availableDocuments = await Evidence.distinct('documentType', { business: business._id });

    res.json({
      success: true,
      data: {
        classification,
        confidence,
        documentName,
        recommendation: classification !== 'UNKNOWN' 
          ? `This appears to be a ${classification.replace(/_/g, ' ').toLowerCase()} document.`
          : 'Unable to auto-classify. Please select the document type manually.',
        availableDocuments
      }
    });
  } catch (err) {
    console.error('Document Classification Error:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Classification service is temporarily unavailable.' 
    });
  }
};
