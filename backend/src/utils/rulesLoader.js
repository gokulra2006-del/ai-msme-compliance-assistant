const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');

let cachedRulesText = null;

/**
 * Extracts and returns the raw text content of the Suraksha Rules.docx file.
 * The result is cached in memory for subsequent calls.
 */
async function loadRulesContext() {
  if (cachedRulesText !== null) {
    return cachedRulesText;
  }

  // suraksha_rules.docx lives at the repository root (one level above backend/). The
  // candidate list keeps the historical location working and allows an explicit
  // override, but no other regulatory source is ever consulted.
  const candidates = [
    process.env.SURAKSHA_RULES_DOCX_PATH,
    path.resolve(__dirname, '../../../suraksha_rules.docx'),      // <repo>/suraksha_rules.docx
    path.resolve(__dirname, '../../suraksha_rules.docx'),         // <repo>/backend/suraksha_rules.docx
    path.resolve(__dirname, '../../../../suraksha_rules.docx')    // legacy path
  ].filter(Boolean);

  const docxPath = candidates.find(candidate => fs.existsSync(candidate));

  if (!docxPath) {
    console.warn(`[Suraksha Rules Loader] Could not find suraksha_rules.docx. Looked in: ${candidates.join(', ')}. Grounding will be missing.`);
    return "Suraksha Rules Regulatory Data is unavailable. Proceed with caution.";
  }

  try {
    const result = await mammoth.extractRawText({ path: docxPath });
    cachedRulesText = result.value.trim();
    console.log(`[Suraksha Rules Loader] Successfully loaded ${cachedRulesText.length} characters from suraksha_rules.docx.`);
    return cachedRulesText;
  } catch (error) {
    console.error(`[Suraksha Rules Loader] Failed to extract text from suraksha_rules.docx:`, error.message);
    throw new Error('Failed to load Suraksha Rules regulatory reference document.');
  }
}

module.exports = {
  loadRulesContext
};
