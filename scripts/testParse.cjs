const fs = require('fs');

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

const lines = fs.readFileSync('src/data/updated_products.csv', 'utf8')
  .split(/\r?\n/)
  .filter(l => l.trim().length > 0);

const header = parseCSVLine(lines[0]);
console.log('Header columns:', header);

const rows = [];
const seenSkus = new Set();
for (let i = 1; i < lines.length; i++) {
  if (lines[i].startsWith('Auto SKU')) continue;
  const parsed = parseCSVLine(lines[i]);
  const sku = parsed[0];
  if (!sku) continue;
  if (!seenSkus.has(sku.toUpperCase())) {
    seenSkus.add(sku.toUpperCase());
    rows.push({
      sku: parsed[0],
      stockClass: parsed[1],
      subCategory: parsed[2],
      name: parsed[3],
      brand: parsed[4],
      barcode: parsed[5],
      volumeMl: parseFloat(parsed[6]) || 750,
      abv: parseFloat(parsed[7]) || (parsed[2]?.toLowerCase().includes('beer') ? 5 : 40),
      packSize: parseFloat(parsed[8]) || (parsed[8]?.includes('1 bottle') ? 1 : 12),
      origin: parsed[9] || 'Kenya',
      wholesaleKes: parseFloat(parsed[10]) || 0,
      retailKes: parseFloat(parsed[11]) || 0,
      totalBottles: parseFloat(parsed[12]) || 0,
    });
  }
}

console.log('Total unique rows parsed from CSV:', rows.length);
console.log('Sample row 0:', rows[0]);
console.log('Sample row last:', rows[rows.length - 1]);
