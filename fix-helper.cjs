const fs = require('fs');
let code = fs.readFileSync('server/utils/geminiHelper.ts', 'utf8');

code = code.replace(
  /\s*'gemini-3\.1-flash-lite',\s*'gemini-2\.5-flash',\s*/g,
  "\n    'gemini-3.1-flash-lite',\n    'gemini-2.5-flash',\n    'gemini-2.0-flash-lite-preview-02-05',\n    'gemini-1.5-flash',\n  "
);

fs.writeFileSync('server/utils/geminiHelper.ts', code);
