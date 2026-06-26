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

function key(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pick(row, names) {
  const map = {};
  Object.entries(row || {}).forEach(([k, v]) => { map[key(k)] = v; });
  for (const name of names) {
    const value = map[key(name)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  const wanted = names.map(key).filter(Boolean);
  for (const [rawKey, value] of Object.entries(row || {})) {
    const k = key(rawKey);
    if (wanted.some((name) => k.includes(name))) {
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
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

function isoDate(year, month, day) {
  const y = Number(year) < 100 ? 2000 + Number(year) : Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normDate(v) {
  const s = String(v ?? '').trim().replace(/^'/, '');
  if (!s) return '';
  if (/^\d+(\.\d+)?$/.test(s)) {
    const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return isoDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
  }
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[\sT,].*)?$/);
  if (m) return isoDate(m[3], m[2], m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[\sT,].*)?$/);
  if (m) return isoDate(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:[\sT,].*)?$/);
  if (m) return isoDate(m[3], m[2], m[1]);
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return isoDate(m[3], m[2], m[1]);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return isoDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
  return '';
}

function origin(row) {
  const explicit = String(pick(row, ['Origem', 'ORIGEM', 'origin', 'Canal', 'Fonte']) || '').trim();
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
    date: normDate(pick(row, ['Data', 'DATA', 'date', 'dateRaw', 'Criado em', 'Data de criacao', 'Data de criação', 'Data de entrada', 'Data Lead', 'Data do Lead', 'created_at', 'createdAt'])),
    leadId: String(pick(row, ['Lead ID', 'LEAD ID', 'leadId', 'lead_id', 'ID Lead', 'ID do Lead', 'ID']) || '').replace(/\.0$/, '').trim(),
    name: pick(row, ['Nome', 'NOME', 'name']) || '',
    seller: String(pick(row, ['RESPONSAVEL', 'Responsavel', 'Responsável', 'seller', 'Vendedor', 'Vendedora']) || 'Sem responsavel').trim() || 'Sem responsavel',
    origin: origin(row),
    leadTag: bool(pick(row, ['LEAD', 'leadTag'])),
    mql: bool(pick(row, ['MQL', 'mql'])),
    sql: bool(pick(row, ['SQL', 'sql'])),
    opportunity: bool(pick(row, ['OPORTUNIDADE', 'Oportunidade', 'opportunity'])),
    purchase: bool(pick(row, ['COMPRA', 'Compra', 'purchase', 'Venda'])),
    lostFlag: bool(pick(row, ['LEAD PERDIDO', 'Lead Perdido', 'lostFlag', 'Perdido'])),
    lossReason: String(pick(row, ['MOTIVO DE PERDA', 'Motivo de perda', 'lossReason', 'Motivo']) || '').trim(),
    value: money(pick(row, ['Valor', 'VALOR', 'value', 'Receita'])),
    metaAds: bool(pick(row, ['META ADS', 'Meta Ads', 'metaAds'])),
    googleAds: bool(pick(row, ['GOOGLE ADS', 'Google Ads', 'googleAds'])),
    tags: pick(row, ['TAGS', 'Tags', 'tags']) || ''
  };
}

function safeParam(value) {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function csvUrl(spreadsheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_=${Date.now()}`;
}

async function discoverGids(spreadsheetId, firstGid) {
  const ids = new Set([firstGid, DEFAULT_GID]);
  try {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`, { cache: 'no-store' });
    const html = await response.text();
    const patterns = [/gid[=:\\"]+(\d{3,})/g, /sheetId[\"']?\s*[:=]\s*(\d{3,})/g, /\[\"[^\"]*\",(\d{3,}),/g];
    patterns.forEach((pattern) => {
      for (const match of html.matchAll(pattern)) ids.add(match[1]);
    });
  } catch (error) {}
  return Array.from(ids).filter(Boolean).slice(0, 40);
}

async function readGid(spreadsheetId, gid) {
  const response = await fetch(csvUrl(spreadsheetId, gid), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`CSV HTTP ${response.status}: ${text.slice(0, 120)}`);
  const rawRows = csvToRows(text);
  const records = rawRows.map(normalize).filter((row) => row.leadId && row.date);
  return { gid, rawRows: rawRows.length, records };
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
    const gids = await discoverGids(spreadsheetId, gid);
    const byLead = new Map();
    const sources = [];
    const errors = [];

    for (const currentGid of gids) {
      try {
        const result = await readGid(spreadsheetId, currentGid);
        sources.push({ gid: currentGid, rawRows: result.rawRows, records: result.records.length });
        result.records.forEach((record) => {
          const key = record.leadId || `${record.date}-${record.name}`;
          if (!byLead.has(key)) byLead.set(key, record);
        });
        if (byLead.size >= 9300) break;
      } catch (error) {
        errors.push({ gid: currentGid, error: error.message });
      }
    }

    const records = Array.from(byLead.values()).sort((a, b) => a.date.localeCompare(b.date) || a.leadId.localeCompare(b.leadId));
    const dates = records.map((row) => row.date).sort();
    res.status(200).json({
      ok: records.length > 0,
      source: 'growthpack-csv-live-full-scan',
      spreadsheetId,
      gid,
      updatedAt: new Date().toISOString(),
      count: records.length,
      period: { start: dates[0] || '', end: dates[dates.length - 1] || '' },
      sources,
      errors: errors.slice(0, 8),
      records
    });
  } catch (error) {
    res.status(200).json({ ok: false, source: 'fallback-required', updatedAt: new Date().toISOString(), error: error.message, count: 0, records: [] });
  }
}
