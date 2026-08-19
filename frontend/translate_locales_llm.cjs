const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'your_api_key_here';

function callOpenRouter(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }]
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, res => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          if (json.choices && json.choices.length > 0) {
            resolve(json.choices[0].message.content);
          } else {
            reject(new Error("Invalid response from OpenRouter: " + responseBody));
          }
        } catch(e) {
          reject(e);
        }
      });
    });

    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

async function main() {
  const localesDir = path.join(__dirname, 'src', 'locales');
  const enContent = fs.readFileSync(path.join(localesDir, 'en.ts'), 'utf8');
  
  const enMatches = [...enContent.matchAll(/"([^"]+)":\s*"(.*)"/g)];
  const enDict = {};
  for (const m of enMatches) enDict[m[1]] = m[2];

  // We'll just translate Tamil to show the user it works!
  const file = 'ta.ts';
  const langName = 'Tamil';
  const filePath = path.join(localesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const matches = [...content.matchAll(/"([^"]+)":\s*"(.*)"/g)];
  
  let toTranslate = {};
  
  for (const m of matches) {
    const key = m[1];
    const val = m[2];
    if (enDict[key] === val && /[a-zA-Z]/.test(val) && !key.startsWith('nav.') && !key.startsWith('dash.') && !key.startsWith('ui.') && !key.startsWith('topbar.') && !key.startsWith('obl.')) {
      toTranslate[key] = val;
    }
  }

  const keys = Object.keys(toTranslate);
  if(keys.length === 0) {
    console.log("No new strings to translate for", file);
    return;
  }

  console.log(`Found ${keys.length} strings to translate for ${langName}. Sending to LLM...`);
  
  // We send them as a JSON dictionary to the LLM to translate values
  const prompt = `Translate the values in this JSON object to ${langName}. Preserve variables like {count} or {name} exactly. Return ONLY valid JSON, no markdown formatting or backticks. \n\n` + JSON.stringify(toTranslate, null, 2);
  
  try {
    let result = await callOpenRouter(prompt);
    // clean markdown if returned
    result = result.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const translatedDict = JSON.parse(result);
    
    let updatedCount = 0;
    for (const key of Object.keys(translatedDict)) {
      const originalVal = toTranslate[key];
      const translatedVal = translatedDict[key].replace(/"/g, '\\"');
      const regex = new RegExp(`("${key}":\\s*)"${originalVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
      content = content.replace(regex, `$1"${translatedVal}"`);
      updatedCount++;
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Successfully updated ${updatedCount} translations in ${file}`);
    
  } catch (err) {
    console.error("Translation failed:", err.message);
  }
}

main().catch(console.error);
