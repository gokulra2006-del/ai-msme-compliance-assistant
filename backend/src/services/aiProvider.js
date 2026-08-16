const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

// Initialize AI providers based on configuration
let geminiAI = null;
try {
  geminiAI = new GoogleGenAI();
} catch (e) {
  console.warn("GoogleGenAI initialized without API Key, it will fail if called.");
}

// Validate required API keys
const validateAPIKeys = () => {
  const provider = process.env.AI_PROVIDER || 'openrouter';
  
  if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
    throw new Error('AI_PROVIDER is set to openrouter but OPENROUTER_API_KEY is missing.');
  }
  if (provider === 'nvidia-grok' && !process.env.NVIDIA_GROK_API_KEY) {
    throw new Error('AI_PROVIDER is set to nvidia-grok but NVIDIA_GROK_API_KEY is missing.');
  }
  if (provider === 'google' && !process.env.GEMINI_API_KEY) {
    throw new Error('AI_PROVIDER is set to google but GEMINI_API_KEY is missing.');
  }
};

// OpenRouter API call
const callOpenRouter = async (prompt, systemInstruction, language) => {
  const primaryModel = process.env.OPENROUTER_MODEL || 'gpt-3.5-turbo';
  const defaultFallbacks = [
    'google/gemini-2.5-flash',
    'google/gemma-2-9b-it:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'microsoft/phi-3-mini-128k-instruct:free',
    'openchat/openchat-7b:free',
    'nousresearch/hermes-2-pro-llama-3-8b:free',
    'huggingfaceh4/zephyr-7b-beta:free',
    'qwen/qwen-2-7b-instruct:free',
    'cognitivecomputations/dolphin-2.9-llama3-8b:free'
  ].join(',');
  const fallbackStr = process.env.OPENROUTER_FALLBACK_MODELS || defaultFallbacks;
  const fallbackModels = fallbackStr.split(',').map(m => m.trim());
  
  const modelsToTry = [primaryModel, ...fallbackModels.filter(m => m !== primaryModel)];
  const errors = [];

  for (const model of modelsToTry) {
    try {
      console.log(`[AI] 🔄 Attempting OpenRouter model: ${model}`);
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model,
        messages: [
          {
            role: 'system',
            content: systemInstruction
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://msme-compliance-assistant.app',
          'X-Title': 'MSME Compliance Assistant',
          'Content-Type': 'application/json'
        }
      });

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenRouter API');
      }

      let content = response.data.choices[0].message.content;
      content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

      console.log(`[AI] ✅ SUCCESS with OpenRouter model: ${model}`);
      return JSON.parse(content);
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      const statusCode = error.response?.status || 'Unknown';
      console.warn(`[AI] ⚠️ OpenRouter model ${model} failed: ${errorMessage} (Status: ${statusCode})`);
      errors.push(`${model}: ${errorMessage} (HTTP ${statusCode})`);
      // continue to next model in fallback array
    }
  }
  
  throw new Error(`All OpenRouter models failed. Details: ${errors.join(' | ')}`);
};

// NVIDIA Grok API call
const callNvidiaGrok = async (prompt, systemInstruction, language) => {
  try {
    const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
      model: 'meta/llama-3.1-8b-instruct',
      messages: [
        {
          role: 'system',
          content: systemInstruction
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from NVIDIA Grok API');
    }
    
    let content = response.data.choices[0].message.content;
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

    return JSON.parse(content);
  } catch (error) {
    const errorMessage = error.response?.data?.detail || error.response?.data?.error?.message || error.message;
    const statusCode = error.response?.status || 'Unknown';
    if (statusCode === 401) {
      throw new Error('Invalid NVIDIA Grok API key');
    }
    throw new Error(`Nvidia API Error: ${errorMessage} (HTTP ${statusCode})`);
  }
};

// Google Gemini API call
const callGemini = async (prompt, systemInstruction, language) => {
  if (!geminiAI || !process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API is not configured (GEMINI_API_KEY missing).');
  }

  const response = await geminiAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  if (!response?.text) {
    throw new Error('Invalid response from Gemini API');
  }

  return JSON.parse(response.text);
};

// Define fallback order for each provider
const getProviderFallbackOrder = (primaryProvider) => {
  const fallbackOrder = {
    'openrouter': ['openrouter', 'google', 'nvidia-grok'],
    'nvidia-grok': ['nvidia-grok', 'openrouter', 'google'],
    'google': ['google', 'openrouter', 'nvidia-grok']
  };
  
  return fallbackOrder[primaryProvider] || fallbackOrder['openrouter'];
};

// Try each provider with automatic fallback on failure
const tryProvidersWithFallback = async (prompt, systemInstruction, language, providerOrder) => {
  const errors = {};
  let lastUsedProvider = null;
  
  for (const provider of providerOrder) {
    try {
      // Check if provider is configured
      if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
        errors[provider] = 'API key not configured';
        console.log(`[AI] ⏭️  Skipping OpenRouter: API key not configured`);
        continue;
      }
      if (provider === 'nvidia-grok' && !process.env.NVIDIA_GROK_API_KEY) {
        errors[provider] = 'API key not configured';
        console.log(`[AI] ⏭️  Skipping NVIDIA Grok: API key not configured`);
        continue;
      }
      if (provider === 'google' && !process.env.GEMINI_API_KEY) {
        errors[provider] = 'API key not configured';
        console.log(`[AI] ⏭️  Skipping Google Gemini: API key not configured`);
        continue;
      }

      console.log(`[AI] 🔄 Attempting provider: ${provider.toUpperCase()}`);
      
      let result;
      
      switch(provider) {
        case 'openrouter':
          result = await callOpenRouter(prompt, systemInstruction, language);
          lastUsedProvider = 'openrouter';
          console.log(`[AI] ✅ SUCCESS with OpenRouter (model: ${process.env.OPENROUTER_MODEL || 'gpt-3.5-turbo'})`);
          return result;
        
        case 'nvidia-grok':
          result = await callNvidiaGrok(prompt, systemInstruction, language);
          lastUsedProvider = 'nvidia-grok';
          console.log('[AI] ✅ SUCCESS with NVIDIA Grok API');
          return result;
        
        case 'google':
          result = await callGemini(prompt, systemInstruction, language);
          lastUsedProvider = 'google';
          console.log('[AI] ✅ SUCCESS with Google Gemini API');
          return result;
      }
    } catch (err) {
      console.warn(`[AI] ⚠️  ${provider.toUpperCase()} failed: ${err.message}`);
      errors[provider] = err.message;
      // Continue to next provider in fallback chain
    }
  }
  
  // All providers failed - throw error with details
  console.error('[AI] ❌ ALL AI PROVIDERS FAILED');
  const errorDetails = Object.entries(errors)
    .map(([provider, error]) => `${provider}: ${error}`)
    .join(' | ');
  throw new Error(`All AI providers failed. Details: ${errorDetails}`);
};

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
2. If the requested regulatory information is NOT explicitly provided in the verified context, you MUST reply exactly with: "INSUFFICIENT_DATA — Not available in the GAWK ruleset." Do NOT guess or use general legal knowledge.
3. NEVER change the official deterministic rule evaluation results. If a rule 'DOES_NOT_APPLY', you cannot change it to 'APPLIES'.
4. NEVER recalculate or change the official Risk Score. You can only explain the score provided.
5. NEVER invent exact deadlines if only a frequency (e.g. 'Monthly') is provided.
6. Every legal/compliance claim you make MUST be backed by a source provided in the context. You must cite the 'regulatorySource' exactly as provided.
7. Distinguish between system facts (e.g., "The system marks this as Overdue") and your explanation.
8. Document extraction is not verified evidence. Never state an extracted value as fact unless its confidence is at least 80, the evidence verification status is VERIFIED, or the value was manually corrected. For lower-confidence values, say the document appears to show it and request manual verification.
9. Never say a generated draft is filed, government-approved, legally certified, or an official form. It is only a draft requiring human review.
10. If the user asks if a submission is ready, check the Submission Status in the context. Inform them of missing requirements if it is not ready. Never invent a submission URL. If one is not in the context, say it's not available in GAWK.

LANGUAGE REQUIREMENT:
${langInstruction}
Translate ONLY the "answer", "businessMeaning", and "recommendedAction" fields into the requested language.
Do NOT translate "ruleCode", "actName", "section", "authority", or "officialUrl". These must remain exactly as provided in the context to preserve legal accuracy.

OUTPUT FORMAT (JSON ONLY):
You must output a strictly valid JSON object matching this schema:
{
  "answer": "A short, direct explanation answering the user's question. If data is missing, output 'INSUFFICIENT_DATA — Not available in the GAWK ruleset.'",
  "businessMeaning": "A business-specific explanation of what this means for them.",
  "recommendedAction": "Action based on existing data, or null.",
  "actionType": "If the user is explicitly asking to prepare or draft a document/form, output 'PREPARE_DOCUMENT'. Otherwise null.",
  "actionTarget": "If actionType is PREPARE_DOCUMENT, output the relevant ruleCode (e.g. 'FSSAI_LICENSE'). Otherwise null.",
  "sources": [
    {
      "ruleCode": "string",
      "actName": "string",
      "section": "string",
      "authority": "string",
      "verificationStatus": "string",
      "officialUrl": "string"
    }
  ]
}

Only return sources if they were explicitly provided in the context for the rules you are discussing. Do not invent source details.
Do NOT use Markdown formatting outside the JSON structure. Returns JSON only.`;
};

exports.generateComplianceAnswer = async (context, userQuestion, language = 'en') => {
  const primaryProvider = process.env.AI_PROVIDER || 'openrouter';
  const systemInstruction = getSystemPrompt(language);
  
  const prompt = `
=== VERIFIED CONTEXT ===
${JSON.stringify(context, null, 2)}
=== END CONTEXT ===

USER QUESTION: ${userQuestion}
`;

  try {
    console.log(`[AI] Primary provider: ${primaryProvider.toUpperCase()}`);
    
    // Get fallback order
    const providerOrder = getProviderFallbackOrder(primaryProvider);
    console.log(`[AI] Fallback chain: ${providerOrder.map(p => p.toUpperCase()).join(' → ')}`);
    
    // Try providers with automatic fallback
    const result = await tryProvidersWithFallback(prompt, systemInstruction, language, providerOrder);

    if (!result) {
      throw new Error('AI provider returned empty response');
    }

    return result;
  } catch (err) {
    console.error(`[AI] Final Error:`, err.message);
    throw err;
  }
};

exports.generateDocumentDraft = async (businessProfile, obligation, gawkContext, templateDetails) => {
  const primaryProvider = process.env.AI_PROVIDER || 'openrouter';
  
  const systemInstruction = `You are the SurakshaSetu AI Compliance Document Copilot.
Your ONLY role is to generate non-official, internal draft compliance documents.

CRITICAL REGULATORY RULE — GAWK ONLY:
1. For this implementation, the GAWK reference document is your ONLY regulatory rules/data source.
2. You MUST use ONLY the regulatory information contained in the GAWK reference text.
3. Do NOT invent legal rules, thresholds, deadlines, penalties, applicability conditions, portals, authorities, or registration requirements.
4. Do NOT guess when GAWK does not contain the required information.
5. If GAWK does not contain enough information for a specific required field or clause, you MUST mark the information as: "Not available in the GAWK ruleset".
6. Every generated document MUST begin with the exact text: "DRAFT — REQUIRES HUMAN VERIFICATION BEFORE SUBMISSION"
7. You MUST append a "REGULATORY BASIS" section at the end of the document citing the Act, Rule/Section, Authority, and Source from the APPLICABLE OBLIGATION's regulatorySource. If missing, write "SOURCE INFORMATION UNAVAILABLE IN GAWK."

OUTPUT FORMAT (JSON ONLY):
You must output a strictly valid JSON object matching this schema:
{
  "draftContent": "The full text of the generated draft document, formatted with newlines (\\n)."
}`;

  const prompt = `=== BUSINESS PROFILE ===\n${JSON.stringify(businessProfile, null, 2)}
=== APPLICABLE OBLIGATION ===\n${JSON.stringify(obligation, null, 2)}
=== TEMPLATE REQUIREMENTS ===\n${JSON.stringify(templateDetails, null, 2)}
=== GAWK REGULATORY REFERENCE (SOURCE OF TRUTH) ===\n${gawkContext}

Task: Generate the draft document based ONLY on the provided GAWK Regulatory Reference and Business Profile.
`;

  try {
    console.log(`[AI] Generating document draft with ${primaryProvider.toUpperCase()}`);
    const providerOrder = getProviderFallbackOrder(primaryProvider);
    const result = await tryProvidersWithFallback(prompt, systemInstruction, 'en', providerOrder);
    if (!result || !result.draftContent) throw new Error('AI provider returned empty response for document draft');
    return result.draftContent;
  } catch (err) {
    console.error(`[AI] Final Error in Document Generation:`, err.message);
    throw err;
  }
};

// Helper function to get available providers
exports.getAvailableProviders = () => {
  const available = ['openrouter', 'nvidia-grok', 'google'];
  const configured = [];
  
  if (process.env.OPENROUTER_API_KEY) configured.push('openrouter');
  if (process.env.NVIDIA_GROK_API_KEY) configured.push('nvidia-grok');
  if (process.env.GEMINI_API_KEY) configured.push('google');
  
  return {
    available,
    configured,
    active: process.env.AI_PROVIDER || 'openrouter'
  };
};

// Health check for AI provider
exports.checkAIProvider = async () => {
  try {
    const primaryProvider = process.env.AI_PROVIDER || 'openrouter';
    const fallbackOrder = getProviderFallbackOrder(primaryProvider);
    
    return {
      status: 'ok',
      provider: primaryProvider,
      fallbackChain: fallbackOrder,
      providers: exports.getAvailableProviders(),
      message: `Primary: ${primaryProvider} | Fallback chain: ${fallbackOrder.map(p => p.toUpperCase()).join(' → ')}`
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message,
      provider: process.env.AI_PROVIDER || 'openrouter'
    };
  }
};
