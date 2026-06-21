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
  if (m) {
    let y = m[1];
    let mo = Number(m[2]);
    let d = Number(m[3]);
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

function origin(row) {
  const meta = bool(row['META ADS']);
  const google = bool(row['GOOGLE ADS']);
  if (meta && google) return 'Meta + Google';
  if (meta) return 'Meta Ads';
  if (google) return 'Google Ads';
  return 'Sem origem marcada';
}

function normalize(row) {
  return {
    date: normDate(row.Data),
    leadId: String(row['Lead ID'] || '').replace(/\.0$/, '').trim(),
    name: row.Nome || '',
    seller: String(row.RESPONSAVEL || 'Sem responsavel').trim() || 'Sem responsavel',
    origin: origin(row),
    leadTag: bool(row.LEAD),
    mql: bool(row.MQL),
    sql: bool(row.SQL),
    opportunity: bool(row.OPORTUNIDADE),
    purchase: bool(row.COMPRA),
    lostFlag: bool(row['LEAD PERDIDO']),
    lossReason: String(row['MOTIVO DE PERDA'] || '').trim(),
    value: money(row.Valor),
    metaAds: bool(row['META ADS']),
    googleAds: bool(row['GOOGLE ADS']),
    tags: row.TAGS || ''
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=30');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const spreadsheetId = process.env.GROWTHPACK_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
    const gid = process.env.GROWTHPACK_BASE_CRM_GID || DEFAULT_GID;
    const csvUrl = process.env.GROWTHPACK_CSV_URL || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
    const response = await fetch(csvUrl, { cache: 'no-store' });
    const text = await response.text();
    if (!response.ok) throw new Error(`CSV HTTP ${response.status}: ${text.slice(0, 160)}`);
    const records = csvToRows(text).map(normalize).filter((r) => r.leadId && r.date);
    res.status(200).json({ ok: true, source: 'growthpack-csv', updatedAt: new Date().toISOString(), count: records.length, records });
  } catch (error) {
    res.status(200).json({ ok: false, source: 'fallback-required', updatedAt: new Date().toISOString(), error: error.message, count: 0, records: [] });
  }
}
