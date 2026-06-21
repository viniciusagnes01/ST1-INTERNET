(function () {
  'use strict';

  var PANEL_ID = 'executive-deep-dive';

  function $(id) { return document.getElementById(id); }
  function n(value) { var parsed = Number(value || 0); return isFinite(parsed) ? parsed : 0; }
  function flag(value) {
    if (typeof value === 'number') return value >= 1 ? 1 : 0;
    var text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return 0;
    if (['1', '1.0', 'true', 'sim', 'yes', 'x'].indexOf(text) >= 0) return 1;
    return Number(text.replace(',', '.')) >= 1 ? 1 : 0;
  }
  function div(a, b) { return n(b) ? n(a) / n(b) : 0; }
  function fmt(value) { return Math.round(n(value)).toLocaleString('pt-BR'); }
  function money(value) { return n(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }
  function pct(value) {
    return ((isFinite(value) ? value : 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function set(id, html) { var node = $(id); if (node) node.innerHTML = html; }
  function text(id, value) { var node = $(id); if (node) node.textContent = value; }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function categoryFor(reason) {
    var r = clean(reason).toLowerCase();
    if (!r) return 'Sem motivo';
    if (r.indexOf('falta de interesse') >= 0 || r.indexOf('prioridade') >= 0) return 'Comercial / prioridade / follow-up';
    if (r.indexOf('atendimento') >= 0) return 'Qualificacao / atendimento';
    if (r.indexOf('sem rede') >= 0 || r.indexOf('rede em construcao') >= 0 || r.indexOf('rede em construção') >= 0) return 'Infraestrutura / cobertura';
    if (r.indexOf('sem viabilidade') >= 0) return 'Infraestrutura / viabilidade';
    if (r.indexOf('condominio') >= 0 || r.indexOf('condomínio') >= 0) return 'Infraestrutura / condominio';
    if (r.indexOf('cto') >= 0) return 'Infraestrutura / capacidade';
    if (r.indexOf('ja possui') >= 0 || r.indexOf('já possui') >= 0 || r.indexOf('concorrente') >= 0) return 'Base atendida / concorrencia';
    if (r.indexOf('kitnet') >= 0 || r.indexOf('condicoes') >= 0 || r.indexOf('condições') >= 0) return 'Preco / condicao / oferta';
    if (r.indexOf('orcamento') >= 0 || r.indexOf('orçamento') >= 0 || r.indexOf('instalacao') >= 0 || r.indexOf('instalação') >= 0) return 'Preco / condicao comercial';
    if (r.indexOf('desqualificado') >= 0) return 'Qualificacao / lead desqualificado';
    return 'Outros';
  }

  function normalize(row) {
    var reason = clean(row.lossReason || row['MOTIVO DE PERDA'] || '');
    var origin = clean(row.origin || '');
    if (!origin) {
      var meta = flag(row.metaAds || row['META ADS']);
      var google = flag(row.googleAds || row['GOOGLE ADS']);
      origin = meta && google ? 'Meta + Google' : meta ? 'Meta Ads' : google ? 'Google Ads' : 'Sem origem marcada';
    }
    var seller = clean(row.seller || row.RESPONSAVEL || row['Responsável'] || 'Sem responsavel');
    if (seller.toLowerCase() === 'rayane nunes') seller = 'Rayane Nunes';
    return {
      date: clean(row.date || row.Data || row.dateRaw || '').slice(0, 10),
      leadId: clean(row.leadId || row['Lead ID'] || '').replace(/\.0$/, ''),
      seller: seller || 'Sem responsavel',
      origin: origin,
      leadTag: flag(row.leadTag || row.LEAD),
      mql: flag(row.mql || row.MQL),
      sql: flag(row.sql || row.SQL),
      opportunity: flag(row.opportunity || row.OPORTUNIDADE || row.Oportunidade),
      purchase: flag(row.purchase || row.COMPRA || row.Compra),
      value: n(row.value || row.Valor),
      lossReason: reason,
      reasonCategory: reason ? categoryFor(reason) : 'Sem motivo',
      lostFlag: flag(row.lostFlag || row['LEAD PERDIDO'])
    };
  }

  function getRows() {
    if (window.ST1Dashboard && Array.isArray(window.ST1Dashboard.filtered) && window.ST1Dashboard.filtered.length) {
      return window.ST1Dashboard.filtered;
    }
    if (window.ST1Dashboard && Array.isArray(window.ST1Dashboard.rows) && window.ST1Dashboard.rows.length) {
      return window.ST1Dashboard.rows;
    }
    var source = Array.isArray(window.__GROWTHPACK_FALLBACK_DATA__) ? window.__GROWTHPACK_FALLBACK_DATA__ : [];
    var seen = {};
    return source.map(normalize).filter(function (row) {
      if (!row.date || !row.leadId || seen[row.leadId]) return false;
      seen[row.leadId] = true;
      return true;
    });
  }

  function metrics(list) {
    var m = {
      total: list.length, leadTag: 0, mql: 0, sql: 0, opportunity: 0, purchase: 0, value: 0,
      loss: 0, lostFlag: 0, noOrigin: 0, sqlWithoutMql: 0, oppWithoutSql: 0, purchaseWithoutOpp: 0,
      reasonWithoutLostFlag: 0, valueWithoutPurchase: 0, purchaseZeroValue: 0
    };
    list.forEach(function (row) {
      m.leadTag += row.leadTag;
      m.mql += row.mql;
      m.sql += row.sql;
      m.opportunity += row.opportunity;
      m.purchase += row.purchase;
      m.value += row.value;
      m.lostFlag += row.lostFlag;
      if (row.lossReason) m.loss += 1;
      if (row.origin === 'Sem origem marcada') m.noOrigin += 1;
      if (row.sql && !row.mql) m.sqlWithoutMql += 1;
      if (row.opportunity && !row.sql) m.oppWithoutSql += 1;
      if (row.purchase && !row.opportunity) m.purchaseWithoutOpp += 1;
      if (row.lossReason && !row.lostFlag) m.reasonWithoutLostFlag += 1;
      if (row.value && !row.purchase) m.valueWithoutPurchase += 1;
      if (row.purchase && !row.value) m.purchaseZeroValue += 1;
    });
    m.conversion = div(m.purchase, m.total);
    m.ticket = div(m.value, m.purchase);
    m.lossRate = div(m.loss, m.total);
    m.stageBreaks = m.sqlWithoutMql + m.oppWithoutSql + m.purchaseWithoutOpp;
    m.dataIssues = m.noOrigin + m.reasonWithoutLostFlag + m.stageBreaks + m.valueWithoutPurchase + m.purchaseZeroValue;
    m.crmHealth = Math.max(0, Math.min(1, 1 - (
      div(m.noOrigin, m.total) * 0.28 +
      div(m.reasonWithoutLostFlag, m.total) * 0.32 +
      div(m.stageBreaks, m.total) * 0.25 +
      div(m.purchaseZeroValue + m.valueWithoutPurchase, m.total) * 0.15
    )));
    return m;
  }

  function groupBy(list, keyFn) {
    var map = {};
    list.forEach(function (row) {
      var key = keyFn(row) || 'Sem valor';
      (map[key] = map[key] || []).push(row);
    });
    return Object.keys(map).map(function (key) { return { key: key, rows: map[key], m: metrics(map[key]) }; });
  }

  function countWhere(list, predicate) { return list.filter(predicate).length; }
  function countText(list, field, needle) {
    var search = needle.toLowerCase();
    return countWhere(list, function (row) { return String(row[field] || '').toLowerCase().indexOf(search) >= 0; });
  }

  function stageModel(m) {
    var proposal = Math.max(m.purchase, Math.round(m.opportunity * 0.92));
    var negotiation = Math.max(m.purchase, Math.round(m.opportunity * 0.72));
    return [
      { key: 'Lead', count: m.total, next: m.leadTag || m.mql, owner: 'Marketing / Bot', sla: 'entrada imediata' },
      { key: 'Conexao', count: m.leadTag || m.mql, next: m.mql, owner: 'SDR / Comercial', sla: '15min a 1h' },
      { key: 'MQL', count: m.mql, next: m.sql, owner: 'SDR', sla: '24h' },
      { key: 'SQL', count: m.sql, next: m.opportunity, owner: 'SDR / Closer', sla: '48h' },
      { key: 'Oportunidade', count: m.opportunity, next: proposal, owner: 'Comercial', sla: 'D0/D1' },
      { key: 'Proposta', count: proposal, next: negotiation, owner: 'Closer', sla: 'D0/D1/D3' },
      { key: 'Negociacao', count: negotiation, next: m.purchase, owner: 'Comercial', sla: 'ciclo alvo' },
      { key: 'Venda', count: m.purchase, next: m.purchase, owner: 'Comercial / CS', sla: 'imediato' }
    ].map(function (stage) {
      stage.wip = Math.max(0, stage.count - stage.next);
      stage.loss = div(stage.wip, stage.count);
      stage.throughput = div(stage.next, stage.count);
      return stage;
    });
  }

  function restrictionModel(rows, m) {
    var categories = groupBy(rows.filter(function (row) { return row.lossReason; }), function (row) { return row.reasonCategory; });
    function catVolume(text) {
      return categories.filter(function (item) { return item.key.indexOf(text) >= 0; }).reduce(function (sum, item) { return sum + item.m.total; }, 0);
    }
    var stages = stageModel(m);
    var topStage = stages.slice().sort(function (a, b) { return b.wip - a.wip; })[0] || { key: 'Sem gargalo', wip: 0 };
    var meta = metrics(rows.filter(function (row) { return row.origin === 'Meta Ads'; }));
    var google = metrics(rows.filter(function (row) { return row.origin === 'Google Ads'; }));
    var infra = catVolume('Infraestrutura');
    var commercial = catVolume('Comercial') + catVolume('Qualificacao');
    var price = catVolume('Preco');
    var candidates = [
      {
        name: 'CRM / governanca da verdade',
        score: div(m.noOrigin + m.reasonWithoutLostFlag + m.stageBreaks, Math.max(1, m.total)) * 100,
        evidence: fmt(m.noOrigin) + ' sem origem, ' + fmt(m.reasonWithoutLostFlag) + ' motivos sem status perdido e ' + fmt(m.stageBreaks) + ' quebras de etapa.',
        action: 'Travar regra de origem, status de perda e progressao minima antes de decidir verba.',
        owner: 'Sales Ops + CRM',
        horizon: '48h'
      },
      {
        name: 'PCP / WIP em ' + topStage.key,
        score: div(topStage.wip, Math.max(1, m.total)) * 100,
        evidence: fmt(topStage.wip) + ' registros acumulados em ' + topStage.key + '.',
        action: 'Criar fila P0 diaria e limitar WIP por vendedora/etapa.',
        owner: 'Gestao comercial',
        horizon: '24h'
      },
      {
        name: 'Infraestrutura / cobertura',
        score: div(infra, Math.max(1, m.loss)) * 100,
        evidence: fmt(infra) + ' perdas ligadas a cobertura, viabilidade, CTO, condominio ou rede.',
        action: 'Pre-check de cobertura antes da distribuicao humana.',
        owner: 'Operacao + CRM',
        horizon: '7 dias'
      },
      {
        name: 'Comercial / qualificacao e prioridade',
        score: div(commercial, Math.max(1, m.loss)) * 100,
        evidence: fmt(commercial) + ' perdas por prioridade, interesse, atendimento ou qualificacao.',
        action: 'Regua D0-D3, script de objeções e proxima acao obrigatoria.',
        owner: 'Coordenacao comercial',
        horizon: '7 dias'
      },
      {
        name: 'Qualidade de midia / intencao',
        score: (Math.max(0, google.conversion - meta.conversion) * 60) + (div(m.noOrigin, Math.max(1, m.total)) * 40),
        evidence: 'Google converte ' + pct(google.conversion) + ', Meta converte ' + pct(meta.conversion) + ' e origem vazia e ' + pct(div(m.noOrigin, m.total)) + '.',
        action: 'Separar budget por qualidade comercial, nao apenas CPL.',
        owner: 'Midia + GrowthOps',
        horizon: '72h'
      },
      {
        name: 'Preco / condicao / oferta',
        score: div(price, Math.max(1, m.loss)) * 100,
        evidence: fmt(price) + ' perdas por preco, kitnet, instalacao, condicao ou orcamento.',
        action: 'Revisar proposta, ancoragem de valor e tratamento por segmento.',
        owner: 'Estrategia + Comercial',
        horizon: '7 dias'
      }
    ];
    candidates.sort(function (a, b) { return b.score - a.score; });
    return { current: candidates[0], candidates: candidates, stages: stages, topStage: topStage };
  }

  function table(headers, body) {
    return '<table><thead><tr>' + headers.map(function (head) { return '<th>' + esc(head) + '</th>'; }).join('') + '</tr></thead><tbody>' + body.map(function (row) {
      return '<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  }

  function card(label, value, sub, tone) {
    return '<article class="glass kpi exec-kpi ' + esc(tone || '') + '"><span class="kpi-label">' + esc(label) + '</span><span class="kpi-value">' + value + '</span><span class="kpi-sub">' + sub + '</span></article>';
  }

  function section(title, copy, body) {
    return '<article class="card glass exec-block"><div class="exec-block-head"><div><h3>' + esc(title) + '</h3><p>' + esc(copy) + '</p></div></div>' + body + '</article>';
  }

  function renderPanel() {
    var rows = getRows();
    var m = metrics(rows);
    var model = restrictionModel(rows, m);
    var origins = groupBy(rows, function (row) { return row.origin; }).sort(function (a, b) { return b.m.total - a.m.total; });
    var sellers = groupBy(rows, function (row) { return row.seller; }).sort(function (a, b) { return b.m.purchase - a.m.purchase; });
    var reasons = groupBy(rows.filter(function (row) { return row.lossReason; }), function (row) { return row.lossReason; }).sort(function (a, b) { return b.m.total - a.m.total; });
    var categories = groupBy(rows.filter(function (row) { return row.lossReason; }), function (row) { return row.reasonCategory; }).sort(function (a, b) { return b.m.total - a.m.total; });
    var days = Math.max(1, groupBy(rows, function (row) { return row.date; }).length);
    var projectedPurchases = div(m.purchase, days) * 30;
    var projectedValue = div(m.value, days) * 30;
    var conservativePurchases = projectedPurchases * 0.85;
    var tocGain = Math.round((m.noOrigin * 0.025) + ((m.sql - m.opportunity) * 0.12) + (model.topStage.wip * 0.08));
    var tocPurchases = projectedPurchases + tocGain;
    var tocValue = tocPurchases * (m.ticket || 1);
    var dataConfidence = Math.round(Math.max(30, Math.min(92, (m.crmHealth * 100) - div(m.noOrigin, m.total) * 20 + 15)));

    set('executiveDeepDiveKpis',
      card('Veredito', esc(model.current.name), 'restricao dominante do sistema', 'danger') +
      card('Lead IDs', fmt(m.total), fmt(m.purchase) + ' compras | ' + pct(m.conversion), 'ok') +
      card('Divida de governanca', fmt(m.dataIssues), 'pontos que distorcem decisao', 'danger') +
      card('Origem ausente', fmt(m.noOrigin), pct(div(m.noOrigin, m.total)) + ' da base', 'warn') +
      card('WIP dominante', fmt(model.topStage.wip), model.topStage.key + ' parado', 'warn') +
      card('Confianca analitica', fmt(dataConfidence), dataConfidence >= 70 ? 'media/alta' : 'media com restricoes', dataConfidence >= 70 ? 'ok' : 'warn')
    );

    set('executiveDeepDiveBody',
      '<div class="grid-2 split-grid split-grid--wide">' +
      section('1. Veredito executivo', 'A decisao nao e escalar volume antes de corrigir a verdade operacional.',
        '<div class="exec-verdict"><strong>A ST1 tem compra acontecendo; a restricao esta na governanca do funil e na separacao entre cobertura, midia e execucao comercial.</strong>' +
        '<p>O painel atual ja mostra receita, funil, PCP e FCA. A melhoria executiva e transformar isso em um motor de decisao: identificar a restricao, explorar sem investimento adicional, subordinar as demais acoes, elevar somente depois e repetir semanalmente.</p>' +
        '<p><b>Regra de ouro:</b> sem origem, sem status de perda e sem progressao coerente, nenhuma decisao de budget deve ser tratada como conclusiva.</p></div>') +
      section('2. Goldratt / TOC aplicado', 'Cinco passos de focalizacao convertidos em rotina de cockpit.',
        table(['Passo', 'Aplicacao na ST1', 'Decisao pratica'], [
          ['Identificar', esc(model.current.name), 'Assumir uma restricao por ciclo semanal'],
          ['Explorar', 'Usar dados atuais, SLA, tags e fila quente', 'Corrigir CRM, origem e status antes de adicionar complexidade'],
          ['Subordinar', 'Mídia, vendedor e automação obedecem a restrição', 'Nao otimizar CPL se o gargalo e cobertura/CRM'],
          ['Elevar', 'Adicionar capacidade, automação ou pre-check', 'Somente apos medir baseline corrigido'],
          ['Repetir', 'Quando o gargalo mudar, recalcular prioridade', 'Novo FCA se a trava persistir por 2 ciclos']
        ])) +
      '</div>' +

      '<div class="grid-2 split-grid split-grid--wide">' +
      section('3. Numeros que mandam na decisao', 'O painel passa a separar volume, passagem e qualidade.',
        table(['Metrica', 'Atual', 'Leitura executiva'], [
          ['Lead -> MQL', pct(div(m.mql, m.total)), fmt(m.mql) + ' de ' + fmt(m.total) + ' viraram MQL'],
          ['MQL -> SQL', pct(div(m.sql, m.mql)), 'qualificacao para vendas parece forte, mas depende de etapa coerente'],
          ['SQL -> Oportunidade', pct(div(m.opportunity, m.sql)), fmt(Math.max(0, m.sql - m.opportunity)) + ' SQLs ainda nao viraram oportunidade'],
          ['Oportunidade -> Compra', pct(div(m.purchase, m.opportunity)), 'muito alto; precisa validar se compra esta marcada como etapa ou evento final'],
          ['Perda operacional', pct(m.lossRate), fmt(m.loss) + ' motivos registrados'],
          ['Health CRM ajustado', pct(m.crmHealth), fmt(m.dataIssues) + ' inconsistencias/auditorias']
        ])) +
      section('4. Restriction scorecard', 'Ranking de gargalos com evidencia, dono e prazo.',
        table(['Restricao', 'Score', 'Evidencia', 'Acao', 'Dono / prazo'], model.candidates.map(function (item) {
          return [esc(item.name), fmt(item.score), esc(item.evidence), esc(item.action), esc(item.owner + ' | ' + item.horizon)];
        }))) +
      '</div>' +

      '<div class="grid-2">' +
      section('5. PCP comercial: WIP e fila', 'O que esta parado consome capacidade e reduz velocidade.',
        table(['Etapa', 'Entrada', 'Saida', 'WIP', 'Throughput', 'Dono'], model.stages.map(function (stage) {
          return [esc(stage.key), fmt(stage.count), fmt(stage.next), fmt(stage.wip), pct(stage.throughput), esc(stage.owner)];
        }))) +
      section('6. Origem e qualidade comercial', 'Canal deve ser lido por compra e motivo, nao por volume puro.',
        table(['Origem', 'Leads', 'Compras', 'Conv.', 'Leitura'], origins.map(function (item) {
          var reading = item.key === 'Sem origem marcada' ? 'atribuição cega' : item.key === 'Google Ads' ? 'alta intenção aparente' : item.key === 'Meta Ads' ? 'volume com menor conversao' : 'amostra pequena';
          return [esc(item.key), fmt(item.m.total), fmt(item.m.purchase), pct(item.m.conversion), reading];
        }))) +
      '</div>' +

      '<div class="grid-2 split-grid split-grid--wide">' +
      section('7. Perdas: taxonomia executiva', 'Motivos viram hipoteses de restricao, nao apenas relatorio.',
        table(['Categoria', 'Volume', 'Peso nas perdas', 'Tratamento'], categories.slice(0, 8).map(function (item) {
          var treatment = item.key.indexOf('Infraestrutura') >= 0 ? 'pre-check antes do vendedor' : item.key.indexOf('Comercial') >= 0 ? 'regua D0-D3 e proxima acao' : item.key.indexOf('Preco') >= 0 ? 'revisar oferta e objeções' : 'auditar e padronizar';
          return [esc(item.key), fmt(item.m.total), pct(div(item.m.total, m.loss)), treatment];
        }))) +
      section('8. Ranking comercial sem vaidade', 'Vendedora deve ser avaliada por volume, conversao, mix e qualidade de carteira.',
        table(['Vendedora', 'Leads', 'MQL', 'SQL', 'Opp', 'Compras', 'Conv.', 'Perdas'], sellers.map(function (item) {
          return [esc(item.key), fmt(item.m.total), fmt(item.m.mql), fmt(item.m.sql), fmt(item.m.opportunity), fmt(item.m.purchase), pct(item.m.conversion), fmt(item.m.loss)];
        }))) +
      '</div>' +

      '<div class="grid-2">' +
      section('9. Cenarios 30 dias', 'Forecast simples usando ritmo atual e alavanca TOC.',
        table(['Cenario', 'Compras proj.', 'Valor proj.', 'Premissa'], [
          ['Conservador', fmt(conservativePurchases), money(conservativePurchases * (m.ticket || 1)), 'ritmo cai 15% e CRM segue ruidoso'],
          ['Atual', fmt(projectedPurchases), money(projectedValue), 'mantem media diaria da janela atual'],
          ['TOC 30D', fmt(tocPurchases), money(tocValue), 'corrige origem/status e reduz WIP principal sem aumentar verba']
        ])) +
      section('10. Killer assumptions', 'Hipoteses que quebram a tese se forem falsas.',
        table(['Hipotese critica', 'Como validar', 'Sinal de alerta'], [
          ['Compra no GrowthPack e venda real, nao apenas etapa', 'amostrar 30 compras e conciliar com CRM/financeiro', 'compra sem valor ou sem oportunidade'],
          ['Origem ausente nao esta enviesando Meta/Google', 'obrigar origem por 7 dias e comparar conversao', 'Sem origem continua acima de 20%'],
          ['Perda por infraestrutura pode ser bloqueada antes do humano', 'pre-check de cobertura no bot/CRM', 'perda por cobertura nao cai em 14 dias'],
          ['Time consegue executar fila P0 diariamente', 'check de oportunidades sem compra todo dia', 'WIP em SQL/Lead continua subindo']
        ])) +
      '</div>' +

      section('11. Plano de execucao 7 / 14 / 30 dias', 'Transformar diagnostico em rotina V4 ON com dono, prazo e evidencia.',
        table(['Horizonte', 'Entrega', 'Dono sugerido', 'Evidencia esperada'], [
          ['7 dias', 'Origem, status de perda e progressao minima obrigatorios', 'CRM / Sales Ops', 'queda de origem vazia e motivo sem flag'],
          ['7 dias', 'Fila P0: SQL sem opp, opp sem compra e perda recuperavel', 'Gestao comercial', 'lista diaria com dono e proxima acao'],
          ['14 dias', 'Pre-check de cobertura/viabilidade antes da distribuicao humana', 'Operacao + CRM', 'queda em perdas de infraestrutura'],
          ['14 dias', 'Comparar Meta x Google por compra e motivo de perda', 'Midia + GrowthOps', 'budget subordinado a qualidade comercial'],
          ['30 dias', 'FCA recorrente para as 2 restricoes que persistirem', 'Gestor V4', 'Fato, causa, acao, dono, prazo e evidencia'],
          ['30 dias', 'Ritual semanal de restricao no check-in', 'GrowthOps', 'restricao anterior fechada ou elevada']
        ])) +

      section('12. Guardrails do cockpit executivo', 'Faixas que devem disparar decisao, nao apenas observacao.',
        table(['Indicador', 'Limite', 'Acao se sair do limite'], [
          ['Origem ausente', '<= 20% em 14 dias; alvo <= 10%', 'bloquear diagnostico de CAC por canal ate corrigir'],
          ['Motivo sem status perdido', '<= 5%', 'corrigir automacao/status e revisar CRM'],
          ['WIP em Lead/Conexao', 'queda semanal obrigatoria', 'redistribuir fila e revisar SLA'],
          ['Google vs Meta', 'comparar por compra e perda, nao CPL', 'subordinar budget a qualidade'],
          ['Infraestrutura nas perdas', 'queda apos pre-check', 'automatizar cobertura antes do vendedor'],
          ['FCA aberta sem dono/prazo', '0 tolerancia', 'nao sair do check-in sem responsavel']
        ]))
    );
  }

  function injectStyle() {
    if ($('executive-deep-dive-style')) return;
    var style = document.createElement('style');
    style.id = 'executive-deep-dive-style';
    style.textContent = [
      '.exec-kpi.danger{border-color:rgba(255,91,0,.45)}',
      '.exec-kpi.warn{border-color:rgba(255,190,80,.36)}',
      '.exec-kpi.ok{border-color:rgba(37,217,255,.32)}',
      '.exec-block{overflow:hidden}',
      '.exec-block-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:16px}',
      '.exec-block-head p{margin:.25rem 0 0;color:var(--muted)}',
      '.exec-verdict strong{display:block;font-size:1.08rem;line-height:1.45;margin-bottom:.75rem}',
      '.exec-verdict p{color:var(--muted);line-height:1.6;margin:.5rem 0}',
      '#executiveDeepDiveBody table td:nth-child(3){min-width:180px}',
      '#executive-deep-dive .section-head p{max-width:920px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function injectTabAndPanel() {
    if ($(PANEL_ID)) return;
    injectStyle();
    var nav = document.querySelector('.sidebar-group .sidebar-nav');
    if (nav) {
      var button = document.createElement('button');
      button.className = 'tab side-tab';
      button.setAttribute('data-tab', PANEL_ID);
      button.type = 'button';
      button.innerHTML = '<span class="tab-icon">◆</span><span class="tab-copy"><strong>Estratégia</strong><small>Deep dive executivo</small></span>';
      nav.appendChild(button);
      button.addEventListener('click', activateExecutivePanel);
    }

    var main = document.querySelector('.workspace-main');
    if (main) {
      var panel = document.createElement('section');
      panel.className = 'panel';
      panel.id = PANEL_ID;
      panel.innerHTML = '<div class="section-head"><div><h2>Estratégia Executiva Profunda</h2><p>Analise de restricao, PCP, funil, risco e plano de execucao usando Goldratt/TOC, GrowthOps e Modo V4 ON.</p></div></div><div class="kpi-grid" id="executiveDeepDiveKpis"></div><div id="executiveDeepDiveBody"></div>';
      main.appendChild(panel);
    }
    renderPanel();
  }

  function activateExecutivePanel() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (node) { node.classList.remove('active'); });
    Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (node) { node.classList.remove('active'); });
    var tab = document.querySelector('[data-tab="' + PANEL_ID + '"]');
    if (tab) tab.classList.add('active');
    var panel = $(PANEL_ID);
    if (panel) panel.classList.add('active');
    text('activeSectionEyebrow', 'Cockpit / Conselho Executivo');
    text('activeSectionTitle', 'Estratégia Executiva Profunda');
    text('activeSectionCopy', 'Goldratt, TOC, PCP, funil, risco e execucao em uma unica decisao.');
    text('heroKicker', 'Estrategista Executivo Profundo');
    text('heroTitle', 'A decisao certa antes de escalar volume');
    text('heroCopy', 'O cockpit agora separa verdade dos dados, restricao do sistema, alavanca operacional e plano de execucao.');
    renderPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTabAndPanel);
  } else {
    injectTabAndPanel();
  }
  window.addEventListener('st1-dashboard-rendered', renderPanel);
})();
