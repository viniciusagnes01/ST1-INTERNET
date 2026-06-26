const DEFAULT_SPREADSHEET_ID = '1BurqRDqYbWq8dPVxXiKjWH6WmfBNoe39AymwJM8LpFA';
const DEFAULT_GID = '1699545222';

function csvToRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = (rows.shift() || []).map((h) => String(h || '').trim());
  return rows
    .filter((r) => r.some((v) => String(v || '').trim()))
    .map((r) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] || ''; });
      return o;
    });
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') return row[name];
  }
  const normalized = Object.entries(row).reduce((acc, [key, value]) => {
    acc[String(key).trim().toLowerCase()] = value;
    return acc;
  }, {});
  for (const name of names) {
    const value = normalized[String(name).trim().toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function bool(v) {
  if (typeof v === 'number') return v >= 1 ? 1 : 0;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return 0;
  if (['1', '1.0', 'true', 'sim', 'yes', 'x'].includes(s)) return 1;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 1 ? 1 : 0;
}

function money(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normDate(v) {
  const s = String(v ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const parsed = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(s)) * 86400000);
    const y = parsed.getUTCFullYear();
    const mo = parsed.getUTCMonth() + 1;
    const d = parsed.getUTCDate();
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function origin(row) {
  const explicit = String(pick(row, ['Origem', 'ORIGEM', 'origin', 'Canal', 'CANAL']) || '').trim();
  if (explicit) return explicit;
  const meta = bool(pick(row, ['META ADS', 'Meta Ads', 'metaAds']));
  const google = bool(pick(row, ['GOOGLE ADS', 'Google Ads', 'googleAds']));
  if (meta && google) return 'Meta + Google';
  if (meta) return 'Meta Ads';
  if (google) return 'Google Ads';
  return 'Sem origem marcada';
}

function normalize(row) {
  return {
    date: normDate(pick(row, ['Data', 'DATA', 'date', 'dateRaw'])),
    leadId: String(pick(row, ['Lead ID', 'LEAD ID', 'leadId', 'ID', 'Id']) || '').replace(/\.0$/, '').trim(),
    name: pick(row, ['Nome', 'NOME', 'name']) || '',
    seller: String(pick(row, ['RESPONSAVEL', 'Responsavel', 'Responsável', 'seller']) || 'Sem responsavel').trim() || 'Sem responsavel',
    origin: origin(row),
    leadTag: bool(pick(row, ['LEAD', 'leadTag'])),
    mql: bool(pick(row, ['MQL', 'mql'])),
    sql: bool(pick(row, ['SQL', 'sql'])),
    opportunity: bool(pick(row, ['OPORTUNIDADE', 'Oportunidade', 'opportunity'])),
    purchase: bool(pick(row, ['COMPRA', 'Compra', 'purchase'])),
    lostFlag: bool(pick(row, ['LEAD PERDIDO', 'Lead Perdido', 'lostFlag'])),
    lossReason: String(pick(row, ['MOTIVO DE PERDA', 'Motivo de perda', 'lossReason']) || '').trim(),
    value: money(pick(row, ['Valor', 'VALOR', 'value'])),
    metaAds: bool(pick(row, ['META ADS', 'Meta Ads', 'metaAds'])),
    googleAds: bool(pick(row, ['GOOGLE ADS', 'Google Ads', 'googleAds'])),
    tags: pick(row, ['TAGS', 'Tags', 'tags']) || ''
  };
}

function safeParam(value) {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = req.query || {};
    const spreadsheetId = safeParam(query.spreadsheetId) || process.env.GROWTHPACK_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
    const gid = safeParam(query.gid) || process.env.GROWTHPACK_BASE_CRM_GID || DEFAULT_GID;
    const forcedCsvUrl = typeof query.csvUrl === 'string' && query.csvUrl.startsWith('https://docs.google.com/') ? query.csvUrl : '';
    const csvUrl = forcedCsvUrl || process.env.GROWTHPACK_CSV_URL || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_=${Date.now()}`;
    const response = await fetch(csvUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    const text = await response.text();
    if (!response.ok) throw new Error(`CSV HTTP ${response.status}: ${text.slice(0, 160)}`);
    const records = csvToRows(text).map(normalize).filter((r) => r.leadId && r.date);
    const dates = records.map((r) => r.date).sort();
    res.status(200).json({
      ok: true,
      source: 'growthpack-csv-live',
      spreadsheetId,
      gid,
      updatedAt: new Date().toISOString(),
      count: records.length,
      period: { start: dates[0] || '', end: dates[dates.length - 1] || '' },
      records
    });
  } catch (error) {
    res.status(200).json({ ok: false, source: 'fallback-required', updatedAt: new Date().toISOString(), error: error.message, count: 0, records: [] });
  }
}
