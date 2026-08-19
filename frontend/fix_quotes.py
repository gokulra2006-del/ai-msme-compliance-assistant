import glob

files = glob.glob('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/locales/*.ts')
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('Click "Why?"', 'Click \\"Why?\\"')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed quotes in {filepath}")
