const RegulatorySource = require('../models/RegulatorySource');
const AuditLog = require('../models/AuditLog');

exports.getSources = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    
    const query = {};
    if (req.query.status) query.verificationStatus = req.query.status;
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query.$or = [{ sourceName: regex }, { actName: regex }];
    }

    const sources = await RegulatorySource.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
      
    const total = await RegulatorySource.countDocuments(query);

    res.status(200).json({ success: true, count: sources.length, total, data: sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createSource = async (req, res) => {
  try {
    const source = await RegulatorySource.create(req.body);
    
    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: 'SOURCE_CREATED',
      entity: 'RegulatorySource',
      entityId: source._id,
      newValue: { sourceName: source.sourceName, officialUrl: source.officialUrl }
    });

    res.status(201).json({ success: true, data: source });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateSource = async (req, res) => {
  try {
    const source = await RegulatorySource.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!source) return res.status(404).json({ success: false, error: 'Source not found' });
    
    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: 'SOURCE_UPDATED',
      entity: 'RegulatorySource',
      entityId: source._id,
      newValue: { sourceName: source.sourceName, officialUrl: source.officialUrl }
    });

    res.status(200).json({ success: true, data: source });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.verifySource = async (req, res) => {
  try {
    const { status, verificationNotes, lastVerifiedDate } = req.body; // status must be VERIFIED or REJECTED
    
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid verification status' });
    }

    const source = await RegulatorySource.findById(req.params.id);
    if (!source) return res.status(404).json({ success: false, error: 'Source not found' });

    if (status === 'VERIFIED') {
      if (!source.officialUrl) return res.status(400).json({ success: false, error: 'Official URL is required for verification' });
      if (!source.sourceName) return res.status(400).json({ success: false, error: 'Source Name is required for verification' });
    }

    const prevStatus = source.verificationStatus;
    source.verificationStatus = status;
    source.verificationNotes = verificationNotes || source.verificationNotes;
    source.lastVerifiedDate = lastVerifiedDate || Date.now();
    
    await source.save();

    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: status === 'VERIFIED' ? 'SOURCE_VERIFIED' : 'SOURCE_REJECTED',
      entity: 'RegulatorySource',
      entityId: source._id,
      previousValue: { verificationStatus: prevStatus },
      newValue: { verificationStatus: source.verificationStatus, verificationNotes: source.verificationNotes }
    });

    res.status(200).json({ success: true, data: source });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
