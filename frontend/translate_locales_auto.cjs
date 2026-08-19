const fs = require('fs');
const path = require('path');
const { translate } = require('@vitalets/google-translate-api');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function main() {
  const localesDir = path.join(__dirname, 'src', 'locales');
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.ts') && (f === 'ta.ts' || f === 'hi.ts'));
  
  // parse en.ts
  const enContent = fs.readFileSync(path.join(localesDir, 'en.ts'), 'utf8');
  const enMatches = [...enContent.matchAll(/"([^"]+)":\s*"(.*)"/g)];
  const enDict = {};
  for (const m of enMatches) {
    enDict[m[1]] = m[2];
  }

  console.log(`Parsed ${Object.keys(enDict).length} keys from en.ts`);

  for (const file of files) {
    if (file === 'en.ts' || file === 'hinglish.ts') continue;
    
    // We'll limit it to the files they likely care most about if this errors out, 
    // but the script processes all files.
    const langCode = file.replace('.ts', '');
    const filePath = path.join(localesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    const matches = [...content.matchAll(/"([^"]+)":\s*"(.*)"/g)];
    
    let updatedCount = 0;
    
    console.log(`\nProcessing ${file}...`);
    
    for (const m of matches) {
      const key = m[1];
      const val = m[2];
      
      // If the value in this language file is EXACTLY the same as the english value
      // And it contains letters (not just a symbol or number)
      // And it's not a generic UI or nav item that might be purposely identical (or already skipped)
      if (enDict[key] === val && /[a-zA-Z]/.test(val) && !key.startsWith('nav.') && !key.startsWith('dash.') && !key.startsWith('ui.') && !key.startsWith('topbar.') && !key.startsWith('obl.')) {
        try {
          console.log(`Translating [${langCode}] ${key}`);
          const res = await translate(val, { to: langCode });
          
          let translatedText = res.text.replace(/"/g, '\\"');
          
          const regex = new RegExp(`("${key}":\\s*)"${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
          content = content.replace(regex, `$1"${translatedText}"`);
          updatedCount++;
          
          await delay(200); 
        } catch (e) {
          console.error(`Failed to translate ${key} for ${langCode}:`, e.message);
          if (e.message.includes('TooManyRequests') || e.message.includes('429')) {
             console.log('Waiting 10 seconds...');
             await delay(10000);
          }
        }
      }
    }
    
    if (updatedCount > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`Updated ${updatedCount} translations in ${file}`);
    } else {
      console.log(`No translations needed for ${file}`);
    }
  }
}

main().catch(console.error);
