import fs from 'node:fs/promises';

const csvUrl = process.env.GROWTHPACK_CSV_URL;
if (!csvUrl) {
  console.error('Defina GROWTHPACK_CSV_URL antes de executar.');
  process.exit(1);
}

const res = await fetch(csvUrl);
if (!res.ok) throw new Error(`Erro ao baixar GrowthPack: ${res.status}`);

const csv = await res.text();
await fs.mkdir('./data', { recursive: true });
await fs.writeFile('./data/growthpack-base-crm.csv', csv, 'utf8');
console.log('CSV atualizado em data/growthpack-base-crm.csv');
