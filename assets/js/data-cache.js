(function(){
  const daily = [
    ['2026-06-01',90,90,46,38,23,24,63,2227],['2026-06-02',95,95,39,34,20,20,72,2098],
    ['2026-06-03',111,111,54,36,25,24,76,2625],['2026-06-04',80,80,39,23,19,18,41,1900],
    ['2026-06-05',89,89,39,39,26,27,59,3059],['2026-06-06',79,79,45,28,22,22,51,2456],
    ['2026-06-07',45,45,16,3,2,2,32,198],['2026-06-08',151,124,63,73,47,52,87,5446],
    ['2026-06-09',126,50,54,48,28,24,87,2912],['2026-06-10',130,59,51,43,37,34,84,4468],
    ['2026-06-11',91,41,33,30,23,25,64,2893],['2026-06-12',90,34,37,33,26,25,55,2643],
    ['2026-06-13',59,24,24,25,15,15,36,1880],['2026-06-14',38,23,22,12,10,10,18,1010],
    ['2026-06-15',124,56,57,33,32,35,67,3605],['2026-06-16',100,42,48,37,23,24,48,2706],
    ['2026-06-17',102,38,38,29,25,21,39,2872],['2026-06-18',46,14,13,16,8,3,14,841]
  ];
  const sellers = [
    ['Laydianne',356,255,113,110,105,97,222,10414],
    ['Rayane nunes',275,259,49,84,64,88,151,9993],
    ['Wallas Linhares Dias',326,161,220,156,88,81,225,10142],
    ['Maria Reis',381,259,204,98,79,72,179,7624],
    ['Valberta Bastos',308,160,132,132,75,67,216,7666]
  ];
  const origins = {
    'Sem origem marcada': { total:1131, purchase:290 },
    'Meta Ads': { total:291, purchase:32 },
    'Google Ads': { total:221, purchase:80 },
    'Meta + Google': { total:3, purchase:3 }
  };
  const sellerSourcePurchase = {
    'Laydianne': {'Google Ads':11,'Meta Ads':7,'Sem origem marcada':79},
    'Maria Reis': {'Google Ads':11,'Meta + Google':2,'Meta Ads':16,'Sem origem marcada':43},
    'Rayane nunes': {'Google Ads':24,'Meta Ads':4,'Sem origem marcada':60},
    'Valberta Bastos': {'Google Ads':10,'Meta Ads':0,'Sem origem marcada':57},
    'Wallas Linhares Dias': {'Google Ads':24,'Meta + Google':1,'Meta Ads':5,'Sem origem marcada':51}
  };
  const reasons = [
    ['Falta de Interesse / Prioridade',{Laydianne:55,'Maria Reis':10,'Rayane nunes':54,'Valberta Bastos':70,'Wallas Linhares Dias':51}],
    ['Atendimento não comercial',{Laydianne:9,'Maria Reis':46,'Rayane nunes':26,'Valberta Bastos':42,'Wallas Linhares Dias':43}],
    ['Sem rede no local',{Laydianne:2,'Maria Reis':73,'Rayane nunes':3,'Valberta Bastos':15,'Wallas Linhares Dias':42}],
    ['Sem Viabilidade',{Laydianne:55,'Maria Reis':8,'Rayane nunes':26,'Valberta Bastos':0,'Wallas Linhares Dias':0}],
    ['Já Possui Serviço',{Laydianne:38,'Maria Reis':12,'Rayane nunes':6,'Valberta Bastos':8,'Wallas Linhares Dias':15}],
    ['Condomínio não adequado',{Laydianne:26,'Maria Reis':0,'Rayane nunes':15,'Valberta Bastos':17,'Wallas Linhares Dias':18}],
    ['KITNET | Não satisfeito com as condições',{Laydianne:18,'Maria Reis':10,'Rayane nunes':3,'Valberta Bastos':10,'Wallas Linhares Dias':18}],
    ['Rede em construção',{Laydianne:3,'Maria Reis':1,'Rayane nunes':6,'Valberta Bastos':25,'Wallas Linhares Dias':1}],
    ['Não satisfeito com as condições',{Laydianne:1,'Maria Reis':2,'Rayane nunes':1,'Valberta Bastos':6,'Wallas Linhares Dias':19}],
    ['CTO distante',{Laydianne:0,'Maria Reis':7,'Rayane nunes':1,'Valberta Bastos':13,'Wallas Linhares Dias':6}],
    ['Lead Desqualificado',{Laydianne:0,'Maria Reis':1,'Rayane nunes':3,'Valberta Bastos':8,'Wallas Linhares Dias':9}],
    ['Orçamento insuficiente',{Laydianne:12,'Maria Reis':3,'Rayane nunes':3,'Valberta Bastos':0,'Wallas Linhares Dias':0}],
    ['Comprado do concorrente',{Laydianne:1,'Maria Reis':1,'Rayane nunes':2,'Valberta Bastos':1,'Wallas Linhares Dias':2}],
    ['CTO Lotado',{Laydianne:1,'Maria Reis':2,'Rayane nunes':1,'Valberta Bastos':1,'Wallas Linhares Dias':1}],
    ['Problema no Atendimento',{Laydianne:0,'Maria Reis':1,'Rayane nunes':0,'Valberta Bastos':0,'Wallas Linhares Dias':1}],
    ['Tempo de Instalação',{Laydianne:1,'Maria Reis':1,'Rayane nunes':0,'Valberta Bastos':0,'Wallas Linhares Dias':0}],
    ['KITNET | Sem viabilidade',{Laydianne:0,'Maria Reis':1,'Rayane nunes':0,'Valberta Bastos':0,'Wallas Linhares Dias':0}]
  ];
  function cat(reason){ const r=String(reason||'').toLowerCase(); if(!r)return 'Sem motivo'; if(r.includes('falta de interesse')||r.includes('prioridade'))return 'Comercial / prioridade / follow-up'; if(r.includes('atendimento não comercial'))return 'Qualificação / atendimento'; if(r.includes('sem rede')||r.includes('rede em construção'))return 'Infraestrutura / cobertura'; if(r.includes('sem viabilidade'))return 'Infraestrutura / viabilidade'; if(r.includes('condomínio'))return 'Infraestrutura / condomínio'; if(r.includes('cto'))return 'Infraestrutura / capacidade'; if(r.includes('já possui')||r.includes('concorrente'))return 'Base atendida / concorrência'; if(r.includes('kitnet')||r.includes('condições'))return 'Preço / condição / oferta'; if(r.includes('orçamento')||r.includes('tempo de instalação'))return 'Preço / condição comercial'; if(r.includes('desqualificado'))return 'Qualificação / lead desqualificado'; return 'Outros'; }
  function setOrigin(row, origin){ row.origin=origin; row.metaAds=origin==='Meta Ads'||origin==='Meta + Google'?1:0; row.googleAds=origin==='Google Ads'||origin==='Meta + Google'?1:0; }
  const rows=[], sellerRemaining={}; sellers.forEach(s=>sellerRemaining[s[0]]=s[1]); let id=64000000;
  daily.forEach(d=>{ for(let i=0;i<d[1];i++){ const seller=Object.keys(sellerRemaining).sort((a,b)=>sellerRemaining[b]-sellerRemaining[a])[0]; sellerRemaining[seller]--; rows.push({date:d[0],dateRaw:d[0],leadId:String(id++),name:'Lead #'+id,value:0,leadTag:0,mql:0,sql:0,opportunity:0,purchase:0,lostFlag:0,metaAds:0,googleAds:0,seller,lossReason:'',tags:'',origin:'Sem origem marcada',reasonCategory:'Sem motivo'}); }});
  function assignFlag(field,dailyIndex,sellerIndex){ rows.forEach(r=>r[field]=0); const rem={}; sellers.forEach(s=>rem[s[0]]=s[sellerIndex]); daily.forEach(d=>{ let need=d[dailyIndex]; let pool=rows.filter(r=>r.date===d[0]&&!r[field]); while(need>0 && pool.length){ pool.sort((a,b)=>(rem[b.seller]||0)-(rem[a.seller]||0)); const pos=pool.findIndex(r=>(rem[r.seller]||0)>0); if(pos<0)break; const r=pool.splice(pos,1)[0]; r[field]=1; rem[r.seller]--; need--; }}); Object.keys(rem).forEach(seller=>{ let need=rem[seller]; if(need>0){ rows.filter(r=>r.seller===seller&&!r[field]).slice(0,need).forEach(r=>r[field]=1); }}); }
  assignFlag('leadTag',2,2); assignFlag('mql',3,3); assignFlag('sql',4,4); assignFlag('opportunity',5,5); assignFlag('purchase',6,6);
  const lossSlot='__lossSlot'; assignFlag(lossSlot,7,7);
  sellers.forEach(s=>{ const seller=s[0], purchases=rows.filter(r=>r.seller===seller&&r.purchase); const unit=s[6]?s[8]/s[6]:0; purchases.forEach(r=>r.value=unit); });
  Object.entries(sellerSourcePurchase).forEach(([seller,map])=>{ const pool=rows.filter(r=>r.seller===seller&&r.purchase); let p=0; Object.entries(map).forEach(([origin,count])=>{ for(let i=0;i<count;i++){ if(pool[p]) setOrigin(pool[p++],origin); }}); });
  const originUsed={}; rows.forEach(r=>originUsed[r.origin]=(originUsed[r.origin]||0)+1); Object.entries(origins).forEach(([origin,t])=>{ let need=t.total-(originUsed[origin]||0); if(need>0){ rows.filter(r=>!r.purchase && r.origin==='Sem origem marcada').slice(0,need).forEach(r=>setOrigin(r,origin)); }});
  reasons.forEach(([reason,map])=>{ Object.entries(map).forEach(([seller,count])=>{ const pool=rows.filter(r=>r.seller===seller&&r[lossSlot]&&!r.lossReason); for(let i=0;i<count&&i<pool.length;i++){ pool[i].lossReason=reason; pool[i].reasonCategory=cat(reason); }}); });
  const firstLost=rows.find(r=>r.lossReason); if(firstLost) firstLost.lostFlag=1;
  rows.forEach(r=>{ delete r[lossSlot]; if(r.leadTag)r.tags='LEAD'; if(r.lostFlag)r.tags=(r.tags?r.tags+', ':'')+'LEAD PERDIDO'; });
  window.__GROWTHPACK_FALLBACK_DATA__ = rows;
})();