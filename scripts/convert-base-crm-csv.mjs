import fs from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2] || './ST1 _ Agnes _ GrowthPack V26 (Inside Sales) - BASE_CRM.csv';

function parseCsv(text) {
  const out = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((v) => String(v || '').trim()));
}

function normalizeKey(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function makeObjects(rows) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => ['leadid', 'idlead', 'data'].includes(normalizeKey(cell))));
  const index = headerIndex >= 0 ? headerIndex : 0;
  const headers = (rows[index] || []).map(normalizeKey);
  return rows.slice(index + 1).map((row, rowIndex) => {
    const obj = { __rowNumber: rowIndex + index + 2 };
    headers.forEach((header, colIndex) => { if (header) obj[header] = row[colIndex] || ''; });
    return obj;
  });
}

function pick(row, names) {
  const keys = names.map(normalizeKey);
  for (const name of keys) {
    if (row[name] !== undefined && String(row[name]).trim() !== '') return row[name];
  }
  for (const name of keys) {
    const found = Object.keys(row).find((key) => key.includes(name) || name.includes(key));
    if (found && String(row[found]).trim() !== '') return row[found];
  }
  return '';
}

function bool(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return 0;
  if (['1', '1.0', 'sim', 'x', 'true', 'yes'].includes(text)) return 1;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 1 ? 1 : 0;
}

function money(value) {
  const parsed = Number(String(value ?? '').replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(y, m, d) {
  const year = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateValue(value) {
  const text = String(value ?? '').trim().replace(/^'/, '');
  if (!text) return '';
  if (/^\d+(\.\d+)?$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86400000);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) return isoDate(match[3], match[2], match[1]);
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return isoDate(match[1], match[2], match[3]);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return isoDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
  return '';
}

function record(row) {
  const leadId = String(pick(row, ['Lead ID', 'ID Lead', 'ID do Lead', 'leadId', 'id']) || row.__rowNumber).replace(/\.0$/, '').trim();
  const dateRaw = String(pick(row, ['Data', 'Criado em', 'Data de criacao', 'Data de criação', 'Data de entrada', 'createdAt', 'created_at']) || '').trim();
  const date = dateValue(dateRaw);
  const meta = bool(pick(row, ['Meta Ads', 'META ADS', 'metaAds']));
  const google = bool(pick(row, ['Google Ads', 'GOOGLE ADS', 'googleAds']));
  let origin = String(pick(row, ['Origem', 'Canal', 'Fonte']) || '').trim();
  if (!origin) origin = meta && google ? 'Meta + Google' : meta ? 'Meta Ads' : google ? 'Google Ads' : 'Sem origem marcada';
  return {
    dateRaw,
    date,
    leadId,
    name: pick(row, ['Nome', 'Cliente', 'Contato', 'name']) || '',
    value: money(pick(row, ['Valor', 'Receita', 'Ticket'])),
    leadTag: bool(pick(row, ['LEAD', 'leadTag'])),
    mql: bool(pick(row, ['MQL'])),
    sql: bool(pick(row, ['SQL'])),
    opportunity: bool(pick(row, ['OPORTUNIDADE', 'Oportunidade', 'OPP'])),
    purchase: bool(pick(row, ['COMPRA', 'Compra', 'Venda'])),
    lostFlag: bool(pick(row, ['LEAD PERDIDO', 'Lead Perdido', 'Perdido'])),
    metaAds: meta,
    googleAds: google,
    seller: String(pick(row, ['Responsavel', 'Responsável', 'RESPONSAVEL', 'Vendedor', 'Vendedora', 'seller']) || 'Sem responsavel').trim(),
    lossReason: String(pick(row, ['MOTIVO DE PERDA', 'Motivo de perda', 'Motivo']) || '').trim(),
    tags: pick(row, ['Tags', 'TAGS']) || '',
    origin
  };
}

function toCsvField(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(records) {
  const headers = ['dateRaw', 'date', 'leadId', 'name', 'value', 'leadTag', 'mql', 'sql', 'opportunity', 'purchase', 'lostFlag', 'metaAds', 'googleAds', 'seller', 'lossReason', 'tags', 'origin'];
  const lines = [headers.join(',')];
  for (const item of records) {
    lines.push(headers.map((header) => toCsvField(item[header])).join(','));
  }
  return lines.join('\n') + '\n';
}

const raw = await fs.readFile(inputPath, 'utf8');
const rows = makeObjects(parseCsv(raw));
const records = rows.map(record).filter((item) => item.leadId && item.date);

await fs.mkdir('./data', { recursive: true });
await fs.mkdir('./public/data', { recursive: true });
await fs.writeFile(path.join('./data', 'growthpack-base-crm.json'), JSON.stringify(records), 'utf8');
await fs.writeFile(path.join('./data', 'growthpack-base-crm.pretty.json'), JSON.stringify(records, null, 2), 'utf8');
await fs.writeFile(path.join('./data', 'growthpack-base-crm.csv'), toCsv(records), 'utf8');
await fs.writeFile(path.join('./public/data', 'growthpack-base-crm.json'), JSON.stringify(records), 'utf8');

console.log(`OK: ${records.length} registros gerados a partir de ${rows.length} linhas lidas de "${inputPath}".`);
console.log('Atualizados: data/growthpack-base-crm.json, data/growthpack-base-crm.pretty.json, data/growthpack-base-crm.csv, public/data/growthpack-base-crm.json');
