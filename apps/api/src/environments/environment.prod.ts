export const environment = {
  production: true,
  port: process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000,

  // Google Search Console Configuration
  google: {
    credentialsPath:
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] ||
      '../../service-account-credentials.json',
    siteUrl: process.env['SEARCH_CONSOLE_SITE_URL'] || 'https://www.canada.ca/',
    craUrlFilters: [
      '/en/revenue-agency/',
      '/fr/agence-revenu/',
      '/en/services/taxes/',
      '/fr/services/impots/',
    ],
  },

  // Scam Detection Settings
  scamDetection: {
    impressionThreshold: process.env['IMPRESSION_THRESHOLD']
      ? parseInt(process.env['IMPRESSION_THRESHOLD'], 10)
      : 500,
    defaultDateRangeDays: 28,
  },

  // Cache Settings (in seconds)
  cache: {
    analyticsTtl: 3600,
    trendsTtl: 1800,
    keywordsTtl: 300,
  },

  // CORS
  frontendUrl: process.env['FRONTEND_URL'] || 'http://localhost:4200',
};
