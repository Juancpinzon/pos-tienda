const fs = require('fs');
const content = fs.readFileSync('src/db/seed.ts', 'utf8');
const matches = content.match(/p\('/g);
console.log('TOTAL CONFIG:', matches ? matches.length : 0);
