# Arquitetura do projeto

## Objetivo

Criar um painel de comando comercial para a ST1 Internet conectado à GrowthPack, com arquitetura simples de subir no GitHub e flexível para evoluir para API, Apps Script, Make, n8n ou backend dedicado.

## Camadas

### 1. Interface

Arquivo principal: `index.html`

Responsável por:

- estrutura das abas;
- filtros globais;
- containers de KPIs, gráficos e tabelas;
- carregamento dos scripts e configurações.

### 2. Design system ST1

Arquivo: `assets/css/styles.css`

Princípios visuais:

- azul profundo como base;
- azul elétrico como cor principal;
- laranja como cor de ação/alerta;
- branco para contraste;
- glassmorphism para cards;
- animações suaves;
- responsividade completa.

### 3. Configuração

Arquivo: `config/dashboard.config.js`

Controla:

- ID da GrowthPack;
- GID da aba BASE_CRM;
- URL CSV pública;
- endpoint Apps Script;
- fallback local;
- metas comerciais;
- regra de correção de datas ambíguas.

### 4. Dados

Pasta: `data/`

Contém:

- `growthpack-base-crm.json`: fallback local compacto;
- `growthpack-base-crm.pretty.json`: versão legível;
- `growthpack-base-crm.csv`: CSV de auditoria.

### 5. Aplicação

Arquivo: `assets/js/app.js`

Responsável por:

- buscar dados dinâmicos;
- normalizar datas, origens, motivos e etapas;
- deduplicar por Lead ID;
- aplicar filtros globais;
- calcular métricas;
- renderizar as 4 abas;
- gerar metas, FCAs e matriz de automação.

## Fluxo de dados

```text
GrowthPack BASE_CRM
  ↓
Google CSV ou Apps Script
  ↓
Normalização de campos
  ↓
Deduplicação por Lead ID
  ↓
Filtros globais
  ↓
Métricas, gráficos, tabelas, FCA e metas
```

## Decisões técnicas

### Por que app estático?

Porque o usuário precisa baixar, subir no GitHub e ter um painel funcionando sem infraestrutura adicional.

### Por que fallback embutido?

Para o painel funcionar mesmo quando a GrowthPack estiver privada, sem publicação web ou bloqueada por CORS.

### Por que Apps Script opcional?

Porque é a forma mais simples de puxar dados de uma planilha privada sem criar backend completo.

## Expansões recomendadas

1. Adicionar autenticação se o painel for público.
2. Substituir fallback por endpoint Apps Script.
3. Criar rotina de atualização via GitHub Action.
4. Persistir histórico diário consolidado.
5. Integrar alertas com Slack, WhatsApp, Make ou n8n.
