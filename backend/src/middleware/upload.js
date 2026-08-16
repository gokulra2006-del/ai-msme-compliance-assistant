// backend/src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
];

// Extensions permitted per MIME type. A declared MIME type that does not agree
// with the file extension is rejected before anything touches disk. The binary
// signature is checked separately in the controller — a valid extension alone is
// never treated as proof that a file is safe.
const ALLOWED_EXTENSIONS = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png']
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate a safe unique filename — never trust original.
    // path.extname() can still return separators for names like "a.p/../x", so
    // the extension is whitelisted to plain alphanumerics before it is used to
    // build a path. This blocks directory traversal via the upload filename.
    const rawExt = path.extname(file.originalname).toLowerCase();
    const ext = /^\.[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : '';
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} not allowed. Allowed: PDF, JPG, PNG`), false);
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  const permitted = ALLOWED_EXTENSIONS[file.mimetype] || [];
  if (!permitted.includes(ext)) {
    return cb(new Error(`File extension "${ext || 'none'}" does not match the declared type ${file.mimetype}.`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE }
});

module.exports = { upload, UPLOAD_DIR, MAX_SIZE, ALLOWED_TYPES, ALLOWED_EXTENSIONS };
