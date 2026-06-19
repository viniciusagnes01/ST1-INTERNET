# ST1 Internet | GrowthPack Command Center

Cockpit de receita, restrição e processo comercial em **Modo V4 ON** para acompanhar GrowthPack da ST1 Internet.

Abas principais:

1. **Visão Geral**: leitura executiva, funil, ritmo diário e restrição atual.
2. **Restrição**: motor TOC/Goldratt com evidência, impacto, ação, dono e prazo.
3. **PCP Comercial**: WIP, capacidade, aging, SLA e fila de prioridade.
4. **Comercial**: funil por vendedora, etapa por etapa, motivos de perda e gargalos.
5. **Mídia**: origem, volume, conversão, qualidade comercial, CAC e ROAS editáveis.
6. **Atendimento**: modelo de WhatsApp/bot, transbordo humano e risco de SLA.
7. **Retenção**: camada de CSAT/NPS, recompra, recuperação e indicação.
8. **Perdas**: motivos, categorias operacionais e plano de correção.
9. **Metas**: metas configuráveis, projeções, capacidade e forecast.
10. **FCA**: cadastro manual de fato, causa, ação, dono, prazo e status.
11. **Handoff**: continuidade de conta, stack, riscos e próximos 7 dias.
12. **Sistema**: auditoria de dados, governança e arquitetura V4 ON.

## Como rodar

### Opção 1: abrir direto
Abra `index.html` no navegador. O painel funciona com o fallback local embutido em `assets/js/data-cache.js`.

### Opção 2: subir no GitHub Pages
1. Suba a pasta inteira para um repositório.
2. Ative GitHub Pages em `Settings > Pages`.
3. Use a branch `main` e pasta `/root`.
4. Acesse a URL gerada pelo GitHub Pages.

### Opção 3: rodar com servidor local
```bash
npm install
npm run dev
```

## Integração dinâmica GrowthPack

O painel tenta carregar dados nesta ordem:

1. URL CSV configurada pelo botão **Configurar fonte CSV/API**.
2. `appsScriptUrl` em `config/dashboard.config.js`.
3. CSV público do Google Sheets em `growthPack.csvUrl`.
4. Fallback local em `assets/js/data-cache.js` e `data/growthpack-base-crm.json`.

Se a planilha estiver privada, use o Apps Script descrito em `docs/integrations.md`.

## Filtros globais

Os filtros são aplicados em todas as abas:

- Data inicial
- Data final
- Vendedora
- Origem
- Motivo de perda
- Etapa: MQL, SQL, Oportunidade, Compra ou com motivo de perda

## Conceito V4 ON

Este projeto segue a lógica operacional:

**Cliente → Dados → Diagnóstico → Restrição → Decisão → Tarefa → Follow-up → Risco/FCA → Melhoria contínua**

Toda divergência relevante deve virar uma das ações abaixo:

- atualização de CRM;
- task operacional;
- FCA;
- decisão de mídia;
- melhoria de funil;
- alerta de risco;
- rotina de governança.

## Estrutura

```text
st1-growthpack-command-center/
├── index.html
├── package.json
├── config/
│   └── dashboard.config.js
├── assets/
│   ├── css/styles.css
│   ├── img/st1-logo.svg
│   └── js/
│       ├── app.js
│       └── data-cache.js
├── data/
│   ├── growthpack-base-crm.json
│   ├── growthpack-base-crm.pretty.json
│   └── growthpack-base-crm.csv
├── docs/
│   ├── architecture.md
│   ├── integrations.md
│   └── v4-on-operating-model.md
└── scripts/
    └── fetch-growthpack.example.mjs
```

## Observações importantes

- O topo do funil é calculado por **Lead ID único**.
- A tag `LEAD` é exibida apenas como auditoria de qualidade de marcação.
- Motivo de perda preenchido é tratado como **perda operacional**, porque a flag `LEAD PERDIDO` pode estar inconsistente.
- As metas em **Meta & FCA** podem ser editadas no próprio painel e ficam salvas no navegador via `localStorage`.
