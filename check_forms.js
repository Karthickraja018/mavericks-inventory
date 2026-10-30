const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.next') files = files.concat(walk(full));
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk('src');
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const formRegex = /<form[\s\S]*?>/g;
  let match;
  while ((match = formRegex.exec(content)) !== null) {
    const form = match[0];
    const index = match.index;
    const lineNumber = content.substring(0, index).split('\n').length;
    console.log(`[FORM] ${file}:${lineNumber} -> ${form.replace(/\s+/g, ' ')}`);
  }
}

