# Integrações GrowthPack

## Opção A: Google Sheets público/publicado

Funciona se a planilha estiver disponível para leitura pública ou publicada na web.

URL usada pelo painel:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/gviz/tq?tqx=out:csv&gid=SHEET_GID
```

Configure em `config/dashboard.config.js`:

```js
growthPack: {
  useGoogleCsv: true,
  csvUrl: 'https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv&gid=...',
  appsScriptUrl: ''
}
```

## Opção B: Apps Script para planilha privada

Crie um Apps Script vinculado à GrowthPack com o código abaixo.

```js
const SHEET_NAME = 'BASE_CRM';

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const rows = values.map(row => {
    const item = {};
    headers.forEach((header, index) => item[header] = row[index]);
    return item;
  });

  return ContentService
    .createTextOutput(JSON.stringify({ records: rows, updatedAt: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Depois:

1. Clique em **Implantar > Nova implantação**.
2. Escolha **Aplicativo da Web**.
3. Acesso: **Qualquer pessoa com o link**, se for um painel sem login.
4. Copie a URL `/exec`.
5. Cole em `appsScriptUrl` no `config/dashboard.config.js`.

## Opção C: Botão dentro do painel

No painel, clique em **Configurar fonte CSV/API** e cole a URL do CSV ou Apps Script.

Essa URL fica salva no navegador via `localStorage`.

## Campos esperados

A aba `BASE_CRM` deve conter:

- Data
- Lead ID
- Nome
- Valor
- LEAD
- MQL
- SQL
- OPORTUNIDADE
- COMPRA
- LEAD PERDIDO
- META ADS
- GOOGLE ADS
- RESPONSAVEL
- MOTIVO DE PERDA
- TAGS

## Tratamento de datas

Alguns exports podem transformar `01/06/2026` em `2026-01-06`. Para esse caso, o painel possui a opção:

```js
swapIsoDayMonthWhenAmbiguous: true
```

Ela corrige datas ambíguas no padrão brasileiro quando necessário.
