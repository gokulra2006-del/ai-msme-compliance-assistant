const fs = require('fs');
const path = require('path');
const localesDir = path.join(__dirname, 'src', 'locales');

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
  const filePath = path.join(localesDir, f);
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(/\\\\"/g, '\\"');
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Fixed ${f}`);
  }
});
