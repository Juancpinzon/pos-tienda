const fs = require('fs');
let content = fs.readFileSync('src/db/seed.ts', 'utf8');

// 1. Rename category 10 to 'Cigarrillos y Tabacos'
content = content.replace(
  /{ nombre: 'Cigarrillos',\s*emoji: '🚬',\s*orden: 10 }/,
  "{ nombre: 'Cigarrillos y Tabacos', emoji: '🚬', orden: 10 }"
);

// 2. Remove category 40
content = content.replace(
  /\s*{\s*nombre: 'Tabacos y Cigarros',\s*emoji: '🚬',\s*orden: 47\s*},?/,
  ''
);

// We need to operate line by line for product replacements to avoid huge regex mess
let lines = content.split('\n');
const fruitVegNames = [
  'Zanahoria a Granel', 'Cebolla Cabezona x1', 'Ajo Cabeza x1', 'Ajo Pelado',
  'Apio Rama', 'Cilantro Ramo', 'Perejil Ramo', 'Pimentón', 'Ahuyama',
  'Habichuela', 'Espinaca', 'Brócoli', 'Coliflor', 'Remolacha', 'Naranja x1',
  'Mandarina x1', 'Manzana ', 'Pera x1', 'Durazno', 'Kiwi', 'Uvas Rojas',
  'Fresas', 'Mora', 'Maracuyá x1', 'Granadilla', 'Papaya', 'Sandía'
];

let seenAguardientes = new Set();
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  if (line.includes("p('")) {
    let match = line.match(/p\('([^']+)',\s*(\d+)/);
    if (match) {
      let name = match[1];
      let cat = parseInt(match[2]);
      
      // Fix 1: Vegetables in 10 -> 9
      if (cat === 10) {
        let isVeg = fruitVegNames.some(v => name.includes(v));
        if (isVeg) {
          line = line.replace(/,\s*10,/, ',   9,');
        }
      }
      
      // Fix 3: Category 40 -> 10
      if (cat === 40) {
        line = line.replace(/,\s*40,/, ',   10,');
      }
      
      // Fix 2: Aguardientes to 18 and remove duplicates
      if (name.includes('Aguardiente')) {
        let oldLine = line; // for debugging
        if (cat !== 18) {
          // Replace exactly the cat ID with 18, keeping formatting
          line = line.replace(/(p\('[^']+',\s*)\d+(,)/, '$118$2');
        }
        if (seenAguardientes.has(name)) {
          console.log('Removing duplicate Aguardiente:', name);
          continue; // skip duplicate
        }
        seenAguardientes.add(name);
      }
    }
  }
  newLines.push(line);
}

fs.writeFileSync('src/db/seed.ts', newLines.join('\n'));
console.log('Seed updated.');
