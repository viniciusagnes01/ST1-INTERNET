(function () {
  const CONFIG = window.DASHBOARD_CONFIG || {};
  const FALLBACK = window.__GROWTHPACK_FALLBACK_DATA__ || [];

  const state = {
    raw: [],
    records: [],
    filtered: [],
    activeTab: 'geral',
    sourceStatus: 'Carregando GrowthPack...',
    filters: {
      start: CONFIG.defaultPeriod?.start || '2026-06-01',
      end: CONFIG.defaultPeriod?.end || '2026-06-18',
      seller: 'all',
      origin: 'all',
      reason: 'all',
      stage: 'all'
    },
    targets: loadTargets()
  };

  function $(id) { return document.getElementById(id); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function loadTargets() {
    const defaults = CONFIG.targets || {};
    try {
      const saved = JSON.parse(localStorage.getItem('st1Targets') || '{}');
      return { ...defaults, ...saved };
    } catch (e) {
      return { ...defaults };
    }
  }

  function saveTargets() {
    localStorage.setItem('st1Targets', JSON.stringify(state.targets));
  }

  function fmtInt(v) {
    return Math.round(Number(v || 0)).toLocaleString('pt-BR');
  }
  function fmtMoney(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }
  function fmtPct(v, digits = 1) {
    if (!isFinite(v)) v = 0;
    return (Number(v || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%';
  }
  function safeDiv(a, b) { return Number(b || 0) ? Number(a || 0) / Number(b || 0) : 0; }
  function esc(str) {
    return String(str ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }
  function bool(v) {
    if (typeof v === 'number') return v >= 1 ? 1 : 0;
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return 0;
    if (['1', '1.0', 'true', 'sim', 'yes', 'x'].includes(s)) return 1;
    const n = Number(s.replace(',', '.'));
    return isFinite(n) && n >= 1 ? 1 : 0;
  }
  function num(v) {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }
  function leadId(v) {
    if (v == null) return '';
    const s = String(v).trim();
    if (!s) return '';
    if (/e\+/i.test(s)) return String(Math.trunc(Number(s)));
    return s.replace(/\.0$/, '');
  }

  function normalizeDate(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      let y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      if (CONFIG.growthPack?.swapIsoDayMonthWhenAmbiguous && mo <= 12 && d <= 12) {
        const tmp = mo; mo = d; d = tmp;
      }
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    if (/^\d+(\.\d+)?$/.test(s)) {
      const serial = Number(s);
      const base = new Date(Date.UTC(1899, 11, 30));
      base.setUTCDate(base.getUTCDate() + serial);
      return base.toISOString().slice(0, 10);
    }
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
  }

  function originOf(r) {
    if (bool(r.metaAds) && bool(r.googleAds)) return 'Meta + Google';
    if (bool(r.metaAds)) return 'Meta Ads';
    if (bool(r.googleAds)) return 'Google Ads';
    return 'Sem origem marcada';
  }

  function normalizeReason(reason) {
    const r = String(reason || '').trim();
    if (!r) return '';
    return r
      .replace(/\s+/g, ' ')
      .replace('KITINET', 'KITNET')
      .replace('Não satisfeito com as condições', 'Não satisfeito com as condições')
      .trim();
  }

  function categoryReason(reason) {
    const r = normalizeReason(reason).toLowerCase();
    if (!r) return 'Sem motivo';
    if (r.includes('falta de interesse') || r.includes('prioridade')) return 'Comercial / prioridade / follow-up';
    if (r.includes('atendimento não comercial')) return 'Qualificação / atendimento';
    if (r.includes('sem rede') || r.includes('rede em construção')) return 'Infraestrutura / cobertura';
    if (r.includes('sem viabilidade')) return 'Infraestrutura / viabilidade';
    if (r.includes('condomínio')) return 'Infraestrutura / condomínio';
    if (r.includes('cto')) return 'Infraestrutura / capacidade';
    if (r.includes('já possui') || r.includes('concorrente')) return 'Base atendida / concorrência';
    if (r.includes('kitnet') || r.includes('condições')) return 'Preço / condição / oferta';
    if (r.includes('orçamento') || r.includes('tempo de instalação')) return 'Preço / condição comercial';
    if (r.includes('desqualificado')) return 'Qualificação / lead desqualificado';
    return 'Outros';
  }

  function rowFromCsv(row) {
    const lower = {};
    Object.keys(row).forEach(k => lower[k.trim().toLowerCase()] = row[k]);
    const get = (...keys) => keys.map(k => lower[k.toLowerCase()]).find(v => v !== undefined) ?? '';
    return {
      dateRaw: get('Data', 'dateRaw'),
      date: normalizeDate(get('Data', 'date', 'dateRaw')),
      leadId: leadId(get('Lead ID', 'leadId', 'id')),
      name: get('Nome', 'name'),
      value: num(get('Valor', 'value')),
      leadTag: bool(get('LEAD', 'leadTag')),
      mql: bool(get('MQL', 'mql')),
      sql: bool(get('SQL', 'sql')),
      opportunity: bool(get('OPORTUNIDADE', 'opportunity', 'oportunidade')),
      purchase: bool(get('COMPRA', 'purchase', 'compra')),
      lostFlag: bool(get('LEAD PERDIDO', 'lostFlag')),
      metaAds: bool(get('META ADS', 'metaAds')),
      googleAds: bool(get('GOOGLE ADS', 'googleAds')),
      seller: String(get('RESPONSAVEL', 'seller') || 'Sem responsável').trim(),
      lossReason: normalizeReason(get('MOTIVO DE PERDA', 'lossReason')),
      tags: get('TAGS', 'tags')
    };
  }

  function normalizeRecord(r) {
    const nr = {
      dateRaw: r.dateRaw || r.Data || '',
      date: (r.date && r.dateRaw ? r.date : normalizeDate(r.date || r.Data || r.dateRaw)),
      leadId: leadId(r.leadId || r['Lead ID']),
      name: r.name || r.Nome || '',
      value: num(r.value ?? r.Valor),
      leadTag: bool(r.leadTag ?? r.LEAD),
      mql: bool(r.mql ?? r.MQL),
      sql: bool(r.sql ?? r.SQL),
      opportunity: bool(r.opportunity ?? r.OPORTUNIDADE),
      purchase: bool(r.purchase ?? r.COMPRA),
      lostFlag: bool(r.lostFlag ?? r['LEAD PERDIDO']),
      metaAds: bool(r.metaAds ?? r['META ADS']),
      googleAds: bool(r.googleAds ?? r['GOOGLE ADS']),
      seller: String(r.seller || r.RESPONSAVEL || 'Sem responsável').trim() || 'Sem responsável',
      lossReason: normalizeReason(r.lossReason || r['MOTIVO DE PERDA'] || ''),
      tags: r.tags || r.TAGS || ''
    };
    nr.origin = r.origin || originOf(nr);
    nr.reasonCategory = categoryReason(nr.lossReason);
    return nr;
  }

  function uniqueByLead(records) {
    const map = new Map();
    records.forEach(r => {
      if (!r.leadId) return;
      const current = map.get(r.leadId);
      if (!current) {
        map.set(r.leadId, { ...r });
        return;
      }
      // Collapse duplicates conservatively: keep latest non-empty fields and max boolean stages.
      current.leadTag = Math.max(current.leadTag, r.leadTag);
      current.mql = Math.max(current.mql, r.mql);
      current.sql = Math.max(current.sql, r.sql);
      current.opportunity = Math.max(current.opportunity, r.opportunity);
      current.purchase = Math.max(current.purchase, r.purchase);
      current.lostFlag = Math.max(current.lostFlag, r.lostFlag);
      current.metaAds = Math.max(current.metaAds, r.metaAds);
      current.googleAds = Math.max(current.googleAds, r.googleAds);
      current.value = Math.max(current.value, r.value);
      current.lossReason = current.lossReason || r.lossReason;
      current.reasonCategory = categoryReason(current.lossReason);
      current.tags = current.tags || r.tags;
      current.origin = originOf(current);
      if (r.date > current.date) current.date = r.date;
      if (r.seller && r.seller !== 'Sem responsável') current.seller = r.seller;
    });
    return [...map.values()];
  }

  async function loadData() {
    const g = CONFIG.growthPack || {};
    const override = localStorage.getItem('st1GrowthpackCsvUrl');
    const sources = [];
    if (override) sources.push({ type: 'csv', label: 'CSV configurado localmente', url: override });
    if (g.appsScriptUrl) sources.push({ type: 'json', label: 'Apps Script GrowthPack', url: g.appsScriptUrl });
    if (g.useGoogleCsv && g.csvUrl) sources.push({ type: 'csv', label: 'Google Sheets CSV', url: g.csvUrl });
    sources.push({ type: 'fallback', label: 'Fallback local', url: g.fallbackJson || './data/growthpack-base-crm.json' });

    for (const src of sources) {
      try {
        if (src.type === 'fallback' && FALLBACK.length) {
          state.sourceStatus = `Fonte: ${src.label}`;
          return FALLBACK;
        }
        const res = await fetch(src.url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (src.type === 'csv') {
          const text = await res.text();
          const parsed = parseCsv(text).map(rowFromCsv).filter(r => r.leadId);
          if (!parsed.length) throw new Error('CSV sem dados utilizáveis');
          state.sourceStatus = `Fonte dinâmica: ${src.label}`;
          return parsed;
        }
        const json = await res.json();
        const arr = Array.isArray(json) ? json : (json.data || json.records || []);
        if (!arr.length) throw new Error('JSON sem registros');
        state.sourceStatus = `Fonte dinâmica: ${src.label}`;
        return arr;
      } catch (err) {
        console.warn('Falha fonte', src.label, err);
      }
    }
    state.sourceStatus = 'Fonte: fallback local embutido';
    return FALLBACK;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inside = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];
      if (inside) {
        if (c === '"' && n === '"') { field += '"'; i++; }
        else if (c === '"') inside = false;
        else field += c;
      } else {
        if (c === '"') inside = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const headers = rows.shift() || [];
    return rows.filter(r => r.some(v => String(v).trim())).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] ?? '');
      return obj;
    });
  }

  function applyFilters() {
    const f = state.filters;
    let data = state.records.filter(r => {
      if (f.start && r.date < f.start) return false;
      if (f.end && r.date > f.end) return false;
      if (f.seller !== 'all' && r.seller !== f.seller) return false;
      if (f.origin !== 'all' && r.origin !== f.origin) return false;
      if (f.reason !== 'all' && r.lossReason !== f.reason) return false;
      if (f.stage === 'mql' && !r.mql) return false;
      if (f.stage === 'sql' && !r.sql) return false;
      if (f.stage === 'opportunity' && !r.opportunity) return false;
      if (f.stage === 'purchase' && !r.purchase) return false;
      if (f.stage === 'lostReason' && !r.lossReason) return false;
      return true;
    });
    state.filtered = uniqueByLead(data);
  }

  function compute(records) {
    const total = records.length;
    const sums = {
      total,
      leadTag: sum(records, 'leadTag'),
      mql: sum(records, 'mql'),
      sql: sum(records, 'sql'),
      opportunity: sum(records, 'opportunity'),
      purchase: sum(records, 'purchase'),
      lostFlag: sum(records, 'lostFlag'),
      value: records.reduce((a, r) => a + (r.value || 0), 0),
      lossReason: records.filter(r => r.lossReason).length,
      noOrigin: records.filter(r => r.origin === 'Sem origem marcada').length,
      noSeller: records.filter(r => !r.seller || r.seller === 'Sem responsável').length,
      sqlWithoutMql: records.filter(r => r.sql && !r.mql).length,
      oppWithoutSql: records.filter(r => r.opportunity && !r.sql).length,
      purchaseWithoutOpp: records.filter(r => r.purchase && !r.opportunity).length,
      reasonWithoutLostFlag: records.filter(r => r.lossReason && !r.lostFlag).length,
      valueWithoutPurchase: records.filter(r => r.value > 0 && !r.purchase).length,
      purchaseZeroValue: records.filter(r => r.purchase && !r.value).length
    };
    sums.conversion = safeDiv(sums.purchase, total);
    sums.ticket = safeDiv(sums.value, sums.purchase);
    sums.lossRate = safeDiv(sums.lossReason, total);
    sums.dataQuality = dataQuality(sums);
    return sums;
  }
  function sum(arr, key) { return arr.reduce((a, r) => a + Number(r[key] || 0), 0); }
  function dataQuality(m) {
    if (!m.total) return 0;
    const penalties = [
      safeDiv(m.reasonWithoutLostFlag, m.total) * .25,
      safeDiv(m.noOrigin, m.total) * .25,
      safeDiv(m.sqlWithoutMql + m.oppWithoutSql + m.purchaseWithoutOpp, m.total) * .25,
      safeDiv(m.noSeller + m.valueWithoutPurchase + m.purchaseZeroValue, m.total) * .25
    ].reduce((a, b) => a + b, 0);
    return Math.max(0, Math.min(1, 1 - penalties));
  }

  function groupBy(records, keyFn) {
    const map = new Map();
    records.forEach(r => {
      const key = keyFn(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }

  function byDate(records) {
    return [...groupBy(records, r => r.date).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({ date, rows, m: compute(rows) }));
  }
  function bySeller(records) {
    return [...groupBy(records, r => r.seller).entries()].map(([seller, rows]) => ({ seller, rows, m: compute(rows) })).sort((a, b) => b.m.conversion - a.m.conversion);
  }
  function byOrigin(records) {
    return [...groupBy(records, r => r.origin).entries()].map(([origin, rows]) => ({ origin, rows, m: compute(rows) })).sort((a, b) => b.m.purchase - a.m.purchase);
  }
  function topReasons(records, n = 12) {
    return [...groupBy(records.filter(r => r.lossReason), r => r.lossReason).entries()].map(([reason, rows]) => ({ reason, count: rows.length, pct: safeDiv(rows.length, records.filter(r => r.lossReason).length) })).sort((a, b) => b.count - a.count).slice(0, n);
  }
  function topCategories(records, n = 12) {
    return [...groupBy(records.filter(r => r.lossReason), r => r.reasonCategory).entries()].map(([category, rows]) => ({ category, count: rows.length, pct: safeDiv(rows.length, records.filter(r => r.lossReason).length) })).sort((a, b) => b.count - a.count).slice(0, n);
  }

  function render() {
    applyFilters();
    renderHeader();
    renderFiltersMeta();
    renderCommand();
    renderCurrentPanel();
    revealNow();
  }

  function renderHeader() {
    $('sourceStatus').textContent = state.sourceStatus;
    $('periodStatus').textContent = `${datePt(state.filters.start)} a ${datePt(state.filters.end)}`;
    $('recordStatus').textContent = `${fmtInt(state.filtered.length)} Lead IDs filtrados`;
  }

  function renderFiltersMeta() {
    $('startDate').value = state.filters.start;
    $('endDate').value = state.filters.end;
    $('sellerFilter').value = state.filters.seller;
    $('originFilter').value = state.filters.origin;
    $('reasonFilter').value = state.filters.reason;
    $('stageFilter').value = state.filters.stage;
  }

  function renderCommand() {
    const m = compute(state.filtered);
    const target = state.targets;
    const convStatus = m.conversion >= Number(target.minConversionRate || 0) ? 'acima da meta' : 'abaixo da meta';
    $('commandMetrics').innerHTML = [
      commandMetric('Lead IDs', fmtInt(m.total), 'topo real do funil', 100),
      commandMetric('Compras', fmtInt(m.purchase), `${fmtPct(m.conversion)} · ${convStatus}`, pctWidth(m.conversion, target.minConversionRate || .25)),
      commandMetric('Valor', fmtMoney(m.value), `ticket ${fmtMoney(m.ticket)}`, 74),
      commandMetric('Qualidade CRM', fmtPct(m.dataQuality), 'score de governança', m.dataQuality * 100)
    ].join('');
    $('globalHealth').innerHTML = healthBadge(m);
  }

  function commandMetric(label, value, sub, width) {
    return `<div class="command-metric"><span class="label">${label}</span><span class="command-number">${value}</span><small>${sub}</small><div class="mini-progress"><i style="--w:${Math.min(100, Math.max(3, width))}%"></i></div></div>`;
  }
  function pctWidth(value, target) { return target ? Math.min(100, safeDiv(value, target) * 100) : value * 100; }
  function healthBadge(m) {
    if (m.dataQuality >= .86 && m.conversion >= (state.targets.minConversionRate || .25)) return '<span class="badge cyan">Operação saudável</span>';
    if (m.dataQuality < .70) return '<span class="badge danger">CRM em risco</span>';
    return '<span class="badge warn">Atenção operacional</span>';
  }

  function renderCurrentPanel() {
    qsa('.panel').forEach(p => p.classList.remove('active'));
    $(`panel-${state.activeTab}`).classList.add('active');
    if (state.activeTab === 'geral') renderGeral();
    if (state.activeTab === 'midia') renderMidia();
    if (state.activeTab === 'crm') renderCrm();
    if (state.activeTab === 'meta') renderMetaFca();
  }

  function renderGeral() {
    const records = state.filtered;
    const m = compute(records);
    $('geralKpis').innerHTML = [
      kpi('⚡', 'Lead IDs', fmtInt(m.total), `${fmtInt(m.leadTag)} com tag LEAD`, 'orange'),
      kpi('🧭', 'MQL → SQL', `${fmtPct(safeDiv(m.sql, m.mql))}`, `${fmtInt(m.mql)} MQL / ${fmtInt(m.sql)} SQL`, 'cyan'),
      kpi('🛒', 'Compras', fmtInt(m.purchase), `${fmtPct(m.conversion)} compra / Lead`, 'orange'),
      kpi('🧾', 'Motivos de perda', fmtInt(m.lossReason), `${fmtPct(m.lossRate)} dos Lead IDs`, 'danger')
    ].join('');
    $('dailyChart').innerHTML = dailyBars(byDate(records));
    $('funnelOverview').innerHTML = funnelList(m);
    $('dailyTable').innerHTML = dailyTable(byDate(records));
    $('generalInsights').innerHTML = insightCards([
      ['Topo correto', `O painel usa Lead ID único como entrada. Isso evita subcontagem de ${fmtInt(Math.max(0, m.total - m.leadTag))} registros no filtro atual.`],
      ['Leitura comercial', `${fmtInt(m.purchase)} compras em ${fmtInt(m.total)} Lead IDs. Conversão final de ${fmtPct(m.conversion)}.`],
      ['Risco de governança', `${fmtInt(m.reasonWithoutLostFlag)} motivos de perda não acompanham a flag LEAD PERDIDO.`]
    ]);
  }

  function renderMidia() {
    const records = state.filtered;
    const origin = byOrigin(records);
    const m = compute(records);
    $('midiaKpis').innerHTML = [
      kpi('📡', 'Sem origem', fmtInt(m.noOrigin), `${fmtPct(safeDiv(m.noOrigin, m.total))} dos leads`, 'danger'),
      kpi('🟧', 'Meta Ads', fmtInt((origin.find(o => o.origin === 'Meta Ads') || { m: { total: 0 } }).m.total), 'volume filtrado', 'orange'),
      kpi('🔎', 'Google Ads', fmtInt((origin.find(o => o.origin === 'Google Ads') || { m: { total: 0 } }).m.total), 'intenção ativa', 'cyan'),
      kpi('💰', 'Valor total', fmtMoney(m.value), `${fmtInt(m.purchase)} compras`, 'orange')
    ].join('');
    $('originChart').innerHTML = horizontalBars(origin.map(o => ({ label: o.origin, value: o.m.total, sub: `${fmtPct(o.m.conversion)} compra/lead` })));
    $('originConversionChart').innerHTML = horizontalBars(origin.map(o => ({ label: o.origin, value: o.m.conversion * 100, sub: `${fmtInt(o.m.purchase)} compras`, pct: true })));
    $('originTable').innerHTML = originTable(origin);
    $('midiaInsights').innerHTML = insightCards([
      ['Meta', 'Auditar criativos, regiões e formulários que geram falta de interesse, sem rede ou sem viabilidade.'],
      ['Google', 'Preservar e escalar termos de intenção ativa, monitorando cobertura por região antes de aumentar investimento.'],
      ['Sem origem', 'Obrigatoriedade de origem/campanha no CRM para eliminar zona cega de atribuição.']
    ]);
  }

  function renderCrm() {
    const records = state.filtered;
    const sellers = bySeller(records);
    const m = compute(records);
    $('crmKpis').innerHTML = [
      kpi('🧩', 'Qualidade CRM', fmtPct(m.dataQuality), 'score de governança', m.dataQuality >= .85 ? 'cyan' : 'danger'),
      kpi('⚠️', 'Etapas quebradas', fmtInt(m.sqlWithoutMql + m.oppWithoutSql + m.purchaseWithoutOpp), 'SQL/MQL/Opp/Compra', 'danger'),
      kpi('🏷️', 'Gap tag LEAD', fmtInt(Math.max(0, m.total - m.leadTag)), 'Lead ID sem tag', 'warn'),
      kpi('👤', 'Sem responsável', fmtInt(m.noSeller), 'lead sem dono', 'warn')
    ].join('');
    $('sellerCards').innerHTML = sellerCards(sellers);
    $('sellerFunnelTable').innerHTML = sellerFunnelTable(sellers, m);
    $('stageLossTable').innerHTML = stageLossTable(sellers, m);
    $('reasonSellerTable').innerHTML = reasonSellerTable(records);
    $('crmIssues').innerHTML = issueCards(m);
  }

  function renderMetaFca() {
    const records = state.filtered;
    const m = compute(records);
    const t = state.targets;
    $('targetInputs').innerHTML = targetInputs();
    $('goalCards').innerHTML = [
      goal('Leads', m.total, t.monthlyLeads, 'Lead IDs filtrados vs meta configurada'),
      goal('Compras', m.purchase, t.monthlyPurchases, 'Compras filtradas vs meta configurada'),
      goal('Valor', m.value, t.monthlyRevenue, 'Valor registrado vs meta configurada', true),
      goal('Conversão', m.conversion, t.minConversionRate, 'Compra / Lead ID', false, true)
    ].join('');
    $('fcaCards').innerHTML = fcaCards(records, m);
    $('automationMatrix').innerHTML = automationMatrix();
  }

  function kpi(icon, label, value, sub, kind) {
    return `<article class="glass kpi-card reveal"><div class="kpi-top"><div><span class="kpi-label">${label}</span></div><div class="kpi-icon">${icon}</div></div><span class="kpi-value">${value}</span><span class="kpi-sub">${sub}</span><div class="mini-progress"><i style="--w:${kind === 'danger' ? 48 : kind === 'warn' ? 62 : 86}%"></i></div></article>`;
  }

  function dailyBars(groups) {
    if (!groups.length) return empty('Sem dados diários para o filtro atual.');
    const max = Math.max(...groups.map(g => g.m.total), 1);
    return `<div class="chart-bars">${groups.map(g => {
      const h = Math.max(4, g.m.total / max * 100);
      return `<div class="chart-bar"><div class="chart-bar-track"><i class="chart-bar-fill" style="--h:${h}%"></i></div><b>${dateShort(g.date)}</b><span>${fmtInt(g.m.total)} · ${fmtInt(g.m.purchase)}</span></div>`;
    }).join('')}</div>`;
  }

  function funnelList(m) {
    const stages = [
      ['Lead ID', m.total, 1],
      ['MQL', m.mql, safeDiv(m.mql, m.total)],
      ['SQL', m.sql, safeDiv(m.sql, m.total)],
      ['Oportunidade', m.opportunity, safeDiv(m.opportunity, m.total)],
      ['Compra', m.purchase, safeDiv(m.purchase, m.total)]
    ];
    return `<div class="funnel-list">${stages.map(([label, value, pct]) => `<div class="funnel-row"><b>${label}</b><div class="funnel-line"><i style="--w:${Math.max(3, pct*100)}%"></i></div><strong>${fmtInt(value)}</strong><small>${fmtPct(pct)}</small></div>`).join('')}</div>`;
  }

  function dailyTable(groups) {
    if (!groups.length) return emptyRow(8);
    const rows = groups.map(g => `<tr><td>${datePt(g.date)}</td><td>${dayName(g.date)}</td><td>${fmtInt(g.m.total)}</td><td>${fmtInt(g.m.leadTag)}</td><td>${fmtInt(Math.max(0, g.m.total - g.m.leadTag))}</td><td>${fmtInt(g.m.mql)}</td><td>${fmtInt(g.m.sql)}</td><td>${fmtInt(g.m.opportunity)}</td><td>${fmtInt(g.m.purchase)}</td><td>${fmtPct(g.m.conversion)}</td><td>${fmtInt(g.m.lossReason)}</td><td>${fmtMoney(g.m.value)}</td></tr>`).join('');
    return `<table><thead><tr><th>Data</th><th>Dia</th><th>Lead IDs</th><th>Tag LEAD</th><th>Gap</th><th>MQL</th><th>SQL</th><th>Opp</th><th>Compras</th><th>Conv.</th><th>Motivos</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function horizontalBars(items) {
    if (!items.length) return empty('Sem dados para o filtro atual.');
    const max = Math.max(...items.map(i => i.value), 1);
    return `<div class="funnel-list">${items.map(i => `<div class="funnel-row"><b>${esc(i.label)}</b><div class="funnel-line"><i style="--w:${Math.max(3, i.value / max * 100)}%"></i></div><strong>${i.pct ? fmtPct(i.value / 100) : fmtInt(i.value)}</strong><small>${esc(i.sub || '')}</small></div>`).join('')}</div>`;
  }

  function originTable(groups) {
    if (!groups.length) return emptyRow(9);
    const rows = groups.map(g => `<tr><td><span class="badge ${g.origin === 'Sem origem marcada' ? 'danger' : 'cyan'}">${esc(g.origin)}</span></td><td>${fmtInt(g.m.total)}</td><td>${fmtInt(g.m.purchase)}</td><td>${fmtPct(g.m.conversion)}</td><td>${fmtInt(g.m.lossReason)}</td><td>${fmtPct(g.m.lossRate)}</td><td>${fmtMoney(g.m.value)}</td><td>${fmtPct(safeDiv(g.m.mql, g.m.total))}</td><td>${fmtPct(safeDiv(g.m.sql, g.m.mql))}</td></tr>`).join('');
    return `<table><thead><tr><th>Origem</th><th>Lead IDs</th><th>Compras</th><th>Compra / Lead</th><th>Motivos perda</th><th>Motivo / Lead</th><th>Valor</th><th>MQL / Lead</th><th>SQL / MQL</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function sellerCards(sellers) {
    if (!sellers.length) return empty('Sem vendedoras para o filtro atual.');
    return sellers.map((s, idx) => `<article class="glass seller-card reveal"><div class="seller-head"><div class="rank">${idx+1}</div><div><h3>${esc(s.seller)}</h3><span>${sellerDiagnosis(s)}</span></div><strong>${fmtPct(s.m.conversion)}</strong></div><div class="seller-stats"><div><b>${fmtInt(s.m.total)}</b><small>Leads</small></div><div><b>${fmtInt(s.m.mql)}</b><small>MQL</small></div><div><b>${fmtInt(s.m.sql)}</b><small>SQL</small></div><div><b>${fmtInt(s.m.opportunity)}</b><small>Opp</small></div><div><b>${fmtInt(s.m.purchase)}</b><small>Compra</small></div></div><p class="muted">Valor: <strong>${fmtMoney(s.m.value)}</strong> · Motivos de perda: <strong>${fmtInt(s.m.lossReason)}</strong> · Ticket: <strong>${fmtMoney(s.m.ticket)}</strong></p></article>`).join('');
  }

  function sellerDiagnosis(s) {
    if (s.m.conversion >= .30) return 'alta conversão final';
    if (safeDiv(s.m.mql, s.m.total) >= .60) return 'alta ativação em MQL';
    if (s.m.lossRate >= .65) return 'alto atrito de perda';
    if (s.m.total >= 350) return 'alto volume de topo';
    return 'operação em acompanhamento';
  }

  function sellerFunnelTable(sellers, totalM) {
    const totalRow = `<tr class="total"><td>Total</td><td>${fmtInt(totalM.total)}</td><td>${fmtInt(totalM.mql)}</td><td>${fmtPct(safeDiv(totalM.mql,totalM.total))}</td><td>${fmtInt(totalM.sql)}</td><td>${fmtPct(safeDiv(totalM.sql,totalM.mql))}</td><td>${fmtInt(totalM.opportunity)}</td><td>${fmtPct(safeDiv(totalM.opportunity,totalM.sql))}</td><td>${fmtInt(totalM.purchase)}</td><td>${fmtPct(safeDiv(totalM.purchase,totalM.opportunity))}</td><td>${fmtPct(totalM.conversion)}</td></tr>`;
    const rows = sellers.map(s => `<tr><td>${esc(s.seller)}</td><td>${fmtInt(s.m.total)}</td><td>${fmtInt(s.m.mql)}</td><td>${fmtPct(safeDiv(s.m.mql,s.m.total))}</td><td>${fmtInt(s.m.sql)}</td><td>${fmtPct(safeDiv(s.m.sql,s.m.mql))}</td><td>${fmtInt(s.m.opportunity)}</td><td>${fmtPct(safeDiv(s.m.opportunity,s.m.sql))}</td><td>${fmtInt(s.m.purchase)}</td><td>${fmtPct(safeDiv(s.m.purchase,s.m.opportunity))}</td><td>${fmtPct(s.m.conversion)}</td></tr>`).join('');
    return `<table><thead><tr><th>Vendedora</th><th>Lead ID</th><th>MQL</th><th>MQL / Lead</th><th>SQL</th><th>SQL / MQL</th><th>Oportunidade</th><th>Opp / SQL</th><th>Compra</th><th>Compra / Opp</th><th>Compra / Lead</th></tr></thead><tbody>${totalRow}${rows}</tbody></table>`;
  }

  function stageLossTable(sellers, totalM) {
    const loss = m => [m.total-m.mql, m.mql-m.sql, m.sql-m.opportunity, m.opportunity-m.purchase];
    const tr = (label, m, cls='') => { const l = loss(m); return `<tr class="${cls}"><td>${esc(label)}</td><td>${fmtInt(l[0])}</td><td>${fmtInt(l[1])}</td><td>${fmtInt(l[2])}</td><td>${fmtInt(l[3])}</td></tr>`; };
    return `<table><thead><tr><th>Vendedora</th><th>Lead → MQL</th><th>MQL → SQL</th><th>SQL → Oportunidade</th><th>Oportunidade → Compra</th></tr></thead><tbody>${tr('Total', totalM, 'total')}${sellers.map(s => tr(s.seller, s.m)).join('')}</tbody></table>`;
  }

  function reasonSellerTable(records) {
    const sellers = [...new Set(records.map(r => r.seller))].sort();
    const reasons = topReasons(records, 12).map(r => r.reason);
    if (!reasons.length) return emptyRow(3);
    const header = `<th>Motivo</th>${sellers.map(s => `<th>${esc(s)}</th>`).join('')}<th>Total</th>`;
    const rows = reasons.map(reason => {
      const counts = sellers.map(s => records.filter(r => r.seller === s && r.lossReason === reason).length);
      return `<tr><td>${esc(reason)}</td>${counts.map(c => `<td>${fmtInt(c)}</td>`).join('')}<td><strong>${fmtInt(counts.reduce((a,b)=>a+b,0))}</strong></td></tr>`;
    }).join('');
    return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function issueCards(m) {
    const items = [
      ['Motivo sem perdido', m.reasonWithoutLostFlag, 'Preencher motivo precisa atualizar status perdido.'],
      ['Sem origem', m.noOrigin, 'Lead sem canal inviabiliza atribuição de mídia.'],
      ['SQL sem MQL', m.sqlWithoutMql, 'Etapa avançada sem pré-qualificação registrada.'],
      ['Compra sem opp', m.purchaseWithoutOpp, 'Venda fechada sem etapa de oportunidade.'],
      ['Valor sem compra', m.valueWithoutPurchase, 'Valor registrado fora de compra.'],
      ['Compra valor zero', m.purchaseZeroValue, 'Ticket médio e receita ficam distorcidos.']
    ];
    return insightCards(items);
  }

  function insightCards(items) {
    return items.map(([title, body]) => `<article class="glass insight-card reveal"><span class="badge warn">V4 ON</span><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`).join('');
  }

  function targetInputs() {
    const fields = [
      ['monthlyLeads', 'Meta mensal de leads'],
      ['monthlyPurchases', 'Meta mensal de compras'],
      ['monthlyRevenue', 'Meta mensal de valor'],
      ['minConversionRate', 'Conversão mínima']
    ];
    return fields.map(([key, label]) => `<div class="goal-card glass"><label class="kpi-label">${label}</label><input data-target="${key}" value="${state.targets[key] ?? ''}" /></div>`).join('');
  }

  function goal(label, current, target, desc, money=false, pct=false) {
    const progress = pct ? safeDiv(current, target) : safeDiv(current, target);
    const value = money ? fmtMoney(current) : pct ? fmtPct(current) : fmtInt(current);
    const targetLabel = money ? fmtMoney(target) : pct ? fmtPct(target) : fmtInt(target);
    const status = progress >= 1 ? 'Dentro/Acima' : progress >= .75 ? 'Atenção' : 'Risco';
    return `<article class="glass kpi-card reveal"><div class="kpi-top"><span class="badge ${progress >= 1 ? 'cyan' : progress >= .75 ? 'warn' : 'danger'}">${status}</span><div class="kpi-icon">🎯</div></div><span class="kpi-value">${value}</span><span class="kpi-sub">${label} · meta ${targetLabel}</span><p class="muted">${esc(desc)}</p><div class="mini-progress"><i style="--w:${Math.max(3, Math.min(100, progress*100))}%"></i></div></article>`;
  }

  function fcaCards(records, m) {
    const origin = byOrigin(records);
    const meta = origin.find(o => o.origin === 'Meta Ads');
    const google = origin.find(o => o.origin === 'Google Ads');
    const metaConv = meta ? meta.m.conversion : 0;
    const googleConv = google ? google.m.conversion : 0;
    const cards = [
      {
        tag: 'FCA 01', title: 'CRM não reflete perdas reais',
        items: [`Fato: ${fmtInt(m.lossReason)} motivos de perda e ${fmtInt(m.lostFlag)} flags de perdido.`, 'Causa provável: status não é atualizado quando motivo é preenchido.', 'Ação: regra obrigatória motivo preenchido → status perdido ou recuperável.', 'Responsável: Sales Ops / CRM.']
      },
      {
        tag: 'FCA 02', title: 'Qualidade de mídia e origem',
        items: [`Fato: ${fmtInt(m.noOrigin)} leads estão sem origem marcada no filtro atual.`, `Meta: ${fmtPct(metaConv)} vs Google: ${fmtPct(googleConv)} de compra/lead.`, 'Ação: cruzar campanha, bairro, cobertura, criativo e motivo de perda.', 'Responsável: mídia + comercial.']
      },
      {
        tag: 'FCA 03', title: 'Cobertura antes do comercial',
        items: ['Fato: sem rede, viabilidade, condomínio, CTO e rede em construção aparecem como perdas recorrentes.', 'Causa provável: lead entra antes de validação técnica.', 'Ação: pré-check de cobertura antes da distribuição para vendedora.', 'Responsável: operação + CRM.']
      }
    ];
    return cards.map(c => `<article class="glass fca-card reveal"><span class="badge orange">${c.tag}</span><h3>${esc(c.title)}</h3><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></article>`).join('');
  }

  function automationMatrix() {
    const rows = [
      ['Manual obrigatório', 'Validar taxonomia de perda, aprovar promessa comercial, negociar exceções e fechar FCA.', 'Decisão humana.'],
      ['Semi-automatizável', 'Follow-up D0-D3, criação de tarefa, rascunho de FCA e atualização orientada de CRM.', 'IA prepara, gestor aprova.'],
      ['Automatizável', 'Coleta GrowthPack, auditoria diária, alerta de etapa quebrada, lead sem dono e origem vazia.', 'Pode rodar via Apps Script, Make, n8n ou GitHub Action.'],
      ['Não automatizar agora', 'Alteração de oferta, promessa de instalação, escalonamento sensível e decisão de orçamento.', 'Exige contexto humano.']
    ];
    return `<table><thead><tr><th>Classificação</th><th>Rotina</th><th>Observação</th></tr></thead><tbody>${rows.map(r => `<tr><td><span class="badge ${r[0].startsWith('Autom') ? 'cyan' : r[0].startsWith('Manual') ? 'warn' : ''}">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;
  }

  function topReasonCards(records) {
    const reasons = topReasons(records, 8);
    if (!reasons.length) return empty('Sem motivos de perda no filtro atual.');
    return reasons.map((r, i) => `<article class="glass reason-card reveal"><small>#${i+1} motivo</small><h3>${esc(r.reason)}</h3><strong>${fmtInt(r.count)}</strong><span class="badge warn">${fmtPct(r.pct)} dos motivos</span></article>`).join('');
  }

  function empty(message) { return `<div class="data-card"><p>${esc(message)}</p></div>`; }
  function emptyRow(cols) { return `<table><tbody><tr><td colspan="${cols}">Sem dados para o filtro atual.</td></tr></tbody></table>`; }

  function datePt(s) {
    if (!s) return '--';
    const [y,m,d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  function dateShort(s) {
    if (!s) return '--';
    const [y,m,d] = s.split('-');
    return `${d}/${m}`;
  }
  function dayName(s) {
    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dt = new Date(`${s}T00:00:00`);
    return names[dt.getDay()] || '--';
  }

  function populateFilters() {
    const sellers = ['all', ...new Set(state.records.map(r => r.seller).filter(Boolean).sort())];
    const origins = ['all', ...new Set(state.records.map(r => r.origin).filter(Boolean).sort())];
    const reasons = ['all', ...new Set(state.records.map(r => r.lossReason).filter(Boolean).sort())];
    fillSelect('sellerFilter', sellers, 'Todas as vendedoras');
    fillSelect('originFilter', origins, 'Todas as origens');
    fillSelect('reasonFilter', reasons, 'Todos os motivos');
  }
  function fillSelect(id, values, allLabel) {
    const el = $(id);
    el.innerHTML = values.map(v => `<option value="${esc(v)}">${v === 'all' ? allLabel : esc(v)}</option>`).join('');
  }

  function bind() {
    qsa('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      qsa('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCurrentPanel();
      revealNow();
    }));

    ['startDate','endDate','sellerFilter','originFilter','reasonFilter','stageFilter'].forEach(id => {
      $(id).addEventListener('change', () => {
        state.filters.start = $('startDate').value;
        state.filters.end = $('endDate').value;
        state.filters.seller = $('sellerFilter').value;
        state.filters.origin = $('originFilter').value;
        state.filters.reason = $('reasonFilter').value;
        state.filters.stage = $('stageFilter').value;
        render();
      });
    });
    $('resetFilters').addEventListener('click', () => {
      state.filters = { start: CONFIG.defaultPeriod?.start || '', end: CONFIG.defaultPeriod?.end || '', seller: 'all', origin: 'all', reason: 'all', stage: 'all' };
      render();
      toast('Filtros redefinidos para o período padrão.');
    });
    $('refreshData').addEventListener('click', async () => {
      toast('Atualizando dados da GrowthPack...');
      await initialize(true);
    });
    $('motionToggle').addEventListener('click', () => {
      document.body.classList.toggle('no-motion');
      $('motionToggle').textContent = document.body.classList.contains('no-motion') ? 'Animações OFF' : 'Animações ON';
    });
    $('exportJson').addEventListener('click', exportSnapshot);
    $('setCsvUrl').addEventListener('click', () => {
      const url = prompt('Cole a URL CSV publicada da aba BASE_CRM ou o endpoint do Apps Script:');
      if (url) {
        localStorage.setItem('st1GrowthpackCsvUrl', url);
        toast('URL salva. Clique em Atualizar dados para puxar a nova fonte.');
      }
    });
    document.addEventListener('input', e => {
      if (e.target.matches('[data-target]')) {
        const key = e.target.dataset.target;
        state.targets[key] = Number(e.target.value);
        saveTargets();
        renderMetaFca();
      }
    });
  }

  function exportSnapshot() {
    const payload = { exportedAt: new Date().toISOString(), filters: state.filters, metrics: compute(state.filtered), records: state.filtered };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `st1-growthpack-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 4200);
  }

  function revealNow() {
    requestAnimationFrame(() => {
      qsa('.reveal').forEach(el => el.classList.add('in'));
    });
  }

  function setupProgressAndParticles() {
    const progress = $('scrollProgress');
    window.addEventListener('scroll', () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = h ? `${(window.scrollY / h) * 100}%` : '0%';
    });
    const canvas = $('particles');
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      particles = Array.from({ length: Math.min(90, Math.floor(W / 18)) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.7 + .4,
        vx: (Math.random() - .5) * .35,
        vy: (Math.random() - .5) * .35,
        color: Math.random() > .78 ? 'rgba(255,122,0,.62)' : 'rgba(255,255,255,.42)'
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    resize(); draw();
  }

  async function initialize(force = false) {
    state.raw = await loadData();
    state.records = uniqueByLead(state.raw.map(normalizeRecord).filter(r => r.leadId && r.date));
    populateFilters();
    bindOnce();
    render();
    toast(state.sourceStatus);
  }
  let bound = false;
  function bindOnce() {
    if (bound) return;
    bind();
    setupProgressAndParticles();
    bound = true;
  }

  window.ST1Dashboard = { state, render, compute };
  initialize();
})();
