const Business = require('../models/Business');
const ComplianceAction = require('../models/ComplianceAction');
const DocumentDraft = require('../models/DocumentDraft');
const { logAudit } = require('../utils/auditLogger');
const {
  getPreparationSnapshot,
  templateByKey,
  buildDraftContent
} = require('../services/documentPreparationService');

async function getUserBusiness(userId) {
  return Business.findOne({ user: userId });
}

exports.getPreparation = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(400).json({ success: false, error: 'No business profile found. Complete onboarding first.' });

    const snapshot = await getPreparationSnapshot({ business, user: req.user, obligationCode: req.params.obligationCode });
    if (snapshot.error) return res.status(404).json({ success: false, error: snapshot.error });

    const drafts = await DocumentDraft.find({ business: business._id, obligationCode: req.params.obligationCode })
      .sort({ documentType: 1, version: -1 })
      .lean();
    res.json({ success: true, data: { ...snapshot, drafts } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.listDrafts = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.json({ success: true, data: [] });
    const filter = { business: business._id };
    if (req.query.obligationCode) filter.obligationCode = req.query.obligationCode;
    const drafts = await DocumentDraft.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.generateDraft = async (req, res) => {
  try {
    const { obligationCode, templateKey, changeReason } = req.body;
    if (!obligationCode || !templateKey) return res.status(400).json({ success: false, error: 'obligationCode and templateKey are required.' });

    const template = templateByKey(templateKey);
    if (!template) return res.status(400).json({ success: false, error: 'Unsupported non-official draft template.' });

    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(400).json({ success: false, error: 'No business profile found. Complete onboarding first.' });

    const snapshot = await getPreparationSnapshot({ business, user: req.user, obligationCode });
    if (snapshot.error) return res.status(404).json({ success: false, error: snapshot.error });
    const templateStatus = snapshot.templates.find(item => item.key === templateKey);
    if (!templateStatus || templateStatus.status !== 'READY_TO_GENERATE') {
      return res.status(422).json({
        success: false,
        error: 'MISSING INFORMATION: complete the required business information before generating this draft.',
        missingInformation: templateStatus?.missingInformation || []
      });
    }

    const previous = await DocumentDraft.findOne({
      business: business._id,
      obligationCode,
      documentType: template.label,
      isCurrent: true
    });
    if (previous) {
      previous.isCurrent = false;
      await previous.save();
    }

    const verifiedEvidence = snapshot.evidenceChecklist.filter(item => item.status === 'VERIFIED');
    const draft = await DocumentDraft.create({
      business: business._id,
      obligationCode,
      complianceAction: snapshot.action?._id || null,
      documentType: template.label,
      templateKey,
      content: buildDraftContent({ template, snapshot }),
      informationSnapshot: snapshot.profile
        .filter(item => template.requiredFields.includes(item.key) && item.value)
        .map(item => ({ key: item.key, label: item.label, value: item.value, source: item.source })),
      evidenceUsed: verifiedEvidence.map(item => item.evidenceId),
      generatedBy: req.user.id,
      version: previous ? previous.version + 1 : 1,
      previousVersion: previous?._id || null,
      isCurrent: true,
      documentStatus: 'GENERATED',
      changeReason: changeReason || ''
    });

    await logAudit({
      req,
      action: previous ? 'DOCUMENT_REGENERATED' : 'DOCUMENT_GENERATED',
      entity: 'DocumentDraft',
      entityId: draft._id,
      businessId: business._id,
      metadata: { obligationCode, templateKey, version: draft.version, previousVersion: previous?._id || null }
    });
    res.status(201).json({ success: true, data: draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

async function findOwnedDraft(req) {
  const business = await getUserBusiness(req.user.id);
  if (!business) return { business: null, draft: null };
  const draft = await DocumentDraft.findOne({ _id: req.params.id, business: business._id });
  return { business, draft };
}

exports.getDraft = async (req, res) => {
  try {
    const { draft } = await findOwnedDraft(req);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateDraftContent = async (req, res) => {
  try {
    const { content, changeReason } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Draft content is required.' });
    }
    if (!content.includes('DRAFT — REQUIRES HUMAN REVIEW')) {
      return res.status(400).json({ success: false, error: 'The mandatory draft review notice cannot be removed.' });
    }
    const { business, draft } = await findOwnedDraft(req);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });

    const previousValue = draft.toObject();
    draft.content = content.slice(0, 50000);
    if (changeReason !== undefined) draft.changeReason = String(changeReason).slice(0, 1000);
    if (draft.documentStatus === 'GENERATED') draft.documentStatus = 'UNDER_REVIEW';
    await draft.save();
    await logAudit({
      req,
      action: 'DOCUMENT_DRAFT_EDITED',
      entity: 'DocumentDraft',
      entityId: draft._id,
      businessId: business._id,
      previousValue,
      newValue: draft.toObject()
    });
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateDraftStatus = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid internal document status.' });
    }
    const { business, draft } = await findOwnedDraft(req);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });

    const previousValue = draft.toObject();
    draft.documentStatus = status;
    if (reviewNotes !== undefined) draft.reviewNotes = String(reviewNotes).slice(0, 2000);
    draft.reviewedBy = req.user.id;
    draft.reviewedAt = new Date();
    await draft.save();

    await logAudit({
      req,
      action: status === 'APPROVED' ? 'DOCUMENT_APPROVED_INTERNALLY' : `DOCUMENT_${status}`,
      entity: 'DocumentDraft',
      entityId: draft._id,
      businessId: business._id,
      previousValue,
      newValue: draft.toObject(),
      metadata: { internalOnly: true }
    });
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.downloadDraft = async (req, res) => {
  try {
    const { business, draft } = await findOwnedDraft(req);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });

    const filename = `${draft.documentType.replace(/[^a-z0-9]+/gi, '_')}_v${draft.version}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await logAudit({
      req,
      action: 'DOCUMENT_DOWNLOADED',
      entity: 'DocumentDraft',
      entityId: draft._id,
      businessId: business._id,
      metadata: { version: draft.version }
    });
    res.send(draft.content);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
