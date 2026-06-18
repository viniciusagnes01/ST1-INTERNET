(function(){
  const CONFIG = window.DASHBOARD_CONFIG || {};
  const FALLBACK = window.__GROWTHPACK_FALLBACK_DATA__ || [];
  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  let state = {
    raw: [],
    records: [],
    filtered: [],
    activeTab: 'geral',
    sourceStatus: 'Fonte: fallback local',
    filters: {
      start: (CONFIG.defaultPeriod && CONFIG.defaultPeriod.start) || '2026-06-01',
      end: (CONFIG.defaultPeriod && CONFIG.defaultPeriod.end) || '2026-06-18',
      seller: 'all',
      origin: 'all',
      reason: 'all',
      stage: 'all'
    },
    targets: loadTargets()
  };

  function loadTargets(){
    const defaults = (CONFIG && CONFIG.targets) || { monthlyLeads: 2800, monthlyPurchases: 680, monthlyRevenue: 76000, minConversionRate: .25, minDataQuality: .85 };
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem('st1Targets') || '{}')); }
    catch(e){ return Object.assign({}, defaults); }
  }
  function saveTargets(){ localStorage.setItem('st1Targets', JSON.stringify(state.targets)); }
  function fmt(v){ return Math.round(Number(v || 0)).toLocaleString('pt-BR'); }
  function money(v){ return Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 }); }
  function pct(v,d=1){ if(!isFinite(v)) v = 0; return (Number(v||0)*100).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}) + '%'; }
  function div(a,b){ return Number(b || 0) ? Number(a || 0) / Number(b) : 0; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function bool(v){ if(typeof v === 'number') return v >= 1 ? 1 : 0; const s = String(v == null ? '' : v).trim().toLowerCase(); if(!s) return 0; if(['1','1.0','true','sim','yes','x'].includes(s)) return 1; const n = Number(s.replace(',','.')); return isFinite(n) && n >= 1 ? 1 : 0; }
  function num(v){ if(typeof v === 'number') return v; const n = Number(String(v == null ? '' : v).replace(/R\$|\s/g,'').replace(/\./g,'').replace(',','.')); return isFinite(n) ? n : 0; }
  function leadId(v){ const s = String(v == null ? '' : v).trim(); return s ? s.replace(/\.0$/,'') : ''; }
  function normDate(v){
    const s = String(v == null ? '' : v).trim(); if(!s) return '';
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m){ let y=m[1], mo=Number(m[2]), d=Number(m[3]); if(CONFIG.growthPack && CONFIG.growthPack.swapIsoDayMonthWhenAmbiguous && mo<=12 && d<=12){ const t=mo; mo=d; d=t; } return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
    const dt = new Date(s); return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0,10);
  }
  function originOf(r){ if(bool(r.metaAds) && bool(r.googleAds)) return 'Meta + Google'; if(bool(r.metaAds)) return 'Meta Ads'; if(bool(r.googleAds)) return 'Google Ads'; return 'Sem origem marcada'; }
  function reasonCategory(reason){ const r = String(reason||'').toLowerCase(); if(!r) return 'Sem motivo'; if(r.includes('falta de interesse') || r.includes('prioridade')) return 'Comercial / prioridade / follow-up'; if(r.includes('atendimento não comercial')) return 'Qualificação / atendimento'; if(r.includes('sem rede') || r.includes('rede em construção')) return 'Infraestrutura / cobertura'; if(r.includes('sem viabilidade')) return 'Infraestrutura / viabilidade'; if(r.includes('condomínio')) return 'Infraestrutura / condomínio'; if(r.includes('cto')) return 'Infraestrutura / capacidade'; if(r.includes('já possui') || r.includes('concorrente')) return 'Base atendida / concorrência'; if(r.includes('kitnet') || r.includes('condições')) return 'Preço / condição / oferta'; if(r.includes('orçamento') || r.includes('tempo de instalação')) return 'Preço / condição comercial'; if(r.includes('desqualificado')) return 'Qualificação / lead desqualificado'; return 'Outros'; }

  function normalizeRecord(r){
    const nr = {
      date: r.date ? normDate(r.date) : normDate(r.Data || r.dateRaw),
      dateRaw: r.dateRaw || r.Data || r.date || '',
      leadId: leadId(r.leadId || r['Lead ID'] || r.id),
      name: r.name || r.Nome || '',
      value: num(r.value != null ? r.value : r.Valor),
      leadTag: bool(r.leadTag != null ? r.leadTag : r.LEAD),
      mql: bool(r.mql != null ? r.mql : r.MQL),
      sql: bool(r.sql != null ? r.sql : r.SQL),
      opportunity: bool(r.opportunity != null ? r.opportunity : r.OPORTUNIDADE),
      purchase: bool(r.purchase != null ? r.purchase : r.COMPRA),
      lostFlag: bool(r.lostFlag != null ? r.lostFlag : r['LEAD PERDIDO']),
      metaAds: bool(r.metaAds != null ? r.metaAds : r['META ADS']),
      googleAds: bool(r.googleAds != null ? r.googleAds : r['GOOGLE ADS']),
      seller: String(r.seller || r.RESPONSAVEL || 'Sem responsável').trim() || 'Sem responsável',
      lossReason: String(r.lossReason || r['MOTIVO DE PERDA'] || '').trim(),
      tags: r.tags || r.TAGS || ''
    };
    nr.origin = r.origin || originOf(nr);
    nr.reasonCategory = r.reasonCategory || reasonCategory(nr.lossReason);
    return nr;
  }

  function uniqueByLead(rows){
    const map = new Map();
    rows.forEach(r => {
      if(!r.leadId) return;
      const cur = map.get(r.leadId);
      if(!cur){ map.set(r.leadId, Object.assign({}, r)); return; }
      ['leadTag','mql','sql','opportunity','purchase','lostFlag','metaAds','googleAds'].forEach(k => cur[k] = Math.max(Number(cur[k]||0), Number(r[k]||0)));
      cur.value = Math.max(Number(cur.value||0), Number(r.value||0));
      cur.lossReason = cur.lossReason || r.lossReason;
      cur.reasonCategory = reasonCategory(cur.lossReason);
      cur.origin = originOf(cur);
      if(r.date > cur.date) cur.date = r.date;
      if(r.seller && r.seller !== 'Sem responsável') cur.seller = r.seller;
    });
    return Array.from(map.values());
  }

  function parseCsv(text){
    const out = []; let row = [], field = '', inside = false;
    for(let i=0;i<text.length;i++){
      const c = text[i], n = text[i+1];
      if(inside){ if(c==='"' && n==='"'){ field+='"'; i++; } else if(c==='"') inside=false; else field+=c; }
      else { if(c==='"') inside=true; else if(c===','){ row.push(field); field=''; } else if(c==='\n'){ row.push(field); out.push(row); row=[]; field=''; } else if(c !== '\r') field += c; }
    }
    if(field || row.length){ row.push(field); out.push(row); }
    const headers = out.shift() || [];
    return out.filter(r => r.some(v => String(v).trim())).map(r => { const obj = {}; headers.forEach((h,i) => obj[h] = r[i] || ''); return obj; });
  }
  function rowFromCsv(row){
    const l = {}; Object.keys(row).forEach(k => l[k.trim().toLowerCase()] = row[k]);
    const get = (...keys) => keys.map(k => l[k.toLowerCase()]).find(v => v !== undefined) || '';
    return normalizeRecord({ date: get('Data'), leadId: get('Lead ID'), name: get('Nome'), value: get('Valor'), leadTag: get('LEAD'), mql: get('MQL'), sql: get('SQL'), opportunity: get('OPORTUNIDADE'), purchase: get('COMPRA'), lostFlag: get('LEAD PERDIDO'), metaAds: get('META ADS'), googleAds: get('GOOGLE ADS'), seller: get('RESPONSAVEL'), lossReason: get('MOTIVO DE PERDA'), tags: get('TAGS') });
  }

  async function loadData(){
    const override = localStorage.getItem('st1GrowthpackCsvUrl') || localStorage.getItem('st1CsvUrl');
    if(override){
      try{
        const res = await fetch(override, { cache:'no-store' });
        if(!res.ok) throw new Error('HTTP ' + res.status);
        const rows = parseCsv(await res.text()).map(rowFromCsv).filter(r => r.leadId && r.date);
        if(rows.length){ state.sourceStatus = 'Fonte dinâmica: CSV/API configurado'; return rows; }
      } catch(e){ console.warn(e); toast('Falha na fonte dinâmica. Usando fallback local.'); }
    }
    if(FALLBACK.length){ state.sourceStatus = 'Fonte: fallback local embutido'; return FALLBACK; }
    state.sourceStatus = 'Fonte: sem dados';
    return [];
  }

  function compute(rows){
    const total = rows.length;
    const m = { total, leadTag:sum(rows,'leadTag'), mql:sum(rows,'mql'), sql:sum(rows,'sql'), opportunity:sum(rows,'opportunity'), purchase:sum(rows,'purchase'), lostFlag:sum(rows,'lostFlag'), value:rows.reduce((a,r)=>a+Number(r.value||0),0), lossReason:rows.filter(r=>r.lossReason).length, noOrigin:rows.filter(r=>r.origin==='Sem origem marcada').length, noSeller:rows.filter(r=>!r.seller || r.seller==='Sem responsável').length, sqlWithoutMql:rows.filter(r=>r.sql&&!r.mql).length, oppWithoutSql:rows.filter(r=>r.opportunity&&!r.sql).length, purchaseWithoutOpp:rows.filter(r=>r.purchase&&!r.opportunity).length, reasonWithoutLostFlag:rows.filter(r=>r.lossReason&&!r.lostFlag).length, valueWithoutPurchase:rows.filter(r=>r.value>0&&!r.purchase).length, purchaseZeroValue:rows.filter(r=>r.purchase&&!r.value).length };
    m.conversion = div(m.purchase,total); m.ticket = div(m.value,m.purchase); m.lossRate = div(m.lossReason,total);
    const penalties = div(m.reasonWithoutLostFlag,total)*.25 + div(m.noOrigin,total)*.25 + div(m.sqlWithoutMql+m.oppWithoutSql+m.purchaseWithoutOpp,total)*.25 + div(m.noSeller+m.valueWithoutPurchase+m.purchaseZeroValue,total)*.25;
    m.dataQuality = Math.max(0, Math.min(1, 1 - penalties));
    return m;
  }
  function sum(a,k){ return a.reduce((x,r)=>x+Number(r[k]||0),0); }
  function group(rows, fn){ const map = new Map(); rows.forEach(r => { const k = fn(r); if(!map.has(k)) map.set(k, []); map.get(k).push(r); }); return map; }
  const byDate = rows => Array.from(group(rows,r=>r.date).entries()).sort(([a],[b])=>a.localeCompare(b)).map(([date, rows]) => ({ date, rows, m:compute(rows) }));
  const bySeller = rows => Array.from(group(rows,r=>r.seller).entries()).map(([seller,rows])=>({seller,rows,m:compute(rows)})).sort((a,b)=>b.m.conversion-a.m.conversion);
  const byOrigin = rows => Array.from(group(rows,r=>r.origin).entries()).map(([origin,rows])=>({origin,rows,m:compute(rows)})).sort((a,b)=>b.m.purchase-a.m.purchase);
  const topReasons = (rows,n=12) => Array.from(group(rows.filter(r=>r.lossReason),r=>r.lossReason).entries()).map(([reason,rs])=>({reason,count:rs.length,pct:div(rs.length,rows.filter(r=>r.lossReason).length)})).sort((a,b)=>b.count-a.count).slice(0,n);

  function applyFilters(){
    const f = state.filters;
    state.filtered = uniqueByLead(state.records.filter(r => {
      if(f.start && r.date < f.start) return false;
      if(f.end && r.date > f.end) return false;
      if(f.seller !== 'all' && r.seller !== f.seller) return false;
      if(f.origin !== 'all' && r.origin !== f.origin) return false;
      if(f.reason !== 'all' && r.lossReason !== f.reason) return false;
      if(f.stage === 'mql' && !r.mql) return false;
      if(f.stage === 'sql' && !r.sql) return false;
      if(f.stage === 'opportunity' && !r.opportunity) return false;
      if(f.stage === 'purchase' && !r.purchase) return false;
      if(f.stage === 'lostReason' && !r.lossReason) return false;
      return true;
    }));
  }

  function render(){
    applyFilters();
    $('sourceStatus').textContent = state.sourceStatus;
    $('periodStatus').textContent = pt(state.filters.start) + ' a ' + pt(state.filters.end);
    $('recordStatus').textContent = fmt(state.filtered.length) + ' Lead IDs filtrados';
    renderCommand();
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('panel-' + state.activeTab).classList.add('active');
    if(state.activeTab === 'geral') renderGeral();
    if(state.activeTab === 'midia') renderMidia();
    if(state.activeTab === 'crm') renderCrm();
    if(state.activeTab === 'meta') renderMeta();
    reveal();
  }
  function renderCommand(){
    const m = compute(state.filtered);
    $('commandMetrics').innerHTML = [metric('Lead IDs',fmt(m.total),'topo real do funil',100),metric('Compras',fmt(m.purchase),pct(m.conversion)+' compra/lead',Math.min(100,div(m.conversion,state.targets.minConversionRate)*100)),metric('Valor',money(m.value),'ticket '+money(m.ticket),74),metric('Qualidade CRM',pct(m.dataQuality),'score de governança',m.dataQuality*100)].join('');
    $('globalHealth').innerHTML = m.dataQuality >= .86 && m.conversion >= state.targets.minConversionRate ? '<span class="badge cyan">Operação saudável</span>' : m.dataQuality < .70 ? '<span class="badge danger">CRM em risco</span>' : '<span class="badge warn">Atenção operacional</span>';
  }
  function metric(label,value,sub,w){ return `<div class="command-metric"><span class="label">${label}</span><span class="command-number">${value}</span><small>${sub}</small><div class="mini-progress"><i style="--w:${Math.max(3,Math.min(100,w))}%"></i></div></div>`; }
  function kpi(icon,label,value,sub,kind){ return `<article class="glass kpi-card reveal"><div class="kpi-top"><span class="kpi-label">${label}</span><div class="kpi-icon">${icon}</div></div><span class="kpi-value">${value}</span><span class="kpi-sub">${sub}</span><div class="mini-progress"><i style="--w:${kind==='danger'?46:kind==='warn'?62:86}%"></i></div></article>`; }

  function renderGeral(){ const m=compute(state.filtered); $('geralKpis').innerHTML=[kpi('⚡','Lead IDs',fmt(m.total),fmt(m.leadTag)+' com tag LEAD'),kpi('🧭','MQL → SQL',pct(div(m.sql,m.mql)),fmt(m.mql)+' MQL / '+fmt(m.sql)+' SQL'),kpi('🛒','Compras',fmt(m.purchase),pct(m.conversion)+' compra / Lead'),kpi('🧾','Motivos de perda',fmt(m.lossReason),pct(m.lossRate)+' dos Lead IDs','danger')].join(''); $('dailyChart').innerHTML=dailyBars(byDate(state.filtered)); $('funnelOverview').innerHTML=funnel(m); $('dailyTable').innerHTML=dailyTable(byDate(state.filtered)); $('generalInsights').innerHTML=cards([['Topo correto','O painel usa Lead ID único como entrada. Isso evita subcontagem de '+fmt(Math.max(0,m.total-m.leadTag))+' registros no filtro atual.'],['Leitura comercial',fmt(m.purchase)+' compras em '+fmt(m.total)+' Lead IDs. Conversão final de '+pct(m.conversion)+'.'],['Risco de governança',fmt(m.reasonWithoutLostFlag)+' motivos de perda não acompanham a flag LEAD PERDIDO.']]); }
  function renderMidia(){ const o=byOrigin(state.filtered),m=compute(state.filtered); $('midiaKpis').innerHTML=[kpi('📡','Sem origem',fmt(m.noOrigin),pct(div(m.noOrigin,m.total))+' dos leads','danger'),kpi('🟧','Meta Ads',fmt((o.find(x=>x.origin==='Meta Ads')||{m:{total:0}}).m.total),'volume filtrado'),kpi('🔎','Google Ads',fmt((o.find(x=>x.origin==='Google Ads')||{m:{total:0}}).m.total),'intenção ativa'),kpi('💰','Valor total',money(m.value),fmt(m.purchase)+' compras')].join(''); $('originChart').innerHTML=hBars(o.map(x=>({label:x.origin,value:x.m.total,sub:pct(x.m.conversion)+' compra/lead'}))); $('originConversionChart').innerHTML=hBars(o.map(x=>({label:x.origin,value:x.m.conversion*100,sub:fmt(x.m.purchase)+' compras',pct:true}))); $('originTable').innerHTML=originTable(o); $('midiaInsights').innerHTML=cards([['Meta','Auditar criativos, regiões e formulários que geram falta de interesse, sem rede ou sem viabilidade.'],['Google','Preservar termos de intenção ativa e monitorar cobertura por região antes de escalar.'],['Sem origem','Obrigatoriedade de origem/campanha no CRM para eliminar zona cega de atribuição.']]); }
  function renderCrm(){ const s=bySeller(state.filtered),m=compute(state.filtered); $('crmKpis').innerHTML=[kpi('🧩','Qualidade CRM',pct(m.dataQuality),'score de governança',m.dataQuality>=.85?'':'danger'),kpi('⚠️','Etapas quebradas',fmt(m.sqlWithoutMql+m.oppWithoutSql+m.purchaseWithoutOpp),'SQL/MQL/Opp/Compra','danger'),kpi('🏷️','Gap tag LEAD',fmt(Math.max(0,m.total-m.leadTag)),'Lead ID sem tag','warn'),kpi('👤','Sem responsável',fmt(m.noSeller),'lead sem dono','warn')].join(''); $('sellerCards').innerHTML=sellerCards(s); $('sellerFunnelTable').innerHTML=sellerFunnel(s,m); $('stageLossTable').innerHTML=stageLoss(s,m); $('reasonSellerTable').innerHTML=reasonSeller(state.filtered); $('crmIssues').innerHTML=cards([['Status de perda quebrado',fmt(m.reasonWithoutLostFlag)+' motivos de perda sem flag LEAD PERDIDO.'],['Origem vazia',fmt(m.noOrigin)+' leads sem origem marcada.'],['Etapas incoerentes',fmt(m.sqlWithoutMql+m.oppWithoutSql+m.purchaseWithoutOpp)+' quebras de progressão.']]); }
  function renderMeta(){ const m=compute(state.filtered),t=state.targets; $('targetInputs').innerHTML=[target('monthlyLeads','Meta de Leads',t.monthlyLeads),target('monthlyPurchases','Meta de Compras',t.monthlyPurchases),target('monthlyRevenue','Meta de Valor',t.monthlyRevenue),target('minConversionRate','Conversão mínima',t.minConversionRate)].join(''); $('goalCards').innerHTML=[goal('Leads',m.total,t.monthlyLeads),goal('Compras',m.purchase,t.monthlyPurchases),goal('Valor',m.value,t.monthlyRevenue,true),goal('Conversão',m.conversion,t.minConversionRate,false,true)].join(''); $('fcaCards').innerHTML=fcas(m); $('automationMatrix').innerHTML=autoMatrix(); }

  function dailyBars(g){ if(!g.length) return '<p>Sem dados.</p>'; const max=Math.max(...g.map(x=>x.m.total),1); return '<div class="chart-bars">'+g.map(x=>`<div class="chart-bar"><div class="chart-bar-track"><i class="chart-bar-fill" style="--h:${Math.max(8,x.m.total/max*100)}%"></i></div><b>${short(x.date)}</b><span>${fmt(x.m.total)} | ${fmt(x.m.purchase)}</span></div>`).join('')+'</div>'; }
  function funnel(m){ const a=[['Lead ID',m.total,1],['MQL',m.mql,div(m.mql,m.total)],['SQL',m.sql,div(m.sql,m.total)],['Oportunidade',m.opportunity,div(m.opportunity,m.total)],['Compra',m.purchase,div(m.purchase,m.total)]]; return '<div class="funnel-list">'+a.map(x=>`<div class="funnel-row"><b>${x[0]}</b><div class="funnel-line"><i style="--w:${Math.max(3,x[2]*100)}%"></i></div><strong>${fmt(x[1])}</strong><small>${pct(x[2])}</small></div>`).join('')+'</div>'; }
  function hBars(items){ const max=Math.max(...items.map(i=>i.value),1); return '<div class="funnel-list">'+items.map(i=>`<div class="funnel-row"><b>${esc(i.label)}</b><div class="funnel-line"><i style="--w:${Math.max(3,i.value/max*100)}%"></i></div><strong>${i.pct?pct(i.value/100):fmt(i.value)}</strong><small>${esc(i.sub)}</small></div>`).join('')+'</div>'; }
  function dailyTable(g){ return table(['Data','Dia','Leads ID','MQL','SQL','Oportunidade','Compras','Compra/Lead','Motivos perda','Valor'],g.map(x=>[short(x.date),day(x.date),fmt(x.m.total),fmt(x.m.mql),fmt(x.m.sql),fmt(x.m.opportunity),fmt(x.m.purchase),pct(x.m.conversion),fmt(x.m.lossReason),money(x.m.value)])); }
  function originTable(o){ return table(['Origem','Leads ID','Compras','Compra/Lead','Motivos perda','Motivo/Lead','Valor','MQL/Lead','SQL/MQL'],o.map(x=>[x.origin,fmt(x.m.total),fmt(x.m.purchase),pct(x.m.conversion),fmt(x.m.lossReason),pct(x.m.lossRate),money(x.m.value),pct(div(x.m.mql,x.m.total)),pct(div(x.m.sql,x.m.mql))])); }
  function sellerCards(s){ return s.map((x,i)=>`<article class="glass seller-card reveal"><div class="seller-head"><div class="rank">${i+1}</div><div><h3>${esc(x.seller).replace('Rayane nunes','Rayane Nunes')}</h3><span>${x.m.conversion>=.30?'Alta conversão final':x.m.dataQuality<.72?'Governança crítica':'Operação em acompanhamento'}</span></div><strong>${pct(x.m.conversion)}</strong></div><div class="seller-stats"><div><b>${fmt(x.m.total)}</b><small>Leads</small></div><div><b>${fmt(x.m.mql)}</b><small>MQL</small></div><div><b>${fmt(x.m.sql)}</b><small>SQL</small></div><div><b>${fmt(x.m.opportunity)}</b><small>Opp</small></div><div><b>${fmt(x.m.purchase)}</b><small>Compras</small></div></div><p>Valor: <strong>${money(x.m.value)}</strong> · Motivos de perda: <strong>${fmt(x.m.lossReason)}</strong> · Qualidade CRM: <strong>${pct(x.m.dataQuality)}</strong></p></article>`).join(''); }
  function sellerFunnel(s,total){ const rows=[['Total',fmt(total.total),fmt(total.mql),pct(div(total.mql,total.total)),fmt(total.sql),pct(div(total.sql,total.mql)),fmt(total.opportunity),pct(div(total.opportunity,total.sql)),fmt(total.purchase),pct(div(total.purchase,total.opportunity)),pct(total.conversion)]]; s.forEach(x=>rows.push([x.seller.replace('Rayane nunes','Rayane Nunes'),fmt(x.m.total),fmt(x.m.mql),pct(div(x.m.mql,x.m.total)),fmt(x.m.sql),pct(div(x.m.sql,x.m.mql)),fmt(x.m.opportunity),pct(div(x.m.opportunity,x.m.sql)),fmt(x.m.purchase),pct(div(x.m.purchase,x.m.opportunity)),pct(x.m.conversion)])); return table(['Vendedora','Leads ID','MQL','MQL/Lead','SQL','SQL/MQL','Oportunidades','Opp/SQL','Compras','Compra/Opp','Compra/Lead'],rows,true); }
  function stageLoss(s,total){ const rows=[['Total',fmt(total.total-total.mql),fmt(total.mql-total.sql),fmt(total.sql-total.opportunity),fmt(total.opportunity-total.purchase)]]; s.forEach(x=>rows.push([x.seller.replace('Rayane nunes','Rayane Nunes'),fmt(x.m.total-x.m.mql),fmt(x.m.mql-x.m.sql),fmt(x.m.sql-x.m.opportunity),fmt(x.m.opportunity-x.m.purchase)])); return table(['Vendedora','Lead → MQL','MQL → SQL','SQL → Oportunidade','Oportunidade → Compra'],rows,true); }
  function reasonSeller(rows){ const sellers=[...new Set(rows.map(r=>r.seller))].sort(); const reasons=topReasons(rows,12); return table(['Motivo',...sellers.map(s=>s.replace('Rayane nunes','Rayane Nunes')),'Total'],reasons.map(r=>[r.reason,...sellers.map(s=>fmt(rows.filter(x=>x.seller===s&&x.lossReason===r.reason).length)),fmt(r.count)])); }
  function cards(arr){ return arr.map(a=>`<article class="glass insight-card reveal"><span class="badge warn">Insight V4 ON</span><h3>${esc(a[0])}</h3><p>${esc(a[1])}</p></article>`).join(''); }
  function target(k,l,v){ return `<article class="glass goal-card reveal"><span class="kpi-label">${l}</span><input data-target="${k}" type="number" step="${k.includes('Rate')?'.01':'1'}" value="${v}"></article>`; }
  function goal(l,val,target,moneyFlag,rate){ const ratio=div(val,target); return kpi(rate?'🎯':moneyFlag?'💰':'📈',l,rate?pct(val):moneyFlag?money(val):fmt(val),'Meta: '+(rate?pct(target):moneyFlag?money(target):fmt(target))+' · '+pct(ratio),ratio>=1?'':'warn'); }
  function fcas(m){ const arr=[['CRM não reflete perdas reais',`${fmt(m.reasonWithoutLostFlag)} motivos de perda sem flag LEAD PERDIDO.`,'Tornar status perdido obrigatório ao preencher motivo.','48h'],['Mídia sem origem confiável',`${fmt(m.noOrigin)} registros sem origem marcada.`,'Obrigar origem/campanha e auditar Meta, Google e sem origem.','72h'],['Etapas quebradas no funil',`${fmt(m.sqlWithoutMql+m.oppWithoutSql+m.purchaseWithoutOpp)} quebras de progressão.`,'Criar regra MQL → SQL → Oportunidade → Compra.','7 dias']]; return arr.map(a=>`<article class="glass fca-card reveal"><span class="badge danger">FCA</span><h3>${a[0]}</h3><ul><li><strong>Fato:</strong> ${a[1]}</li><li><strong>Causa:</strong> governança de etapa/campo incompleta.</li><li><strong>Ação:</strong> ${a[2]}</li><li><strong>Prazo:</strong> ${a[3]}</li></ul></article>`).join(''); }
  function autoMatrix(){ return table(['Classificação','Rotina','Observação'],[['Manual obrigatório','Validar taxonomia de perda, aprovar promessa comercial, negociar exceções e fechar FCA.','Decisão humana.'],['Semi-automatizável','Follow-up D0-D3, criação de tarefa, rascunho de FCA e atualização orientada de CRM.','IA prepara, gestor aprova.'],['Automatizável','Coleta GrowthPack, auditoria diária, alerta de etapa quebrada, lead sem dono e origem vazia.','Pode rodar via Apps Script, Make, n8n ou GitHub Action.'],['Não automatizar agora','Alteração de oferta, promessa de instalação, escalonamento sensível e decisão de orçamento.','Exige contexto humano.']]); }
  function table(head,rows,total){ return `<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr class="${total&&i===0?'total':''}">${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
  function pt(s){ if(!s) return '--'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
  function short(s){ const [y,m,d]=s.split('-'); return `${d}/${m}`; }
  function day(s){ return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(s+'T00:00:00').getDay()] || '--'; }
  function reveal(){ requestAnimationFrame(()=>$$('.reveal').forEach(el=>el.classList.add('in'))); }
  function toast(msg){ const el=$('toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),3800); }

  function fillFilters(){
    function set(id, vals, label){ const el=$(id); if(!el) return; el.innerHTML=['all',...vals].map(v=>`<option value="${esc(v)}">${v==='all'?label:esc(String(v).replace('Rayane nunes','Rayane Nunes'))}</option>`).join(''); }
    set('sellerFilter',[...new Set(state.records.map(r=>r.seller))].filter(Boolean).sort(),'Todas as vendedoras');
    set('originFilter',[...new Set(state.records.map(r=>r.origin))].filter(Boolean).sort(),'Todas as origens');
    set('reasonFilter',[...new Set(state.records.map(r=>r.lossReason))].filter(Boolean).sort(),'Todos os motivos');
    $('startDate').value=state.filters.start; $('endDate').value=state.filters.end; $('stageFilter').value=state.filters.stage;
  }

  function bind(){
    $$('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{ state.activeTab=btn.dataset.tab; $$('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); render(); }));
    ['startDate','endDate','sellerFilter','originFilter','reasonFilter','stageFilter'].forEach(id=>$(id).addEventListener('change',()=>{ state.filters={ start:$('startDate').value, end:$('endDate').value, seller:$('sellerFilter').value, origin:$('originFilter').value, reason:$('reasonFilter').value, stage:$('stageFilter').value }; render(); }));
    $('resetFilters').addEventListener('click',()=>{ state.filters={ start:(CONFIG.defaultPeriod&&CONFIG.defaultPeriod.start)||'2026-06-01', end:(CONFIG.defaultPeriod&&CONFIG.defaultPeriod.end)||'2026-06-18', seller:'all', origin:'all', reason:'all', stage:'all' }; fillFilters(); render(); toast('Filtros redefinidos.'); });
    $('refreshData').addEventListener('click',()=>initialize(true));
    $('motionToggle').addEventListener('click',()=>{ document.body.classList.toggle('no-motion'); $('motionToggle').textContent=document.body.classList.contains('no-motion')?'Animações OFF':'Animações ON'; });
    $('setCsvUrl').addEventListener('click',()=>{ const u=prompt('Cole a URL CSV publicada da aba BASE_CRM ou endpoint Apps Script:'); if(u){ localStorage.setItem('st1GrowthpackCsvUrl',u); toast('URL salva. Clique em Atualizar dados.'); } });
    $('exportJson').addEventListener('click',()=>{ const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),filters:state.filters,metrics:compute(state.filtered),records:state.filtered},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='st1-growthpack-snapshot.json'; a.click(); URL.revokeObjectURL(a.href); });
    document.addEventListener('input',e=>{ if(e.target.matches('[data-target]')){ state.targets[e.target.dataset.target]=Number(e.target.value); saveTargets(); if(state.activeTab==='meta') renderMeta(); } });
    window.addEventListener('scroll',()=>{ const p=$('scrollProgress'); if(!p) return; const h=document.documentElement.scrollHeight-window.innerHeight; p.style.width=h?`${window.scrollY/h*100}%`:'0%'; });
  }

  let bound=false;
  async function initialize(){
    try{
      state.raw = await loadData();
      state.records = uniqueByLead(state.raw.map(normalizeRecord).filter(r=>r.leadId&&r.date));
      fillFilters();
      if(!bound){ bind(); bound=true; }
      render(); toast(state.sourceStatus);
      window.ST1Dashboard = { state, compute, render };
    } catch(e){
      console.error(e);
      document.body.insertAdjacentHTML('afterbegin',`<div style="position:fixed;z-index:9999;left:12px;right:12px;top:12px;padding:16px;border-radius:16px;background:#ff416d;color:#fff;font-weight:800">Erro ao iniciar dashboard: ${esc(e.message)}</div>`);
    }
  }
  document.addEventListener('DOMContentLoaded', initialize);
})();