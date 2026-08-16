const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');

let cachedGawkText = null;

/**
 * Extracts and returns the raw text content of the GAWK.docx file.
 * The result is cached in memory for subsequent calls.
 */
async function loadGawkContext() {
  if (cachedGawkText !== null) {
    return cachedGawkText;
  }

  // gawk.docx lives at the repository root (one level above backend/). The
  // candidate list keeps the historical location working and allows an explicit
  // override, but no other regulatory source is ever consulted.
  const candidates = [
    process.env.GAWK_DOCX_PATH,
    path.resolve(__dirname, '../../../gawk.docx'),      // <repo>/gawk.docx
    path.resolve(__dirname, '../../gawk.docx'),         // <repo>/backend/gawk.docx
    path.resolve(__dirname, '../../../../gawk.docx')    // legacy path
  ].filter(Boolean);

  const docxPath = candidates.find(candidate => fs.existsSync(candidate));

  if (!docxPath) {
    console.warn(`[GAWK Loader] Could not find gawk.docx. Looked in: ${candidates.join(', ')}. Grounding will be missing.`);
    return "GAWK Regulatory Data is unavailable. Proceed with caution.";
  }

  try {
    const result = await mammoth.extractRawText({ path: docxPath });
    cachedGawkText = result.value.trim();
    console.log(`[GAWK Loader] Successfully loaded ${cachedGawkText.length} characters from gawk.docx.`);
    return cachedGawkText;
  } catch (error) {
    console.error(`[GAWK Loader] Failed to extract text from gawk.docx:`, error.message);
    throw new Error('Failed to load GAWK regulatory reference document.');
  }
}

module.exports = {
  loadGawkContext
};
