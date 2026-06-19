(function () {
  'use strict';

  var rows = [];
  var filtered = [];
  var activeTab = 'overview';
  var filters = {
    start: '2026-06-01',
    end: '2026-06-18',
    seller: 'all',
    origin: 'all',
    stage: 'all',
    reason: 'all',
    category: 'all',
    search: ''
  };

  var tabMeta = {
    overview: { eyebrow: 'Cockpit / Visão Geral', title: 'Visão Geral', copy: 'Resumo executivo da receita, saúde do CRM, ritmo de compra e leitura V4 ON da operação.' },
    restriction: { eyebrow: 'Cockpit / Restrição', title: 'Restrição', copy: 'TOC, Goldratt e gargalo dominante do sistema traduzidos para ação prática.' },
    pcp: { eyebrow: 'Cockpit / PCP Comercial', title: 'PCP Comercial', copy: 'Capacidade, aging, fila quente e trabalho em progresso por etapa e por vendedora.' },
    commercial: { eyebrow: 'Cockpit / Comercial', title: 'Comercial', copy: 'Conversão, ticket, vazamentos de etapa e performance por vendedora.' },
    media: { eyebrow: 'Cockpit / Mídia', title: 'Mídia', copy: 'Origem, qualidade comercial do lead e impacto real sobre receita e CAC.' },
    service: { eyebrow: 'Cockpit / Atendimento', title: 'Atendimento', copy: 'Fluxo bot + humano, SLA, qualificação e risco de abandono.' },
    retention: { eyebrow: 'Cockpit / Retenção', title: 'Retenção', copy: 'CSAT, NPS, recompra, indicação e recuperação de relacionamento.' },
    losses: { eyebrow: 'Cockpit / Perdas', title: 'Perdas', copy: 'Motivos, categorias operacionais e plano de correção orientado por impacto.' },
    targets: { eyebrow: 'Cockpit / Metas', title: 'Metas', copy: 'Run rate, forecast, gaps para meta e leitura mensal do que falta destravar.' },
    fca: { eyebrow: 'Cockpit / FCA', title: 'FCA', copy: 'Registro manual do gestor para transformar fato, causa e ação em execução.' },
    handoff: { eyebrow: 'Cockpit / Handoff', title: 'Handoff', copy: 'Continuidade de contexto, stack, riscos abertos e próximos 7 dias.' },
    status: { eyebrow: 'Cockpit / Sistema', title: 'Sistema', copy: 'Auditoria da base, confiabilidade operacional e arquitetura V4 ON em produção.' }
  };

  var defaultTargets = {
    monthlyLeads: 2800,
    monthlyPurchases: 680,
    monthlyRevenue: 76000,
    minConversionRate: 0.25,
    metaInvestment: 10000,
    googleInvestment: 8000,
    minRoas: 3,
    sellerDailyCapacity: 18
  };

  function $(id) { return document.getElementById(id); }
  function $$(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function number(value) { var n = Number(value || 0); return isFinite(n) ? n : 0; }
  function flag(value) {
    if (typeof value === 'number') return value >= 1 ? 1 : 0;
    var text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return 0;
    if (['1', '1.0', 'true', 'sim', 'yes', 'x'].indexOf(text) >= 0) return 1;
    return Number(text.replace(',', '.')) >= 1 ? 1 : 0;
  }
  function fmt(value) { return Math.round(number(value)).toLocaleString('pt-BR'); }
  function money(value) {
    return number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }
  function pct(value) {
    return ((isFinite(value) ? value : 0) * 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + '%';
  }
  function div(a, b) { return number(b) ? number(a) / number(b) : 0; }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function set(id, html) { var node = $(id); if (node) node.innerHTML = html; }
  function text(id, value) { var node = $(id); if (node) node.textContent = value; }
  function shellMetric(label, value, sub, tone) {
    return '<article class="glass metric-card"><span class="metric-label">' + esc(label) + '</span><strong class="metric-value">' + value + '</strong><span class="metric-sub ' + esc(tone || '') + '">' + esc(sub) + '</span></article>';
  }
  function signalCard(label, value, sub) {
    return '<div class="signal-card"><span class="kpi-label">' + esc(label) + '</span><strong>' + esc(value) + '</strong><span>' + esc(sub) + '</span></div>';
  }
  function updateWorkspaceHead() {
    var meta = tabMeta[activeTab] || tabMeta.overview;
    text('activeSectionEyebrow', meta.eyebrow);
    text('activeSectionTitle', meta.title);
    text('activeSectionCopy', meta.copy);
  }
  function initIcons() {
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    } catch (error) {}
  }

  function cleanText(value) {
    var text = String(value == null ? '' : value).trim();
    if (!/[ÃÂâ]/.test(text)) return text;
    try {
      return decodeURIComponent(Array.prototype.map.call(text, function (char) {
        var code = char.charCodeAt(0);
        return code <= 255 ? '%' + code.toString(16).padStart(2, '0') : encodeURIComponent(char);
      }).join(''));
    } catch (error) {
      try { return decodeURIComponent(escape(text)); } catch (ignored) { return text; }
    }
  }

  function categoryFor(reason) {
    var reasonText = cleanText(reason).toLowerCase();
    if (!reasonText) return 'Sem motivo';
    if (reasonText.indexOf('falta de interesse') >= 0 || reasonText.indexOf('prioridade') >= 0) return 'Comercial / prioridade / follow-up';
    if (reasonText.indexOf('atendimento') >= 0) return 'Qualificação / atendimento';
    if (reasonText.indexOf('sem rede') >= 0 || reasonText.indexOf('rede em construção') >= 0) return 'Infraestrutura / cobertura';
    if (reasonText.indexOf('sem viabilidade') >= 0) return 'Infraestrutura / viabilidade';
    if (reasonText.indexOf('condomínio') >= 0) return 'Infraestrutura / condomínio';
    if (reasonText.indexOf('cto') >= 0) return 'Infraestrutura / capacidade';
    if (reasonText.indexOf('já possui') >= 0 || reasonText.indexOf('concorrente') >= 0) return 'Base atendida / concorrência';
    if (reasonText.indexOf('kitnet') >= 0 || reasonText.indexOf('condições') >= 0) return 'Preço / condição / oferta';
    if (reasonText.indexOf('orçamento') >= 0 || reasonText.indexOf('instalação') >= 0) return 'Preço / condição comercial';
    if (reasonText.indexOf('desqualificado') >= 0) return 'Qualificação / lead desqualificado';
    return 'Outros';
  }

  function originFrom(row) {
    var meta = flag(row.metaAds || row['META ADS']);
    var google = flag(row.googleAds || row['GOOGLE ADS']);
    if (meta && google) return 'Meta + Google';
    if (meta) return 'Meta Ads';
    if (google) return 'Google Ads';
    return 'Sem origem marcada';
  }

  function normalize(row) {
    var reason = cleanText(row.lossReason || row['MOTIVO DE PERDA'] || '');
    var category = cleanText(row.reasonCategory || '');
    var seller = cleanText(row.seller || row.RESPONSAVEL || row['Responsável'] || 'Sem responsável');
    if (seller.toLowerCase() === 'rayane nunes') seller = 'Rayane Nunes';

    return {
      date: String(row.date || row.Data || row.dateRaw || '').slice(0, 10),
      leadId: String(row.leadId || row['Lead ID'] || '').replace(/\.0$/, ''),
      seller: seller || 'Sem responsável',
      origin: cleanText(row.origin || originFrom(row)),
      leadTag: flag(row.leadTag || row.LEAD),
      mql: flag(row.mql || row.MQL),
      sql: flag(row.sql || row.SQL),
      opportunity: flag(row.opportunity || row.OPORTUNIDADE || row.Oportunidade),
      purchase: flag(row.purchase || row.COMPRA || row.Compra),
      value: number(row.value || row.Valor),
      lossReason: reason,
      reasonCategory: reason ? (category && category !== 'Sem categoria' && category !== 'Sem motivo' ? category : categoryFor(reason)) : 'Sem motivo',
      lostFlag: flag(row.lostFlag || row['LEAD PERDIDO']),
      metaAds: flag(row.metaAds || row['META ADS']),
      googleAds: flag(row.googleAds || row['GOOGLE ADS'])
    };
  }

  function fallbackRows() {
    var days = [
      ['2026-06-01', 90, 46, 38, 23, 24, 63, 2227],
      ['2026-06-02', 95, 39, 34, 20, 20, 72, 2098],
      ['2026-06-03', 111, 54, 36, 25, 24, 76, 2625],
      ['2026-06-08', 151, 63, 73, 47, 52, 87, 5446],
      ['2026-06-10', 130, 51, 43, 37, 34, 84, 4468],
      ['2026-06-15', 124, 57, 33, 32, 35, 67, 3605],
      ['2026-06-18', 46, 13, 16, 8, 3, 14, 841]
    ];
    var sellers = ['Laydianne', 'Rayane Nunes', 'Wallas Linhares Dias', 'Maria Reis', 'Valberta Bastos'];
    var output = [];
    var id = 1;
    days.forEach(function (day, dayIndex) {
      for (var i = 0; i < day[1]; i += 1) {
        output.push(normalize({
          date: day[0],
          leadId: 'ST1-' + id++,
          seller: sellers[(i + dayIndex) % sellers.length],
          origin: i % 7 === 0 ? 'Google Ads' : i % 5 === 0 ? 'Meta Ads' : 'Sem origem marcada',
          leadTag: 1,
          mql: i < day[2] ? 1 : 0,
          sql: i < day[3] ? 1 : 0,
          opportunity: i < day[4] ? 1 : 0,
          purchase: i < day[5] ? 1 : 0,
          lossReason: i < day[6] ? 'Falta de Interesse / Prioridade' : '',
          lostFlag: i === 0 ? 1 : 0,
          value: i < day[5] ? day[7] / Math.max(1, day[5]) : 0
        }));
      }
    });
    return output;
  }

  function loadRows() {
    var source = Array.isArray(window.__GROWTHPACK_FALLBACK_DATA__) ? window.__GROWTHPACK_FALLBACK_DATA__ : [];
    var seen = {};
    rows = (source.length ? source.map(normalize) : fallbackRows()).filter(function (row) {
      if (!row.date || !row.leadId || seen[row.leadId]) return false;
      seen[row.leadId] = true;
      return true;
    });
  }

  function unique(values) {
    var map = {};
    var output = [];
    values.forEach(function (value) {
      var clean = cleanText(value);
      if (clean && !map[clean]) {
        map[clean] = true;
        output.push(clean);
      }
    });
    return output.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  function optionList(id, values, label) {
    set(id, '<option value="all">' + esc(label) + '</option>' + values.map(function (value) {
      return '<option value="' + esc(value) + '">' + esc(value) + '</option>';
    }).join(''));
  }

  function fillFilters() {
    optionList('fSeller', unique(rows.map(function (row) { return row.seller; })), 'Todas');
    optionList('fOrigin', unique(rows.map(function (row) { return row.origin; })), 'Todas');
    optionList('fReason', unique(rows.map(function (row) { return row.lossReason; }).filter(Boolean)), 'Todos');
    optionList('fCategory', unique(rows.map(function (row) { return row.reasonCategory; }).filter(function (x) { return x !== 'Sem motivo'; })), 'Todas');

    if ($('fStart')) $('fStart').value = filters.start;
    if ($('fEnd')) $('fEnd').value = filters.end;
    if ($('fSeller')) $('fSeller').value = filters.seller;
    if ($('fOrigin')) $('fOrigin').value = filters.origin;
    if ($('fStage')) $('fStage').value = filters.stage;
    if ($('fReason')) $('fReason').value = filters.reason;
    if ($('fCategory')) $('fCategory').value = filters.category;
    if ($('fSearch')) $('fSearch').value = filters.search;
  }

  function readFilters() {
    filters.start = $('fStart') ? $('fStart').value : '';
    filters.end = $('fEnd') ? $('fEnd').value : '';
    filters.seller = $('fSeller') ? $('fSeller').value : 'all';
    filters.origin = $('fOrigin') ? $('fOrigin').value : 'all';
    filters.stage = $('fStage') ? $('fStage').value : 'all';
    filters.reason = $('fReason') ? $('fReason').value : 'all';
    filters.category = $('fCategory') ? $('fCategory').value : 'all';
    filters.search = ($('fSearch') ? $('fSearch').value : '').toLowerCase().trim();
  }

  function applyFilters() {
    filtered = rows.filter(function (row) {
      if (filters.start && row.date < filters.start) return false;
      if (filters.end && row.date > filters.end) return false;
      if (filters.seller !== 'all' && row.seller !== filters.seller) return false;
      if (filters.origin !== 'all' && row.origin !== filters.origin) return false;
      if (filters.reason !== 'all' && row.lossReason !== filters.reason) return false;
      if (filters.category !== 'all' && row.reasonCategory !== filters.category) return false;
      if (filters.stage === 'leadTag' && !row.leadTag) return false;
      if (filters.stage === 'mql' && !row.mql) return false;
      if (filters.stage === 'sql' && !row.sql) return false;
      if (filters.stage === 'opportunity' && !row.opportunity) return false;
      if (filters.stage === 'purchase' && !row.purchase) return false;
      if (filters.stage === 'lost' && !row.lossReason) return false;
      if (filters.search) {
        var haystack = [
          row.date, row.leadId, row.seller, row.origin, row.lossReason, row.reasonCategory
        ].join(' ').toLowerCase();
        if (haystack.indexOf(filters.search) < 0) return false;
      }
      return true;
    });
  }

  function metrics(list) {
    var data = {
      total: list.length,
      leadTag: 0,
      mql: 0,
      sql: 0,
      opportunity: 0,
      purchase: 0,
      value: 0,
      loss: 0,
      lostFlag: 0,
      noOrigin: 0,
      noSeller: 0,
      sqlWithoutMql: 0,
      oppWithoutSql: 0,
      purchaseWithoutOpp: 0,
      reasonWithoutLostFlag: 0,
      valueWithoutPurchase: 0,
      purchaseZeroValue: 0
    };

    list.forEach(function (row) {
      data.leadTag += row.leadTag;
      data.mql += row.mql;
      data.sql += row.sql;
      data.opportunity += row.opportunity;
      data.purchase += row.purchase;
      data.value += row.value;
      data.lostFlag += row.lostFlag;
      if (row.lossReason) data.loss += 1;
      if (row.origin === 'Sem origem marcada') data.noOrigin += 1;
      if (!row.seller || row.seller === 'Sem responsável') data.noSeller += 1;
      if (row.sql && !row.mql) data.sqlWithoutMql += 1;
      if (row.opportunity && !row.sql) data.oppWithoutSql += 1;
      if (row.purchase && !row.opportunity) data.purchaseWithoutOpp += 1;
      if (row.lossReason && !row.lostFlag) data.reasonWithoutLostFlag += 1;
      if (row.value && !row.purchase) data.valueWithoutPurchase += 1;
      if (row.purchase && !row.value) data.purchaseZeroValue += 1;
    });

    data.conversion = div(data.purchase, data.total);
    data.ticket = div(data.value, data.purchase);
    data.lossRate = div(data.loss, data.total);
    data.dataIssues = data.noOrigin + data.reasonWithoutLostFlag + data.sqlWithoutMql + data.oppWithoutSql + data.purchaseWithoutOpp + data.valueWithoutPurchase + data.purchaseZeroValue;
    data.health = Math.max(0, Math.min(1, 1 - (
      div(data.noOrigin, data.total) * .22 +
      div(data.reasonWithoutLostFlag, data.total) * .26 +
      div(data.sqlWithoutMql + data.oppWithoutSql + data.purchaseWithoutOpp, data.total) * .24 +
      div(data.valueWithoutPurchase + data.purchaseZeroValue, data.total) * .12
    )));
    return data;
  }

  function groupBy(list, keyFn) {
    var map = {};
    list.forEach(function (row) {
      var key = keyFn(row) || 'Sem valor';
      (map[key] = map[key] || []).push(row);
    });
    return Object.keys(map).map(function (key) {
      return { key: key, rows: map[key], m: metrics(map[key]) };
    });
  }

  function countWhere(list, predicate) {
    return list.filter(predicate).length;
  }

  function reasonCount(list, text) {
    var needle = text.toLowerCase();
    return countWhere(list, function (row) {
      return String(row.lossReason || '').toLowerCase().indexOf(needle) >= 0;
    });
  }

  function categoryCount(list, text) {
    var needle = text.toLowerCase();
    return countWhere(list, function (row) {
      return String(row.reasonCategory || '').toLowerCase().indexOf(needle) >= 0;
    });
  }

  function stageModel(m) {
    var proposal = Math.max(m.purchase, Math.round(m.opportunity * .92));
    var negotiation = Math.max(m.purchase, Math.round(m.opportunity * .72));
    return [
      { key: 'Lead', count: m.total, next: m.leadTag || m.mql, owner: 'Marketing / Bot', sla: 'Imediato' },
      { key: 'Conexão', count: m.leadTag || m.mql, next: m.mql, owner: 'SDR / Comercial', sla: '15min a 1h' },
      { key: 'MQL', count: m.mql, next: m.sql, owner: 'SDR', sla: '24h' },
      { key: 'SQL', count: m.sql, next: m.opportunity, owner: 'SDR / Closer', sla: '48h' },
      { key: 'Oportunidade', count: m.opportunity, next: proposal, owner: 'Comercial', sla: 'D0/D1' },
      { key: 'Proposta', count: proposal, next: negotiation, owner: 'Closer', sla: 'D0/D1/D3' },
      { key: 'Negociação', count: negotiation, next: m.purchase, owner: 'Comercial', sla: 'Ciclo alvo' },
      { key: 'Venda', count: m.purchase, next: m.purchase, owner: 'Comercial / CS', sla: 'Imediato' }
    ].map(function (stage, index) {
      var wip = Math.max(0, stage.count - stage.next);
      stage.wip = wip;
      stage.loss = div(wip, stage.count);
      stage.aging = index <= 1 ? (wip > stage.count * .28 ? 'alto' : 'baixo') : (wip > stage.count * .35 ? 'crítico' : wip > stage.count * .18 ? 'atenção' : 'ok');
      return stage;
    });
  }

  function restrictionEngine(list, m) {
    var meta = metrics(list.filter(function (row) { return row.origin === 'Meta Ads'; }));
    var google = metrics(list.filter(function (row) { return row.origin === 'Google Ads'; }));
    var stageBreaks = m.sqlWithoutMql + m.oppWithoutSql + m.purchaseWithoutOpp;
    var infrastructure = categoryCount(list, 'infraestrutura');
    var commercialPriority = reasonCount(list, 'falta de interesse') + reasonCount(list, 'prioridade');
    var nonCommercial = reasonCount(list, 'atendimento');
    var price = categoryCount(list, 'preço');
    var stageWip = stageModel(m).sort(function (a, b) { return b.wip - a.wip; })[0] || { key: 'Sem gargalo', wip: 0 };
    var metaGap = Math.max(0, google.conversion - meta.conversion);
    var candidates = [
      {
        key: 'CRM / governança',
        score: div(m.noOrigin + m.reasonWithoutLostFlag + stageBreaks, Math.max(1, m.total)) * 100,
        evidence: fmt(m.noOrigin) + ' sem origem, ' + fmt(m.reasonWithoutLostFlag) + ' perdas sem flag e ' + fmt(stageBreaks) + ' quebras de etapa.',
        impact: 'Decisão de mídia, produtividade e perda ficam distorcidas.',
        action: 'Obrigar origem, motivo/status de perda e progressão mínima de etapa.',
        owner: 'CRM / Sales Ops',
        due: '48h',
        kind: 'danger'
      },
      {
        key: 'Qualidade de mídia',
        score: (div(meta.total, Math.max(1, m.total)) * metaGap * 220) + (div(m.noOrigin, Math.max(1, m.total)) * 35),
        evidence: 'Meta converte ' + pct(meta.conversion) + ', Google converte ' + pct(google.conversion) + ' e origem vazia impede CAC real.',
        impact: 'Time comercial recebe volume sem clareza de qualidade ou promessa.',
        action: 'Separar canal por qualidade comercial, motivo de perda e cobertura.',
        owner: 'Mídia + Comercial',
        due: '72h',
        kind: 'warn'
      },
      {
        key: 'Comercial / prioridade',
        score: div(commercialPriority + nonCommercial, Math.max(1, m.total)) * 120,
        evidence: fmt(commercialPriority) + ' perdas por prioridade/interesse e ' + fmt(nonCommercial) + ' por atendimento não comercial.',
        impact: 'Lead entra, mas não avança por urgência, script, qualificação ou follow-up.',
        action: 'Aplicar régua D0-D3, qualificação clara e script de objeções.',
        owner: 'Coordenação comercial',
        due: '7 dias',
        kind: 'warn'
      },
      {
        key: 'Infraestrutura / cobertura',
        score: div(infrastructure, Math.max(1, m.total)) * 140,
        evidence: fmt(infrastructure) + ' perdas ligadas a rede, viabilidade, CTO ou condomínio.',
        impact: 'Vendedora perde tempo com lead que talvez nunca deveria entrar na fila.',
        action: 'Pré-check de cobertura antes da distribuição humana.',
        owner: 'Operação + CRM',
        due: '7 dias',
        kind: 'danger'
      },
      {
        key: 'PCP / WIP em ' + stageWip.key,
        score: div(stageWip.wip, Math.max(1, m.total)) * 110,
        evidence: fmt(stageWip.wip) + ' registros acumulados na etapa ' + stageWip.key + '.',
        impact: 'Fluxo perde velocidade e envelhece na fila.',
        action: 'Definir capacidade diária, fila quente e SLA por etapa.',
        owner: 'Gestão comercial',
        due: '24h',
        kind: 'info'
      },
      {
        key: 'Preço / condição / oferta',
        score: div(price, Math.max(1, m.total)) * 95,
        evidence: fmt(price) + ' perdas classificadas como preço, orçamento, kitnet ou condição.',
        impact: 'Oferta pode estar desalinhada com expectativa, renda ou promessa.',
        action: 'Revisar comunicação de valor, condições e objeções por segmento.',
        owner: 'Comercial + Estratégia',
        due: '7 dias',
        kind: 'warn'
      }
    ];
    candidates.sort(function (a, b) { return b.score - a.score; });
    return { current: candidates[0], candidates: candidates };
  }

  function healthKind(value) {
    if (value >= .75) return 'ok';
    if (value >= .55) return 'warn';
    return 'danger';
  }

  function kpi(label, value, sub) {
    return '<article class="glass kpi"><span class="kpi-label">' + esc(label) + '</span><span class="kpi-value">' + value + '</span><span class="kpi-sub">' + sub + '</span></article>';
  }

  function tag(kind, label) {
    return '<span class="tag ' + kind + '">' + esc(label) + '</span>';
  }

  function insight(kind, title, body) {
    return '<article class="glass insight-card">' + tag(kind, 'V4 ON') + '<h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></article>';
  }

  function bar(label, value, max, sub) {
    var width = Math.max(3, Math.min(100, div(value, max) * 100));
    return '<div class="bar-row"><b>' + esc(label) + '</b><div class="bar-line"><i style="--w:' + width + '%"></i></div><span>' + (sub || fmt(value)) + '</span></div>';
  }

  function table(headers, body, totalFirst) {
    return '<table><thead><tr>' + headers.map(function (head) {
      return '<th>' + esc(head) + '</th>';
    }).join('') + '</tr></thead><tbody>' + body.map(function (row, index) {
      return '<tr' + (totalFirst && index === 0 ? ' class="total"' : '') + '>' + row.map(function (cell) {
        return '<td>' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  }

  function topReason(list) {
    var reasons = groupBy(list.filter(function (row) { return row.lossReason; }), function (row) { return row.lossReason; })
      .sort(function (a, b) { return b.m.total - a.m.total; });
    return reasons[0] ? reasons[0].key : 'Sem motivo dominante';
  }

  function daysInSelection(list) {
    return Math.max(1, unique(list.map(function (row) { return row.date; })).length);
  }

  function getTargets() {
    try {
      return Object.assign({}, defaultTargets, JSON.parse(localStorage.getItem('st1Targets') || '{}'));
    } catch (error) {
      return Object.assign({}, defaultTargets);
    }
  }

  function saveTargets(targets) {
    try { localStorage.setItem('st1Targets', JSON.stringify(targets)); } catch (error) {}
  }

  function getFcas() {
    try { return JSON.parse(localStorage.getItem('st1ManualFcas') || '[]'); } catch (error) { return []; }
  }

  function saveFcas(items) {
    try { localStorage.setItem('st1ManualFcas', JSON.stringify(items)); } catch (error) {}
  }

  function renderShell(m, restriction) {
    text('sourceLabel', 'Fonte: cache GrowthPack | ' + fmt(rows.length) + ' Lead IDs');
    set('statusLine',
      '<span class="pill"><b>Leads:</b> ' + fmt(m.total) + '</span>' +
      '<span class="pill"><b>Compras:</b> ' + fmt(m.purchase) + ' (' + pct(m.conversion) + ')</span>' +
      '<span class="pill"><b>Valor:</b> ' + money(m.value) + '</span>' +
      '<span class="pill"><b>CRM:</b> ' + pct(m.health) + '</span>' +
      '<span class="pill"><b>Restrição:</b> ' + esc(restriction.current.key) + '</span>'
    );
    set('heroMiniStatus',
      '<div><b>' + fmt(m.loss) + '</b><span>motivos</span></div>' +
      '<div><b>' + fmt(m.noOrigin) + '</b><span>sem origem</span></div>' +
      '<div><b>' + money(m.ticket) + '</b><span>ticket</span></div>' +
      '<div><b>' + Math.round(restriction.current.score) + '</b><span>score restrição</span></div>'
    );
  }

  function renderOverview(m, restriction) {
    set('globalKpis',
      kpi('Lead IDs', fmt(m.total), fmt(m.leadTag) + ' com tag LEAD') +
      kpi('Compras', fmt(m.purchase), pct(m.conversion) + ' compra / lead') +
      kpi('Valor registrado', money(m.value), 'Ticket médio ' + money(m.ticket)) +
      kpi('Qualidade CRM', pct(m.health), fmt(m.dataIssues) + ' pontos de auditoria')
    );

    var funnel = [
      ['Lead ID', m.total, div(m.total, m.total)],
      ['MQL', m.mql, div(m.mql, m.total)],
      ['SQL', m.sql, div(m.sql, m.total)],
      ['Oportunidade', m.opportunity, div(m.opportunity, m.total)],
      ['Compra', m.purchase, div(m.purchase, m.total)]
    ];
    set('funnelChart', '<div class="funnel-list">' + funnel.map(function (item) {
      return bar(item[0], item[1], Math.max(1, m.total), fmt(item[1]) + ' | ' + pct(item[2]));
    }).join('') + '</div>');

    var days = groupBy(filtered, function (row) { return row.date; }).sort(function (a, b) { return a.key.localeCompare(b.key); });
    var maxDay = Math.max.apply(null, days.map(function (item) { return item.m.total; }).concat([1]));
    set('dailyBars', '<div class="bar-list">' + days.map(function (day) {
      return bar(day.key.slice(5), day.m.total, maxDay, fmt(day.m.total) + ' leads | ' + fmt(day.m.purchase) + ' compras');
    }).join('') + '</div>');

    var metaShare = div(metrics(filtered.filter(function (row) { return row.origin === 'Meta Ads'; })).purchase, metrics(filtered.filter(function (row) { return row.origin === 'Meta Ads'; })).total);
    var googleShare = div(metrics(filtered.filter(function (row) { return row.origin === 'Google Ads'; })).purchase, metrics(filtered.filter(function (row) { return row.origin === 'Google Ads'; })).total);
    set('executiveInsights',
      insight(restriction.current.kind, 'Restrição atual: ' + restriction.current.key, restriction.current.evidence + ' Próxima ação: ' + restriction.current.action) +
      insight('danger', 'CRM de perda precisa ser governado', fmt(m.reasonWithoutLostFlag) + ' registros têm motivo de perda sem a flag LEAD PERDIDO.') +
      insight('info', 'Google supera Meta em intenção', 'Google Ads converte ' + pct(googleShare) + ' contra ' + pct(metaShare) + ' em Meta Ads no filtro.')
    );

    set('filteredTable', table(
      ['Data', 'Lead', 'Vendedora', 'Origem', 'MQL', 'SQL', 'Oportunidade', 'Compra', 'Motivo', 'Valor'],
      filtered.slice(0, 260).map(function (row) {
        return [row.date, esc(row.leadId), esc(row.seller), esc(row.origin), row.mql ? 'Sim' : '-', row.sql ? 'Sim' : '-', row.opportunity ? 'Sim' : '-', row.purchase ? 'Sim' : '-', esc(row.lossReason || '-'), money(row.value)];
      })
    ));
  }

  function renderRestriction(m, restriction) {
    var current = restriction.current;
    set('restrictionKpis',
      kpi('Restrição atual', esc(current.key), 'score ' + Math.round(current.score)) +
      kpi('Impacto estimado', fmt(m.dataIssues), 'pontos de fricção no filtro') +
      kpi('Perda operacional', fmt(m.loss), pct(m.lossRate) + ' dos leads') +
      kpi('Health CRM', pct(m.health), current.owner)
    );

    set('currentRestriction',
      '<div class="restriction-hero">' +
      '<div class="restriction-score"><div><span>Score da restrição</span><strong>' + Math.round(current.score) + '</strong></div>' + tag(current.kind, current.key) + '</div>' +
      '<div class="decision-grid">' +
      '<div class="decision-item"><b>Evidência</b><span>' + esc(current.evidence) + '</span></div>' +
      '<div class="decision-item"><b>Impacto</b><span>' + esc(current.impact) + '</span></div>' +
      '<div class="decision-item"><b>Ação</b><span>' + esc(current.action) + '</span></div>' +
      '<div class="decision-item"><b>Dono e prazo</b><span>' + esc(current.owner) + ' | ' + esc(current.due) + '</span></div>' +
      '</div></div>'
    );

    set('tocSteps',
      '<div class="toc-list">' +
      '<div class="toc-step"><div><b>Identificar</b><span>' + esc(current.key) + ' é a restrição dominante do filtro atual.</span></div></div>' +
      '<div class="toc-step"><div><b>Explorar</b><span>Usar o que já existe: SLA, campos obrigatórios, fila quente e follow-up.</span></div></div>' +
      '<div class="toc-step"><div><b>Subordinar</b><span>Priorizar tarefas e mídia em volta da restrição, não de métricas locais.</span></div></div>' +
      '<div class="toc-step"><div><b>Elevar</b><span>Se continuar travando, adicionar automação, capacidade ou ajuste de oferta.</span></div></div>' +
      '<div class="toc-step"><div><b>Repetir</b><span>Quando destravar, o painel recalcula o próximo gargalo.</span></div></div>' +
      '</div>'
    );

    set('restrictionMatrix', table(
      ['Restrição possível', 'Score', 'Evidência', 'Ação V4 ON', 'Dono'],
      restriction.candidates.map(function (item) {
        return [esc(item.key), fmt(item.score), esc(item.evidence), esc(item.action), esc(item.owner)];
      })
    ));

    var leaks = stageModel(m).filter(function (stage) { return stage.key !== 'Venda'; });
    set('revenueLeakTable', table(
      ['Ponto do fluxo', 'Entrada', 'Saída', 'WIP / vazamento', 'Peso', 'Ação'],
      leaks.map(function (stage) {
        return [
          esc(stage.key),
          fmt(stage.count),
          fmt(stage.next),
          fmt(stage.wip),
          pct(stage.loss),
          stage.wip > 0 ? 'Reduzir fila e definir próximo passo' : 'Manter fluxo'
        ];
      })
    ));
  }

  function renderPcp(m) {
    var days = daysInSelection(filtered);
    var targets = getTargets();
    var stages = stageModel(m);
    var topStage = stages.slice().sort(function (a, b) { return b.wip - a.wip; })[0] || stages[0];
    var sellers = groupBy(filtered, function (row) { return row.seller; }).sort(function (a, b) { return b.m.total - a.m.total; });
    var capacityTotal = sellers.length * targets.sellerDailyCapacity * days;
    var overloaded = sellers.filter(function (seller) {
      return div(seller.m.total, days) > targets.sellerDailyCapacity;
    }).length;

    set('pcpKpis',
      kpi('WIP crítico', esc(topStage.key), fmt(topStage.wip) + ' registros acumulados') +
      kpi('Capacidade planejada', fmt(capacityTotal), fmt(targets.sellerDailyCapacity) + ' leads/vendedora/dia') +
      kpi('Sobrecarga', fmt(overloaded), 'vendedoras acima da capacidade') +
      kpi('Aging do gargalo', esc(topStage.aging), 'etapa ' + esc(topStage.key))
    );

    set('stageWipTable', table(
      ['Etapa', 'Entradas', 'Saídas', 'WIP', 'Aging', 'SLA', 'Dono', 'Restrição?'],
      stages.map(function (stage) {
        var kind = stage.wip === topStage.wip && stage.wip > 0 ? 'Sim' : 'Não';
        return [esc(stage.key), fmt(stage.count), fmt(stage.next), fmt(stage.wip), esc(stage.aging), esc(stage.sla), esc(stage.owner), kind];
      })
    ));

    set('sellerCapacityTable', table(
      ['Vendedora', 'Leads/dia', 'Capacidade/dia', 'Uso', 'WIP comercial', 'Prioridade'],
      sellers.map(function (seller) {
        var daily = div(seller.m.total, days);
        var usage = div(daily, targets.sellerDailyCapacity);
        var wip = Math.max(0, seller.m.opportunity - seller.m.purchase);
        return [
          esc(seller.key),
          fmt(daily),
          fmt(targets.sellerDailyCapacity),
          pct(usage),
          fmt(wip),
          usage > 1 ? 'Redistribuir fila' : wip > 15 ? 'Follow-up de oportunidades' : 'Manter ritmo'
        ];
      })
    ));

    set('priorityQueueTable', table(
      ['Prioridade', 'Fila', 'Critério', 'Volume', 'Ação de hoje'],
      [
        ['P0', 'Oportunidade sem compra', 'OPP - compras', fmt(Math.max(0, m.opportunity - m.purchase)), 'Follow-up D0/D1/D3 com dono'],
        ['P0', 'Perda sem status', 'Motivo preenchido sem LEAD PERDIDO', fmt(m.reasonWithoutLostFlag), 'Corrigir CRM antes do check-in'],
        ['P1', 'Leads sem origem', 'Origem vazia', fmt(m.noOrigin), 'Obrigar UTM/origem na entrada'],
        ['P1', 'SQL sem MQL', 'Etapa fora de ordem', fmt(m.sqlWithoutMql), 'Auditar marcação da jornada'],
        ['P2', 'Valor sem compra', 'Valor preenchido sem venda', fmt(m.valueWithoutPurchase), 'Separar potencial de receita realizada']
      ]
    ));

    set('pcpInsights',
      insight('info', 'Capacidade é regra do jogo', 'O PCP comercial mostra se o volume que entra cabe no time antes de cobrar conversão individual.') +
      insight(topStage.wip > 100 ? 'danger' : 'warn', 'WIP muda a prioridade', 'A etapa com mais acúmulo hoje é ' + topStage.key + ', com ' + fmt(topStage.wip) + ' registros.') +
      insight('ok', 'Fila quente primeiro', 'Oportunidade aberta e compra sem progressão viram prioridade antes de novas otimizações locais.')
    );
  }

  function renderCommercial(m) {
    var sellers = groupBy(filtered, function (row) { return row.seller; }).sort(function (a, b) {
      return b.m.purchase - a.m.purchase || b.m.conversion - a.m.conversion;
    });

    set('commercialKpis',
      kpi('Vendedoras', fmt(sellers.length), 'com dados no filtro') +
      kpi('Compra / lead', pct(m.conversion), fmt(m.purchase) + ' compras') +
      kpi('Ticket médio', money(m.ticket), 'valor por compra') +
      kpi('Quebras de etapa', fmt(m.sqlWithoutMql + m.oppWithoutSql + m.purchaseWithoutOpp), 'auditoria do funil')
    );

    set('sellerCards', sellers.map(function (seller, index) {
      return '<article class="glass seller">' +
        '<div class="seller-head"><div><span class="kpi-label">#' + (index + 1) + ' comercial</span><h3>' + esc(seller.key) + '</h3></div><strong class="seller-score">' + pct(seller.m.conversion) + '</strong></div>' +
        '<div class="seller-stats">' +
        '<div><b>' + fmt(seller.m.total) + '</b><small>Leads</small></div>' +
        '<div><b>' + fmt(seller.m.mql) + '</b><small>MQL</small></div>' +
        '<div><b>' + fmt(seller.m.sql) + '</b><small>SQL</small></div>' +
        '<div><b>' + fmt(seller.m.opportunity) + '</b><small>Opp</small></div>' +
        '<div><b>' + fmt(seller.m.purchase) + '</b><small>Compras</small></div>' +
        '</div><p>Motivo dominante: ' + esc(topReason(seller.rows)) + '</p></article>';
    }).join(''));

    set('sellerFunnel', table(
      ['Vendedora', 'Leads', 'MQL', 'SQL', 'Oportunidades', 'Compras', 'Compra/Lead', 'Ticket', 'Motivos'],
      sellers.map(function (seller) {
        return [esc(seller.key), fmt(seller.m.total), fmt(seller.m.mql), fmt(seller.m.sql), fmt(seller.m.opportunity), fmt(seller.m.purchase), pct(seller.m.conversion), money(seller.m.ticket), fmt(seller.m.loss)];
      })
    ));

    set('stageLoss', table(
      ['Vendedora', 'Lead -> MQL', 'MQL -> SQL', 'SQL -> Oportunidade', 'Oportunidade -> Compra', 'Inconsistências'],
      sellers.map(function (seller) {
        return [
          esc(seller.key),
          fmt(Math.max(0, seller.m.total - seller.m.mql)),
          fmt(Math.max(0, seller.m.mql - seller.m.sql)),
          fmt(Math.max(0, seller.m.sql - seller.m.opportunity)),
          fmt(Math.max(0, seller.m.opportunity - seller.m.purchase)),
          fmt(seller.m.reasonWithoutLostFlag + seller.m.sqlWithoutMql + seller.m.oppWithoutSql + seller.m.purchaseWithoutOpp)
        ];
      })
    ));

    var reasons = groupBy(filtered.filter(function (row) { return row.lossReason; }), function (row) { return row.lossReason; })
      .sort(function (a, b) { return b.m.total - a.m.total; }).slice(0, 9);
    set('reasonSeller', table(
      ['Motivo'].concat(sellers.map(function (seller) { return seller.key; })).concat(['Total']),
      reasons.map(function (reason) {
        return [esc(reason.key)].concat(sellers.map(function (seller) {
          return fmt(seller.rows.filter(function (row) { return row.lossReason === reason.key; }).length);
        })).concat([fmt(reason.m.total)]);
      })
    ));
  }

  function renderMedia(m) {
    var origins = groupBy(filtered, function (row) { return row.origin; }).sort(function (a, b) {
      return b.m.total - a.m.total;
    });
    var maxOrigin = Math.max.apply(null, origins.map(function (origin) { return origin.m.total; }).concat([1]));

    set('mediaKpis',
      kpi('Sem origem', fmt(m.noOrigin), pct(div(m.noOrigin, m.total)) + ' dos leads') +
      kpi('Origens ativas', fmt(origins.length), 'canais detectados') +
      kpi('Compras atribuídas', fmt(m.purchase), pct(m.conversion) + ' no filtro') +
      kpi('Valor', money(m.value), 'ticket ' + money(m.ticket))
    );

    set('originBars', '<div class="bar-list">' + origins.map(function (origin) {
      return bar(origin.key, origin.m.total, maxOrigin, fmt(origin.m.total) + ' leads');
    }).join('') + '</div>');

    set('originConversion', '<div class="bar-list">' + origins.map(function (origin) {
      return bar(origin.key, origin.m.conversion * 100, 100, pct(origin.m.conversion) + ' | ' + fmt(origin.m.purchase) + ' compras');
    }).join('') + '</div>');

    var sellers = groupBy(filtered, function (row) { return row.seller; }).sort(function (a, b) { return b.m.purchase - a.m.purchase; });
    var originNames = origins.map(function (origin) { return origin.key; });
    set('sellerOrigin', table(
      ['Vendedora'].concat(originNames).concat(['Compras', 'Conv.']),
      sellers.map(function (seller) {
        return [esc(seller.key)].concat(originNames.map(function (originName) {
          return fmt(seller.rows.filter(function (row) { return row.origin === originName; }).length);
        })).concat([fmt(seller.m.purchase), pct(seller.m.conversion)]);
      })
    ));

    var google = metrics(filtered.filter(function (row) { return row.origin === 'Google Ads'; }));
    var meta = metrics(filtered.filter(function (row) { return row.origin === 'Meta Ads'; }));
    set('mediaInsights',
      insight('info', 'Google Ads', fmt(google.total) + ' leads, ' + fmt(google.purchase) + ' compras e conversão de ' + pct(google.conversion) + '.') +
      insight('warn', 'Meta Ads', fmt(meta.total) + ' leads, ' + fmt(meta.purchase) + ' compras e conversão de ' + pct(meta.conversion) + '.') +
      insight('danger', 'Sem origem marcada', fmt(m.noOrigin) + ' registros impedem leitura real de CAC e qualidade por campanha.')
    );
  }

  function renderService(m) {
    var conversations = m.total;
    var qualified = m.mql;
    var human = m.sql;
    var abandoned = reasonCount(filtered, 'falta de interesse') + reasonCount(filtered, 'atendimento');
    var outsideHours = countWhere(filtered, function (row) {
      var day = new Date(row.date + 'T00:00:00').getDay();
      return day === 0 || day === 6;
    });
    var slaRisk = m.noOrigin + abandoned + Math.max(0, m.total - m.leadTag);

    set('serviceKpis',
      kpi('Conversas / leads', fmt(conversations), 'entrada operacional') +
      kpi('Qualificados', fmt(qualified), pct(div(qualified, conversations)) + ' viram MQL') +
      kpi('Transbordo humano', fmt(human), pct(div(human, conversations)) + ' chegam em SQL') +
      kpi('Risco SLA', fmt(slaRisk), 'inferido por dados incompletos e abandono')
    );

    var max = Math.max(conversations, qualified, human, 1);
    set('botFlow',
      '<div class="flow-grid">' +
      '<div class="flow-step"><b>Entrada</b><span>Form, WhatsApp, mídia ou indicação</span><strong>' + fmt(conversations) + '</strong></div>' +
      '<div class="flow-step"><b>Bot / triagem</b><span>Coleta interesse, região e urgência</span><strong>' + fmt(m.leadTag) + '</strong></div>' +
      '<div class="flow-step"><b>MQL</b><span>Perfil mínimo validado</span><strong>' + fmt(qualified) + '</strong></div>' +
      '<div class="flow-step"><b>Humano</b><span>Transbordo para comercial</span><strong>' + fmt(human) + '</strong></div>' +
      '<div class="flow-step"><b>Compra</b><span>Venda registrada</span><strong>' + fmt(m.purchase) + '</strong></div>' +
      '</div><div class="bar-list" style="margin-top:14px">' +
      bar('Entrada', conversations, max, fmt(conversations)) +
      bar('Qualificados', qualified, max, fmt(qualified)) +
      bar('Humano', human, max, fmt(human)) +
      bar('Compras', m.purchase, max, fmt(m.purchase)) +
      '</div>'
    );

    set('slaTable', table(
      ['Sinal', 'Volume', 'Leitura', 'Ação'],
      [
        ['Mensagens fora do horário', fmt(outsideHours), 'Entradas em sábado/domingo precisam de cobertura ou régua.', 'Bot com promessa clara + alerta de retomada'],
        ['Atendimento não comercial', fmt(reasonCount(filtered, 'atendimento')), 'Lead desviou para demanda que não deveria consumir vendedor.', 'Fila separada por atendimento/suporte'],
        ['Falta de interesse/prioridade', fmt(reasonCount(filtered, 'falta de interesse') + reasonCount(filtered, 'prioridade')), 'Sinal de urgência baixa, promessa fraca ou follow-up insuficiente.', 'Régua D0-D3 com prova social'],
        ['Sem tag LEAD', fmt(Math.max(0, m.total - m.leadTag)), 'Entrada não marcada compromete automação e histórico.', 'Tag automática no nascimento do lead'],
        ['Sem origem', fmt(m.noOrigin), 'Bot/CRM não guardou canal ou campanha.', 'Origem obrigatória antes de distribuir']
      ]
    ));

    set('servicePlaybook', table(
      ['Momento', 'Campo obrigatório', 'Regra', 'Automação recomendada'],
      [
        ['Entrada', 'Origem, campanha, canal', 'Sem origem não entra no diagnóstico de mídia.', 'Validar UTM/lead source'],
        ['Triagem', 'Produto, região, urgência', 'Lead sem fit sai da fila comercial padrão.', 'Bot qualifica antes do humano'],
        ['Transbordo', 'Dono e SLA', 'Todo lead humano precisa de responsável.', 'Alerta se passar do SLA'],
        ['Follow-up', 'Próxima ação e data', 'Sem próxima ação vira risco.', 'Tarefa D0/D1/D3'],
        ['Fechamento', 'Compra ou motivo de perda', 'Perda sem motivo não ensina o sistema.', 'Campo obrigatório ao perder']
      ]
    ));
  }

  function renderRetention(m) {
    var promoters = Math.round(m.purchase * .42);
    var neutral = Math.round(m.purchase * .36);
    var detractors = Math.max(0, m.purchase - promoters - neutral);
    var inactive = Math.max(0, m.loss - m.purchase);
    var expansion = Math.round(m.purchase * .18);

    set('retentionKpis',
      kpi('Base vendida', fmt(m.purchase), 'clientes para pós-venda') +
      kpi('Promotores estimados', fmt(promoters), 'modelo pronto para CSAT') +
      kpi('Detratores estimados', fmt(detractors), 'fila de recuperação') +
      kpi('Expansão potencial', fmt(expansion), 'upsell, indicação e recompra')
    );

    var max = Math.max(promoters, neutral, detractors, inactive, 1);
    set('csatSegments',
      '<div class="bar-list">' +
      bar('Promotores', promoters, max, fmt(promoters) + ' | pedir depoimento') +
      bar('Neutros', neutral, max, fmt(neutral) + ' | nutrir valor') +
      bar('Detratores', detractors, max, fmt(detractors) + ' | recuperar') +
      bar('Inativos/perdidos', inactive, max, fmt(inactive) + ' | reativar') +
      '</div>'
    );

    set('relationshipRules', table(
      ['Grupo', 'Gatilho', 'Próxima ação', 'Automação'],
      [
        ['Promotor', 'CSAT 4-5 / compra satisfeita', 'Pedir depoimento, indicação e upgrade.', 'Mensagem pós-instalação + link de review'],
        ['Neutro', 'CSAT 3 / sem entusiasmo', 'Entender objeção e reforçar valor.', 'Pesquisa curta + tarefa para CS'],
        ['Detrator', 'CSAT 1-2 / reclamação', 'Pedido de desculpas, correção e acompanhamento.', 'Alerta para gestor + SLA de recuperação'],
        ['Sem resposta', 'Não respondeu pesquisa', 'Follow-up de satisfação.', 'Nova tentativa em 24h/72h'],
        ['Cliente inativo', 'Compra não concluída ou lead perdido', 'Reativação por motivo específico.', 'Régua por motivo de perda']
      ]
    ));

    set('retentionOpportunities', table(
      ['Oportunidade', 'Volume base', 'Como detectar', 'Ação'],
      [
        ['Depoimentos', fmt(promoters), 'Clientes promotores após instalação.', 'Coletar prova social para mídia e landing page'],
        ['Indicações', fmt(Math.round(promoters * .45)), 'Promotor com bom ticket.', 'Campanha de indicação'],
        ['Recuperação', fmt(detractors), 'Detrator ou perda por atendimento.', 'FCA de experiência e contato humano'],
        ['Reativação', fmt(inactive), 'Perda por falta de prioridade/timing.', 'Régua de retorno com oferta clara'],
        ['Expansão', fmt(expansion), 'Compra com bom perfil e necessidade recorrente.', 'Upsell/cross-sell controlado']
      ]
    ));
  }

  function renderLosses(m) {
    var reasons = groupBy(filtered.filter(function (row) { return row.lossReason; }), function (row) { return row.lossReason; })
      .sort(function (a, b) { return b.m.total - a.m.total; });
    var categories = groupBy(filtered.filter(function (row) { return row.lossReason; }), function (row) { return row.reasonCategory; })
      .sort(function (a, b) { return b.m.total - a.m.total; });
    var maxReason = Math.max.apply(null, reasons.map(function (item) { return item.m.total; }).concat([1]));
    var maxCategory = Math.max.apply(null, categories.map(function (item) { return item.m.total; }).concat([1]));

    set('lossKpis',
      kpi('Motivos preenchidos', fmt(m.loss), pct(m.lossRate) + ' dos leads') +
      kpi('Flag perdido', fmt(m.lostFlag), 'campo LEAD PERDIDO') +
      kpi('Gap de status', fmt(m.reasonWithoutLostFlag), 'motivo sem flag') +
      kpi('Categorias', fmt(categories.length), 'grupos operacionais')
    );

    set('reasonBars', '<div class="bar-list">' + reasons.slice(0, 14).map(function (reason) {
      return bar(reason.key, reason.m.total, maxReason, fmt(reason.m.total) + ' | ' + pct(div(reason.m.total, m.loss)));
    }).join('') + '</div>');

    set('categoryBars', '<div class="bar-list">' + categories.map(function (category) {
      return bar(category.key, category.m.total, maxCategory, fmt(category.m.total) + ' registros');
    }).join('') + '</div>');

    set('categoryPlan', table(
      ['Categoria', 'Volume', 'Peso', 'Leitura V4 ON', 'Ação operacional'],
      categories.map(function (category) {
        return [
          esc(category.key),
          fmt(category.m.total),
          pct(div(category.m.total, m.loss)),
          esc(readingForCategory(category.key)),
          esc(actionForCategory(category.key))
        ];
      })
    ));
  }

  function readingForCategory(category) {
    if (category.indexOf('Infraestrutura') >= 0) return 'Lead entrou antes de validação de cobertura ou viabilidade.';
    if (category.indexOf('Comercial') >= 0) return 'Fricção de prioridade, urgência e follow-up.';
    if (category.indexOf('Qualificação') >= 0) return 'Entrada precisa de triagem antes de chegar no vendedor.';
    if (category.indexOf('Preço') >= 0) return 'Oferta, condição e expectativa precisam ser revisadas.';
    if (category.indexOf('Base atendida') >= 0) return 'Lead já tem solução ou concorrente forte.';
    return 'Manter auditoria semanal e padronizar taxonomia.';
  }

  function actionForCategory(category) {
    if (category.indexOf('Infraestrutura') >= 0) return 'Pré-check de cobertura antes da distribuição comercial.';
    if (category.indexOf('Comercial') >= 0) return 'Régua D0-D3 com urgência, prova social e oferta clara.';
    if (category.indexOf('Qualificação') >= 0) return 'Separar atendimento não comercial e lead recuperável.';
    if (category.indexOf('Preço') >= 0) return 'Revisar objeções, condição e comunicação do plano.';
    if (category.indexOf('Base atendida') >= 0) return 'Nutrição e abordagem comparativa com benefício real.';
    return 'Criar FCA quando repetir por 2 ciclos.';
  }

  function renderTargets(m, keepInputs) {
    var targets = getTargets();
    var days = daysInSelection(filtered);
    var projectedLeads = div(m.total, days) * 30;
    var projectedPurchases = div(m.purchase, days) * 30;
    var projectedRevenue = div(m.value, days) * 30;

    if (!keepInputs) {
      set('targetInputs',
        targetInput('monthlyLeads', 'Meta mensal de leads', targets.monthlyLeads, 1) +
        targetInput('monthlyPurchases', 'Meta mensal de compras', targets.monthlyPurchases, 1) +
        targetInput('monthlyRevenue', 'Meta mensal de valor', targets.monthlyRevenue, 100) +
        targetInput('minConversionRate', 'Conversão mínima', targets.minConversionRate, .01) +
        targetInput('metaInvestment', 'Investimento Meta', targets.metaInvestment, 100) +
        targetInput('googleInvestment', 'Investimento Google', targets.googleInvestment, 100) +
        targetInput('minRoas', 'ROAS mínimo', targets.minRoas, .1) +
        targetInput('sellerDailyCapacity', 'Capacidade vendedor/dia', targets.sellerDailyCapacity, 1)
      );
    }

    var investment = number(targets.metaInvestment) + number(targets.googleInvestment);
    var cac = div(investment, m.purchase);
    var roas = div(m.value, investment);

    set('projectionKpis',
      kpi('Proj. leads', fmt(projectedLeads), '30 dias no ritmo atual') +
      kpi('Proj. compras', fmt(projectedPurchases), '30 dias no ritmo atual') +
      kpi('Proj. valor', money(projectedRevenue), '30 dias no ritmo atual') +
      kpi('CAC / ROAS', money(cac) + ' / ' + roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x', 'investimento editável')
    );

    set('targetProgress',
      progress('Leads', m.total, targets.monthlyLeads) +
      progress('Compras', m.purchase, targets.monthlyPurchases) +
      progress('Valor', m.value, targets.monthlyRevenue, true) +
      progress('Conversão mínima', m.conversion, targets.minConversionRate, false, true) +
      progressText('ROAS mínimo', roas, targets.minRoas, roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x', number(targets.minRoas).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'x')
    );

    set('forecastTable', table(
      ['Cenário', 'Leads', 'Compras', 'Conversão', 'Valor', 'CAC', 'ROAS'],
      [
        ['Conservador', fmt(projectedLeads * .85), fmt(projectedPurchases * .85), pct(m.conversion * .92), money(projectedRevenue * .85), money(div(investment, projectedPurchases * .85)), (div(projectedRevenue * .85, investment)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x'],
        ['Atual', fmt(projectedLeads), fmt(projectedPurchases), pct(m.conversion), money(projectedRevenue), money(div(investment, projectedPurchases)), (div(projectedRevenue, investment)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x'],
        ['Agressivo', fmt(projectedLeads * 1.15), fmt(projectedPurchases * 1.15), pct(Math.min(1, m.conversion * 1.08)), money(projectedRevenue * 1.15), money(div(investment, projectedPurchases * 1.15)), (div(projectedRevenue * 1.15, investment)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x']
      ]
    ));

    var windows = [
      ['01 a 07/06', '2026-06-01', '2026-06-07'],
      ['08 a 14/06', '2026-06-08', '2026-06-14'],
      ['15 a 18/06', '2026-06-15', '2026-06-18'],
      ['Filtro atual', filters.start || '0000-00-00', filters.end || '9999-99-99']
    ];
    set('periodCompare', table(
      ['Janela', 'Leads', 'Compras', 'Conversão', 'Motivos', 'Valor'],
      windows.map(function (windowRange) {
        var rangeRows = filtered.filter(function (row) { return row.date >= windowRange[1] && row.date <= windowRange[2]; });
        var data = metrics(rangeRows);
        return [windowRange[0], fmt(data.total), fmt(data.purchase), pct(data.conversion), fmt(data.loss), money(data.value)];
      })
    ));

    var months = groupBy(filtered, function (row) { return row.date.slice(0, 7); }).sort(function (a, b) { return a.key.localeCompare(b.key); });
    set('monthCompare', table(
      ['Mês', 'Leads', 'Compras', 'Conversão', 'Valor', 'Proj. leads', 'Proj. compras'],
      months.map(function (month) {
        var monthDays = daysInSelection(month.rows);
        return [month.key, fmt(month.m.total), fmt(month.m.purchase), pct(month.m.conversion), money(month.m.value), fmt(div(month.m.total, monthDays) * 30), fmt(div(month.m.purchase, monthDays) * 30)];
      })
    ));
  }

  function targetInput(key, label, value, step) {
    return '<article class="glass target-card"><span class="kpi-label">' + esc(label) + '</span><input data-target="' + key + '" type="number" step="' + step + '" value="' + value + '"></article>';
  }

  function progress(label, current, target, isMoney, isRate) {
    var width = Math.max(3, Math.min(100, div(current, target) * 100));
    var currentText = isMoney ? money(current) : isRate ? pct(current) : fmt(current);
    var targetText = isMoney ? money(target) : isRate ? pct(target) : fmt(target);
    return '<div class="progress-row"><div><strong>' + esc(label) + '</strong><span>' + currentText + ' de ' + targetText + '</span></div><div class="bar-line"><i style="--w:' + width + '%"></i></div><b>' + pct(div(current, target)) + '</b></div>';
  }

  function progressText(label, current, target, currentText, targetText) {
    var width = Math.max(3, Math.min(100, div(current, target) * 100));
    return '<div class="progress-row"><div><strong>' + esc(label) + '</strong><span>' + esc(currentText) + ' de ' + esc(targetText) + '</span></div><div class="bar-line"><i style="--w:' + width + '%"></i></div><b>' + pct(div(current, target)) + '</b></div>';
  }

  function renderFca(m) {
    var items = getFcas();
    set('fcaList', items.length ? items.map(function (item, index) {
      return '<div class="fca-item"><h4>' + esc(item.title) + '</h4><small>' + esc(item.status) + ' | Dono: ' + esc(item.owner) + ' | Prazo: ' + esc(item.due) + '</small>' +
        '<p><b>Fato:</b> ' + esc(item.fact || '-') + '</p><p><b>Causa:</b> ' + esc(item.cause || '-') + '</p><p><b>Ação:</b> ' + esc(item.action || '-') + '</p>' +
        '<button class="btn" type="button" data-remove-fca="' + index + '">Remover</button></div>';
    }).join('') : '<p class="empty">Nenhum FCA manual cadastrado ainda.</p>');

    set('taskTable', table(
      ['Prioridade', 'Task', 'Por que', 'Dono sugerido'],
      [
        ['Crítica', 'Obrigar status perdido quando houver motivo', fmt(m.reasonWithoutLostFlag) + ' motivos sem flag LEAD PERDIDO', 'CRM / Sales Ops'],
        ['Alta', 'Obrigar origem/campanha no lead', fmt(m.noOrigin) + ' registros sem origem marcada', 'Mídia + CRM'],
        ['Alta', 'Pré-check de cobertura', 'Motivos de infraestrutura consomem atendimento humano', 'Operação + Comercial'],
        ['Alta', 'Régua D0-D3 para falta de prioridade', 'Maior bloco acionável de perda comercial', 'Coordenação comercial'],
        ['Média', 'Auditar progressão MQL -> SQL -> Oportunidade -> Compra', fmt(m.sqlWithoutMql + m.oppWithoutSql + m.purchaseWithoutOpp) + ' quebras de etapa', 'Gestão comercial']
      ]
    ));
  }

  function renderHandoff(m, restriction) {
    var sellers = unique(filtered.map(function (row) { return row.seller; }));
    var origins = unique(filtered.map(function (row) { return row.origin; }));
    var openOpps = Math.max(0, m.opportunity - m.purchase);
    var riskCount = [
      m.noOrigin,
      m.reasonWithoutLostFlag,
      m.sqlWithoutMql + m.oppWithoutSql + m.purchaseWithoutOpp,
      openOpps
    ].filter(function (value) { return value > 0; }).length;

    set('handoffKpis',
      kpi('Contexto consolidado', fmt(m.total), 'Lead IDs no escopo') +
      kpi('Donos ativos', fmt(sellers.length), 'responsáveis comerciais') +
      kpi('Fontes ativas', fmt(origins.length), 'origens/canais') +
      kpi('Riscos abertos', fmt(riskCount), restriction.current.key)
    );

    set('handoffSummary',
      '<div class="compact-grid">' +
      '<div class="rule-item"><b>Visão de negócio</b><span>Internet local com funil de venda, cobertura, viabilidade e alta dependência de CRM confiável.</span></div>' +
      '<div class="rule-item"><b>Restrição atual</b><span>' + esc(restriction.current.key) + ': ' + esc(restriction.current.evidence) + '</span></div>' +
      '<div class="rule-item"><b>O que já está funcionando</b><span>' + fmt(m.purchase) + ' compras, ' + pct(m.conversion) + ' de compra/lead e ticket médio de ' + money(m.ticket) + '.</span></div>' +
      '<div class="rule-item"><b>O que não pode se perder</b><span>Motivos de perda, origem, dono, próxima ação e progressão MQL → SQL → Oportunidade → Compra.</span></div>' +
      '</div>'
    );

    set('stackTable', table(
      ['Camada', 'Fonte / ferramenta', 'Status no painel', 'Próximo cuidado'],
      [
        ['CRM', 'GrowthPack / BASE_CRM', 'Consolidado por Lead ID', 'Corrigir status perdido e etapas'],
        ['Mídia', 'Meta Ads + Google Ads', 'Origem lida quando marcada', 'Fechar lacuna de origem/UTM'],
        ['Atendimento', 'WhatsApp / Bot / Comercial', 'Modelo operacional inferido', 'Conectar SLA real quando disponível'],
        ['Tarefas', 'FCA local + rotina V4 ON', 'Cadastro manual no navegador', 'Definir dono, prazo e evidência'],
        ['Check-ins', 'Reuniões / transcrições / handoff', 'Estrutura pronta', 'Registrar decisões e próximos 7 dias']
      ]
    ));

    set('nextSevenDays', table(
      ['Dia', 'Prioridade', 'Dono', 'Evidência esperada'],
      [
        ['D0', 'Corrigir origem obrigatória e status perdido', 'CRM / Sales Ops', 'Queda de registros sem origem e motivo sem flag'],
        ['D1', 'Separar fila de cobertura/viabilidade antes do comercial', 'Operação + CRM', 'Menos perda por infraestrutura'],
        ['D2', 'Auditar Meta x Google por motivo de perda', 'Mídia + Comercial', 'Canal com qualidade medida por compra e motivo'],
        ['D3', 'Implantar régua D0-D3 para falta de prioridade', 'Coordenação comercial', 'Mais retorno e menos perda por interesse'],
        ['D4', 'Revisar WIP e capacidade por vendedora', 'Gestão comercial', 'Fila redistribuída e SLA definido'],
        ['D5', 'Criar FCA dos 2 maiores gargalos', 'Gestor', 'Fato, causa, ação, dono e prazo cadastrados'],
        ['D7', 'Check-in de restrição: o gargalo mudou?', 'GrowthOps', 'Nova restrição calculada pelo cockpit']
      ]
    ));

    set('handoffRisks', table(
      ['Risco', 'Volume', 'Por que importa', 'Mitigação'],
      [
        ['CRM não confiável', fmt(m.dataIssues), 'Decisão vira opinião se o dado está incompleto.', 'Auditoria semanal + campos obrigatórios'],
        ['Origem vazia', fmt(m.noOrigin), 'CAC, ROAS e qualidade por canal ficam cegos.', 'UTM/origem obrigatória'],
        ['Perda sem status', fmt(m.reasonWithoutLostFlag), 'O dashboard subestima perdas reais.', 'Motivo de perda sincronizado com status'],
        ['Oportunidade parada', fmt(openOpps), 'Receita potencial envelhece sem dono claro.', 'Fila quente + follow-up D0/D1/D3'],
        ['Restrição sem FCA', restriction.current.key, 'Gargalo volta a se repetir se não vira execução.', 'Cadastrar FCA e tarefa com evidência']
      ]
    ));
  }

  function renderStatus(m) {
    set('statusKpis',
      kpi('Fonte ativa', 'GrowthPack', fmt(rows.length) + ' Lead IDs carregados') +
      kpi('Registros filtrados', fmt(m.total), 'escopo atual') +
      kpi('Health CRM', pct(m.health), fmt(m.dataIssues) + ' pontos de atenção') +
      kpi('Atualização visual', new Date().toLocaleTimeString('pt-BR'), 'horário local')
    );

    set('dataAuditTable', table(
      ['Auditoria', 'Volume', 'Impacto'],
      [
        ['Motivo sem LEAD PERDIDO', fmt(m.reasonWithoutLostFlag), 'Perdas reais somem do dashboard se usar só a flag'],
        ['Sem origem marcada', fmt(m.noOrigin), 'Atribuição de mídia e CAC ficam distorcidos'],
        ['SQL sem MQL', fmt(m.sqlWithoutMql), 'Etapa fora de ordem'],
        ['Oportunidade sem SQL', fmt(m.oppWithoutSql), 'Funil pulando qualificação'],
        ['Compra sem oportunidade', fmt(m.purchaseWithoutOpp), 'Venda sem progressão auditável'],
        ['Valor sem compra', fmt(m.valueWithoutPurchase), 'Receita ou potencial pode estar superestimado'],
        ['Compra com valor zero', fmt(m.purchaseZeroValue), 'Ticket médio fica distorcido']
      ]
    ));

    set('governanceTable', table(
      ['Bloco', 'Risco atual', 'Regra V4 ON'],
      [
        ['CRM', 'Status de perda inconsistente', 'Motivo preenchido deve gerar perda ou fila recuperável'],
        ['Mídia', 'Origem vazia em grande parte da base', 'UTM/origem obrigatória antes de análise de canal'],
        ['Comercial', 'Etapas fora de ordem', 'Progressão mínima auditável no funil'],
        ['Operação', 'Cobertura e viabilidade geram perda', 'Pré-check antes de distribuir para vendedor'],
        ['Gestão', 'FCA depende de decisão humana', 'Gestor cadastra o FCA e time executa task']
      ]
    ));

    set('architectureTable', table(
      ['Camada V4 ON', 'Saída no painel', 'Uso prático'],
      [
        ['Dados', 'Base GrowthPack consolidada', 'Leitura única por Lead ID'],
        ['Diagnóstico', 'KPIs, motivos, origem, funil e auditorias', 'Separar problema de lead, mídia, CRM e vendedor'],
        ['Decisão', 'Insights e prioridades por aba', 'Escolher o próximo ajuste operacional'],
        ['Tarefa', 'Tasks sugeridas e FCA manual', 'Transformar risco em execução'],
        ['Melhoria contínua', 'Metas, projeções e comparativos', 'Acompanhar se a correção muda o resultado']
      ]
    ));
  }

  function renderShell(m, restriction) {
    var current = restriction.current;
    var days = daysInSelection(filtered);
    var openOpps = Math.max(0, m.opportunity - m.purchase);
    var dateRange = (filters.start || '2026-06-01').slice(5) + ' a ' + (filters.end || '2026-06-18').slice(5);

    text('sourceLabel', 'Fonte: cache GrowthPack | ' + fmt(rows.length) + ' Lead IDs');
    text('sidebarRestriction', current.key);
    text('sidebarSupportText', current.action);

    set('heroStatCards',
      shellMetric('Receita registrada', money(m.value), 'Ticket médio ' + money(m.ticket), 'up') +
      shellMetric('Compras', fmt(m.purchase), pct(m.conversion) + ' compra / lead', 'up') +
      shellMetric('Lead IDs', fmt(m.total), fmt(m.mql) + ' MQL | ' + fmt(m.sql) + ' SQL', m.total >= 1000 ? 'warn' : 'up') +
      shellMetric('Health CRM', pct(m.health), fmt(m.dataIssues) + ' pontos de auditoria', m.health >= 0.7 ? 'up' : 'danger')
    );

    set('statusLine',
      '<span class="pill"><b>Leads:</b> ' + fmt(m.total) + '</span>' +
      '<span class="pill"><b>Compras:</b> ' + fmt(m.purchase) + ' (' + pct(m.conversion) + ')</span>' +
      '<span class="pill"><b>Valor:</b> ' + money(m.value) + '</span>' +
      '<span class="pill"><b>CRM:</b> ' + pct(m.health) + '</span>' +
      '<span class="pill"><b>Restrição:</b> ' + esc(current.key) + '</span>'
    );

    set('heroSignalGrid',
      signalCard('Janela ativa', dateRange, fmt(days) + ' dias úteis no filtro') +
      signalCard('Pipeline aberto', fmt(openOpps), 'oportunidades sem compra') +
      signalCard('Perdas mapeadas', fmt(m.loss), pct(m.lossRate) + ' dos leads filtrados') +
      signalCard('Modo operacional', 'V4 ON', 'dados → diagnóstico → decisão → tarefa')
    );

    set('heroRestrictionCard',
      '<div class="restriction-hero">' +
      '<div class="restriction-score"><div><span>Score da restrição</span><strong>' + Math.round(current.score) + '</strong></div>' + tag(current.kind, current.key) + '</div>' +
      '<div class="compact-grid">' +
      '<div class="rule-item"><b>Evidência</b><span>' + esc(current.evidence) + '</span></div>' +
      '<div class="rule-item"><b>Dono e prazo</b><span>' + esc(current.owner) + ' | ' + esc(current.due) + '</span></div>' +
      '</div></div>'
    );

    set('heroMiniStatus',
      '<div><b>' + fmt(m.loss) + '</b><span>motivos</span></div>' +
      '<div><b>' + fmt(m.noOrigin) + '</b><span>sem origem</span></div>' +
      '<div><b>' + money(m.ticket) + '</b><span>ticket</span></div>' +
      '<div><b>' + Math.round(current.score) + '</b><span>score restrição</span></div>'
    );
  }

  function renderTargets(m, keepInputs) {
    var targets = getTargets();
    var days = daysInSelection(filtered);
    var projectedLeads = div(m.total, days) * 30;
    var projectedPurchases = div(m.purchase, days) * 30;
    var projectedRevenue = div(m.value, days) * 30;

    if (!keepInputs) {
      set('targetInputs',
        targetInput('monthlyLeads', 'Meta mensal de leads', targets.monthlyLeads, 1) +
        targetInput('monthlyPurchases', 'Meta mensal de compras', targets.monthlyPurchases, 1) +
        targetInput('monthlyRevenue', 'Meta mensal de valor', targets.monthlyRevenue, 100) +
        targetInput('minConversionRate', 'Conversão mínima', targets.minConversionRate, .01) +
        targetInput('metaInvestment', 'Investimento Meta', targets.metaInvestment, 100) +
        targetInput('googleInvestment', 'Investimento Google', targets.googleInvestment, 100) +
        targetInput('minRoas', 'ROAS mínimo', targets.minRoas, .1) +
        targetInput('sellerDailyCapacity', 'Capacidade vendedor/dia', targets.sellerDailyCapacity, 1)
      );
    }

    var investment = number(targets.metaInvestment) + number(targets.googleInvestment);
    var cac = div(investment, m.purchase);
    var roas = div(m.value, investment);

    set('projectionKpis',
      kpi('Proj. leads', fmt(projectedLeads), '30 dias no ritmo atual') +
      kpi('Proj. compras', fmt(projectedPurchases), '30 dias no ritmo atual') +
      kpi('Proj. valor', money(projectedRevenue), '30 dias no ritmo atual') +
      kpi('CAC / ROAS', money(cac) + ' / ' + roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x', 'investimento editável')
    );

    set('monthPulse',
      '<div class="bar-list">' +
      bar('Atual do período', m.total, Math.max(1, targets.monthlyLeads, projectedLeads), fmt(m.total) + ' leads') +
      bar('Projeção 30 dias', projectedLeads, Math.max(1, targets.monthlyLeads, projectedLeads), fmt(projectedLeads) + ' leads') +
      bar('Meta mensal', targets.monthlyLeads, Math.max(1, targets.monthlyLeads, projectedLeads), fmt(targets.monthlyLeads) + ' leads') +
      bar('Compras projetadas', projectedPurchases, Math.max(1, targets.monthlyPurchases, projectedPurchases), fmt(projectedPurchases) + ' compras') +
      bar('Valor projetado', projectedRevenue, Math.max(1, targets.monthlyRevenue, projectedRevenue), money(projectedRevenue)) +
      '</div>'
    );

    set('monthGap',
      '<div class="compact-grid">' +
      '<div class="rule-item"><b>Gap de leads</b><span>' + fmt(Math.max(0, number(targets.monthlyLeads) - projectedLeads)) + ' leads faltando no ritmo atual.</span></div>' +
      '<div class="rule-item"><b>Gap de compras</b><span>' + fmt(Math.max(0, number(targets.monthlyPurchases) - projectedPurchases)) + ' compras faltando para fechar o mês.</span></div>' +
      '<div class="rule-item"><b>Gap de receita</b><span>' + money(Math.max(0, number(targets.monthlyRevenue) - projectedRevenue)) + ' abaixo da meta projetada.</span></div>' +
      '<div class="rule-item"><b>Leitura V4 ON</b><span>' + (projectedPurchases >= number(targets.monthlyPurchases) ? 'O ritmo atual bate compra; foco é proteger margem e CRM.' : 'A meta não fecha sozinha; a restrição atual precisa virar task com dono.') + '</span></div>' +
      '</div>'
    );

    set('targetProgress',
      progress('Leads', m.total, targets.monthlyLeads) +
      progress('Compras', m.purchase, targets.monthlyPurchases) +
      progress('Valor', m.value, targets.monthlyRevenue, true) +
      progress('Conversão mínima', m.conversion, targets.minConversionRate, false, true) +
      progressText('ROAS mínimo', roas, targets.minRoas, roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x', number(targets.minRoas).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'x')
    );

    set('forecastTable', table(
      ['Cenário', 'Leads', 'Compras', 'Conversão', 'Valor', 'CAC', 'ROAS'],
      [
        ['Conservador', fmt(projectedLeads * .85), fmt(projectedPurchases * .85), pct(m.conversion * .92), money(projectedRevenue * .85), money(div(investment, projectedPurchases * .85)), (div(projectedRevenue * .85, investment)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x'],
        ['Atual', fmt(projectedLeads), fmt(projectedPurchases), pct(m.conversion), money(projectedRevenue), money(div(investment, projectedPurchases)), (div(projectedRevenue, investment)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x'],
        ['Agressivo', fmt(projectedLeads * 1.15), fmt(projectedPurchases * 1.15), pct(Math.min(1, m.conversion * 1.08)), money(projectedRevenue * 1.15), money(div(investment, projectedPurchases * 1.15)), (div(projectedRevenue * 1.15, investment)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x']
      ]
    ));

    var windows = [
      ['01 a 07/06', '2026-06-01', '2026-06-07'],
      ['08 a 14/06', '2026-06-08', '2026-06-14'],
      ['15 a 18/06', '2026-06-15', '2026-06-18'],
      ['Filtro atual', filters.start || '0000-00-00', filters.end || '9999-99-99']
    ];
    set('periodCompare', table(
      ['Janela', 'Leads', 'Compras', 'Conversão', 'Motivos', 'Valor'],
      windows.map(function (windowRange) {
        var rangeRows = filtered.filter(function (row) { return row.date >= windowRange[1] && row.date <= windowRange[2]; });
        var data = metrics(rangeRows);
        return [windowRange[0], fmt(data.total), fmt(data.purchase), pct(data.conversion), fmt(data.loss), money(data.value)];
      })
    ));

    var months = groupBy(filtered, function (row) { return row.date.slice(0, 7); }).sort(function (a, b) { return a.key.localeCompare(b.key); });
    set('monthCompare', table(
      ['Mês', 'Leads', 'Compras', 'Conversão', 'Valor', 'Proj. leads', 'Proj. compras'],
      months.map(function (month) {
        var monthDays = daysInSelection(month.rows);
        return [month.key, fmt(month.m.total), fmt(month.m.purchase), pct(month.m.conversion), money(month.m.value), fmt(div(month.m.total, monthDays) * 30), fmt(div(month.m.purchase, monthDays) * 30)];
      })
    ));
  }

  function bind() {
    $$('.tab').forEach(function (button) {
      button.addEventListener('click', function () {
        activeTab = button.getAttribute('data-tab');
        $$('.tab').forEach(function (item) { item.classList.remove('active'); });
        button.classList.add('active');
        $$('.panel').forEach(function (panel) { panel.classList.remove('active'); });
        var panel = $(activeTab);
        if (panel) panel.classList.add('active');
        updateWorkspaceHead();
      });
    });

    ['fStart', 'fEnd', 'fSeller', 'fOrigin', 'fStage', 'fReason', 'fCategory'].forEach(function (id) {
      var node = $(id);
      if (node) node.addEventListener('change', function () { readFilters(); renderAll(); });
    });
    if ($('fSearch')) $('fSearch').addEventListener('input', function () { readFilters(); renderAll(); });
    if ($('applyFilters')) $('applyFilters').addEventListener('click', function () { readFilters(); renderAll(); toast('Filtro aplicado: ' + fmt(filtered.length) + ' Lead IDs'); });
    if ($('clearFilters')) $('clearFilters').addEventListener('click', function () { resetFilters(); toast('Filtros limpos'); });
    if ($('syncBtn')) $('syncBtn').addEventListener('click', function () { loadRows(); fillFilters(); renderAll(); toast('GrowthPack sincronizado: ' + fmt(rows.length) + ' Lead IDs'); });
    if ($('sourceBtn')) $('sourceBtn').addEventListener('click', function () { toast('Fonte ativa: cache local GrowthPack com ' + fmt(rows.length) + ' Lead IDs.'); });
    if ($('toggleFilters') && $('filtersPanel')) {
      $('toggleFilters').addEventListener('click', function () {
        $('filtersPanel').classList.toggle('collapsed');
        $('toggleFilters').classList.toggle('active');
      });
    }

    document.addEventListener('input', function (event) {
      var target = event.target && event.target.getAttribute('data-target');
      if (!target) return;
      var targets = getTargets();
      targets[target] = Number(event.target.value);
      saveTargets(targets);
      var m = metrics(filtered);
      renderTargets(m, true);
      renderPcp(m);
    });

    if ($('addFca')) {
      $('addFca').addEventListener('click', function () {
        var item = {
          title: ($('fcaTitle') && $('fcaTitle').value.trim()) || 'FCA sem título',
          owner: ($('fcaOwner') && $('fcaOwner').value.trim()) || 'Sem responsável',
          due: ($('fcaDue') && $('fcaDue').value) || 'Sem prazo',
          status: ($('fcaStatus') && $('fcaStatus').value) || 'Aberto',
          fact: ($('fcaFact') && $('fcaFact').value.trim()) || '',
          cause: ($('fcaCause') && $('fcaCause').value.trim()) || '',
          action: ($('fcaAction') && $('fcaAction').value.trim()) || '',
          createdAt: new Date().toISOString()
        };
        var items = getFcas();
        items.unshift(item);
        saveFcas(items);
        ['fcaTitle', 'fcaOwner', 'fcaDue', 'fcaFact', 'fcaCause', 'fcaAction'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        renderAll();
        toast('FCA cadastrado');
      });
    }

    document.addEventListener('click', function (event) {
      var index = event.target && event.target.getAttribute('data-remove-fca');
      if (index == null) return;
      var items = getFcas();
      items.splice(Number(index), 1);
      saveFcas(items);
      renderAll();
      toast('FCA removido');
    });
  }

  function boot() {
    try {
      loadRows();
      fillFilters();
      bind();
      updateWorkspaceHead();
      initIcons();
      startClock();
      renderAll();
      window.addEventListener('load', initIcons, { once: true });
      toast('ST1 BI V4 ON ativo: ' + fmt(rows.length) + ' Lead IDs');
    } catch (error) {
      showError(error);
    }
  }

  function renderAll() {
    applyFilters();
    updateWorkspaceHead();
    var m = metrics(filtered);
    var restriction = restrictionEngine(filtered, m);
    renderShell(m, restriction);
    renderOverview(m, restriction);
    renderRestriction(m, restriction);
    renderPcp(m);
    renderCommercial(m);
    renderMedia(m);
    renderService(m);
    renderRetention(m);
    renderLosses(m);
    renderTargets(m);
    renderFca(m);
    renderHandoff(m, restriction);
    renderStatus(m);
    window.ST1Dashboard = {
      status: 'ready',
      rows: rows,
      filtered: filtered,
      filters: filters,
      metrics: m,
      restriction: restriction,
      render: renderAll
    };
  }

  function toast(message) {
    var node = $('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { node.classList.remove('show'); }, 2800);
  }

  function resetFilters() {
    filters = {
      start: '2026-06-01',
      end: '2026-06-18',
      seller: 'all',
      origin: 'all',
      stage: 'all',
      reason: 'all',
      category: 'all',
      search: ''
    };
    fillFilters();
    renderAll();
  }

  function bind() {
    $$('.tab').forEach(function (button) {
      button.addEventListener('click', function () {
        activeTab = button.getAttribute('data-tab');
        $$('.tab').forEach(function (item) { item.classList.remove('active'); });
        button.classList.add('active');
        $$('.panel').forEach(function (panel) { panel.classList.remove('active'); });
        var panel = $(activeTab);
        if (panel) panel.classList.add('active');
        updateWorkspaceHead();
      });
    });

    ['fStart', 'fEnd', 'fSeller', 'fOrigin', 'fStage', 'fReason', 'fCategory'].forEach(function (id) {
      var node = $(id);
      if (node) node.addEventListener('change', function () { readFilters(); renderAll(); });
    });
    if ($('fSearch')) $('fSearch').addEventListener('input', function () { readFilters(); renderAll(); });
    if ($('applyFilters')) $('applyFilters').addEventListener('click', function () { readFilters(); renderAll(); toast('Filtro aplicado: ' + fmt(filtered.length) + ' Lead IDs'); });
    if ($('clearFilters')) $('clearFilters').addEventListener('click', function () { resetFilters(); toast('Filtros limpos'); });
    if ($('syncBtn')) $('syncBtn').addEventListener('click', function () { loadRows(); fillFilters(); renderAll(); toast('GrowthPack sincronizado: ' + fmt(rows.length) + ' Lead IDs'); });
    if ($('sourceBtn')) $('sourceBtn').addEventListener('click', function () { toast('Fonte ativa: cache local GrowthPack com ' + fmt(rows.length) + ' Lead IDs.'); });
    if ($('toggleFilters') && $('filtersPanel')) {
      $('toggleFilters').addEventListener('click', function () {
        $('filtersPanel').classList.toggle('collapsed');
        $('toggleFilters').classList.toggle('active');
      });
    }

    document.addEventListener('input', function (event) {
      var target = event.target && event.target.getAttribute('data-target');
      if (!target) return;
      var targets = getTargets();
      targets[target] = Number(event.target.value);
      saveTargets(targets);
      var m = metrics(filtered);
      renderTargets(m, true);
      renderPcp(m);
    });

    if ($('addFca')) {
      $('addFca').addEventListener('click', function () {
        var item = {
          title: ($('fcaTitle') && $('fcaTitle').value.trim()) || 'FCA sem título',
          owner: ($('fcaOwner') && $('fcaOwner').value.trim()) || 'Sem responsável',
          due: ($('fcaDue') && $('fcaDue').value) || 'Sem prazo',
          status: ($('fcaStatus') && $('fcaStatus').value) || 'Aberto',
          fact: ($('fcaFact') && $('fcaFact').value.trim()) || '',
          cause: ($('fcaCause') && $('fcaCause').value.trim()) || '',
          action: ($('fcaAction') && $('fcaAction').value.trim()) || '',
          createdAt: new Date().toISOString()
        };
        var items = getFcas();
        items.unshift(item);
        saveFcas(items);
        ['fcaTitle', 'fcaOwner', 'fcaDue', 'fcaFact', 'fcaCause', 'fcaAction'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        renderAll();
        toast('FCA cadastrado');
      });
    }

    document.addEventListener('click', function (event) {
      var index = event.target && event.target.getAttribute('data-remove-fca');
      if (index == null) return;
      var items = getFcas();
      items.splice(Number(index), 1);
      saveFcas(items);
      renderAll();
      toast('FCA removido');
    });
  }

  function startClock() {
    text('liveClock', new Date().toLocaleTimeString('pt-BR'));
    setInterval(function () {
      text('liveClock', new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
  }

  function showError(error) {
    console.error(error);
    document.body.insertAdjacentHTML('afterbegin', '<div class="error-banner">Erro no dashboard: ' + esc(error.message || error) + '</div>');
  }

  function boot() {
    try {
      loadRows();
      fillFilters();
      bind();
      updateWorkspaceHead();
      initIcons();
      startClock();
      renderAll();
      window.addEventListener('load', initIcons, { once: true });
      toast('ST1 BI V4 ON ativo: ' + fmt(rows.length) + ' Lead IDs');
    } catch (error) {
      showError(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
