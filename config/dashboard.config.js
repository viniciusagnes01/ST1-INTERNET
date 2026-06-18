window.DASHBOARD_CONFIG = {
  projectName: 'ST1 Internet | GrowthPack Command Center',
  clientName: 'ST1 Internet',
  methodName: 'V4 ON GrowthOps',
  defaultPeriod: {
    start: '2026-06-01',
    end: '2026-06-18'
  },
  growthPack: {
    spreadsheetId: '1BurqRDqYbWq8dPVxXiKjWH6WmfBNoe39AymwJM8LpFA',
    baseCrmGid: '1699545222',
    // Runtime source order: localStorage override -> Apps Script proxy -> bundled fallback.
    // Disabled by default because private Google Sheets/public CSV can block rendering on Vercel.
    useGoogleCsv: false,
    // Paste a public CSV or Apps Script endpoint inside the dashboard to activate dynamic sync.
    csvUrl: 'https://docs.google.com/spreadsheets/d/1BurqRDqYbWq8dPVxXiKjWH6WmfBNoe39AymwJM8LpFA/gviz/tq?tqx=out:csv&gid=1699545222',
    // Use this when the sheet is private. See docs/integrations.md.
    appsScriptUrl: '',
    fallbackJson: './data/growthpack-base-crm.json',
    // Some exports can transform 01/06/2026 into 2026-01-06. Keep true for this GrowthPack.
    swapIsoDayMonthWhenAmbiguous: true
  },
  targets: {
    monthlyLeads: 2800,
    monthlyPurchases: 680,
    monthlyRevenue: 76000,
    minConversionRate: 0.25,
    maxLossRate: 0.55,
    minDataQuality: 0.85,
    maxUnassignedRate: 0.02,
    maxNoOriginRate: 0.35
  },
  st1Brand: {
    blue900: '#070A40',
    blue800: '#15117A',
    blue700: '#2B2FC2',
    blue500: '#3438D7',
    orange600: '#FF5B00',
    orange500: '#FF7A00',
    cyan400: '#25D9FF',
    white: '#FFFFFF'
  }
};