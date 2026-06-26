const DEFAULT_SPREADSHEET_ID = '1BurqRDqYbWq8dPVxXiKjWH6WmfBNoe39AymwJM8LpFA';
const DEFAULT_GID = '1699545222';
const DEFAULT_START = '2026-05-01';
const DEFAULT_END = '2026-06-30';

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
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
  const date = dateValue(pick(row, ['Data', 'Criado em', 'Data de criacao', 'Data de criação', 'Data de entrada', 'createdAt', 'created_at']));
  const meta = bool(pick(row, ['Meta Ads', 'META ADS', 'metaAds']));
  const google = bool(pick(row, ['Google Ads', 'GOOGLE ADS', 'googleAds']));
  let origin = String(pick(row, ['Origem', 'Canal', 'Fonte']) || '').trim();
  if (!origin) origin = meta && google ? 'Meta + Google' : meta ? 'Meta Ads' : google ? 'Google Ads' : 'Sem origem marcada';
  return {
    date,
    leadId,
    name: pick(row, ['Nome', 'Cliente', 'Contato', 'name']) || '',
    seller: String(pick(row, ['Responsavel', 'Responsável', 'RESPONSAVEL', 'Vendedor', 'Vendedora', 'seller']) || 'Sem responsavel').trim(),
    origin,
    leadTag: bool(pick(row, ['LEAD', 'leadTag'])),
    mql: bool(pick(row, ['MQL'])),
    sql: bool(pick(row, ['SQL'])),
    opportunity: bool(pick(row, ['OPORTUNIDADE', 'Oportunidade', 'OPP'])),
    purchase: bool(pick(row, ['COMPRA', 'Compra', 'Venda'])),
    lostFlag: bool(pick(row, ['LEAD PERDIDO', 'Lead Perdido', 'Perdido'])),
    lossReason: String(pick(row, ['MOTIVO DE PERDA', 'Motivo de perda', 'Motivo']) || '').trim(),
    value: money(pick(row, ['Valor', 'Receita', 'Ticket'])),
    metaAds: meta,
    googleAds: google,
    tags: pick(row, ['Tags', 'TAGS']) || ''
  };
}

function inPeriod(item, start, end) {
  if (!item.date) return false;
  if (start && item.date < start) return false;
  if (end && item.date > end) return false;
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = req.query || {};
    const spreadsheetId = String(query.spreadsheetId || process.env.GROWTHPACK_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID).trim();
    const gid = String(query.gid || process.env.GROWTHPACK_BASE_CRM_GID || DEFAULT_GID).trim();
    const start = String(query.start || process.env.GROWTHPACK_START || DEFAULT_START).slice(0, 10);
    const end = String(query.end || process.env.GROWTHPACK_END || DEFAULT_END).slice(0, 10);
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    const text = await response.text();
    if (!response.ok) throw new Error(`CSV HTTP ${response.status}`);
    const objects = makeObjects(parseCsv(text));
    const allRecords = objects.map(record).filter((item) => item.leadId && item.date);
    const records = allRecords.filter((item) => inPeriod(item, start, end));
    const dates = records.map((item) => item.date).sort();
    res.status(200).json({
      ok: true,
      source: 'growthpack-csv-may-june',
      spreadsheetId,
      gid,
      updatedAt: new Date().toISOString(),
      rawCount: objects.length,
      fullCount: allRecords.length,
      count: records.length,
      ignoredRows: Math.max(0, objects.length - allRecords.length),
      serverPeriod: { start, end },
      period: { start: dates[0] || start, end: dates[dates.length - 1] || end },
      records
    });
  } catch (error) {
    res.status(200).json({ ok: false, source: 'fallback-required', updatedAt: new Date().toISOString(), error: error.message, count: 0, records: [] });
  }
}
