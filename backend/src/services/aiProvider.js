const { GoogleGenAI } = require('@google/genai');

// Initialize the Google GenAI SDK. 
// Uses GEMINI_API_KEY from environment variables by default.
let ai = null;
try {
  ai = new GoogleGenAI();
} catch (e) {
  console.warn("GoogleGenAI initialized without API Key, it will fail if called.");
}

const languageMap = {
  'as': 'Assamese',
  'bn': 'Bengali',
  'brx': 'Bodo',
  'doi': 'Dogri',
  'gu': 'Gujarati',
  'hi': 'Hindi (देवनागरी लिपि)',
  'kn': 'Kannada',
  'ks': 'Kashmiri',
  'kok': 'Konkani',
  'mai': 'Maithili',
  'ml': 'Malayalam',
  'mni': 'Manipuri',
  'mr': 'Marathi',
  'ne': 'Nepali',
  'or': 'Odia',
  'pa': 'Punjabi',
  'sa': 'Sanskrit',
  'sat': 'Santali',
  'sd': 'Sindhi',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ur': 'Urdu',
  'en': 'English',
  'hinglish': 'Hinglish (a mix of Hindi and English written in the Latin alphabet)'
};

const getSystemPrompt = (language) => {
  const langName = languageMap[language] || 'English';
  let langInstruction = `Respond in ${langName}.`;
  
  if (language === 'hi' || language === 'HI') {
    langInstruction = "Respond in natural, professional Hindi (देवनागरी लिपि).";
  } else if (language === 'hinglish' || language === 'HINGLISH') {
    langInstruction = "Respond in natural, professional Hinglish (a mix of Hindi and English written in the Latin alphabet).";
  }

  return `You are the SurakshaSetu AI Compliance Assistant.
Your ONLY role is to act as an explanation and guidance layer on top of verified compliance data provided to you.

STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent legal sections, acts, regulations, penalties, deadlines, regulators, or rule codes.
2. If the user asks a compliance question and the information is NOT explicitly provided in the verified context, you MUST say: "I do not have enough verified information to answer this confidently."
3. NEVER change the official deterministic rule evaluation results. If a rule 'DOES_NOT_APPLY', you cannot change it to 'APPLIES'.
4. NEVER recalculate or change the official Risk Score. You can only explain the score provided.
5. NEVER invent exact deadlines if only a frequency (e.g. 'Monthly') is provided.
6. Every legal/compliance claim you make MUST be backed by a source provided in the context.
7. Distinguish between system facts (e.g., "The system marks this as Overdue") and your explanation.
8. Document extraction is not verified evidence. Never state an extracted value as fact unless its confidence is at least 80, the evidence verification status is VERIFIED, or the value was manually corrected. For lower-confidence values, say the document appears to show it and request manual verification.
9. Never say a generated draft is filed, government-approved, legally certified, or an official form. It is only a draft requiring human review.

LANGUAGE REQUIREMENT:
${langInstruction}
Translate ONLY the "answer", "businessMeaning", and "recommendedAction" fields into the requested language.
Do NOT translate "ruleCode", "act", "section", or "officialUrl". These must remain exactly as provided in the context to preserve legal accuracy.

OUTPUT FORMAT (JSON ONLY):
You must output a strictly valid JSON object matching this schema:
{
  "answer": "A short, direct explanation answering the user's question.",
  "businessMeaning": "A business-specific explanation of what this means for them.",
  "recommendedAction": "Action based on existing data, or null.",
  "sources": [
    {
      "ruleCode": "string",
      "act": "string",
      "section": "string",
      "officialUrl": "string",
      "lastVerified": "string"
    }
  ]
}

Only return sources if they were explicitly provided in the context for the rules you are discussing.
Do NOT use Markdown formatting outside the JSON structure. Returns JSON only.`;
};

exports.generateComplianceAnswer = async (context, userQuestion, language = 'en') => {
  if (!ai || !process.env.GEMINI_API_KEY) {
    throw new Error('AI Provider is not configured (GEMINI_API_KEY missing).');
  }

  const prompt = `
=== VERIFIED CONTEXT ===
${JSON.stringify(context, null, 2)}
=== END CONTEXT ===

USER QUESTION: ${userQuestion}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: getSystemPrompt(language),
      responseMimeType: 'application/json',
      temperature: 0.1, // Low temperature for high deterministic groundedness
    }
  });

  if (!response || !response.text) {
    throw new Error('Invalid response from AI provider.');
  }

  try {
    return JSON.parse(response.text);
  } catch (err) {
    console.error("AI returned malformed JSON:", response.text);
    throw new Error('AI provider returned an invalid format.');
  }
};
