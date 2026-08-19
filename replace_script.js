const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.md')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            
            // Replace cases
            content = content.replace(/NOT AVAILABLE IN GAWK/g, 'NOT AVAILABLE IN SURAKSHA RULES');
            content = content.replace(/GAWK ruleset/g, 'Suraksha Rules engine');
            content = content.replace(/GAWK Verified/g, 'Suraksha Rules Verified');
            content = content.replace(/GAWK/g, 'Suraksha Rules');
            content = content.replace(/gawkReference/g, 'surakshaRulesReference');
            content = content.replace(/gawk\.docx/g, 'suraksha_rules.docx');
            content = content.replace(/gawkLoader/g, 'rulesLoader');
            content = content.replace(/loadGawkContext/g, 'loadRulesContext');
            content = content.replace(/cachedGawkText/g, 'cachedRulesText');
            content = content.replace(/GAWK_DOCX_PATH/g, 'SURAKSHA_RULES_DOCX_PATH');
            
            if (original !== content) {
                fs.writeFileSync(fullPath, content);
                console.log('Updated: ' + fullPath);
            }
        }
    });
}

replaceInDir(path.join(__dirname, 'frontend/src'));
replaceInDir(path.join(__dirname, 'backend/src'));
replaceInDir(path.join(__dirname, 'backend/scripts'));
