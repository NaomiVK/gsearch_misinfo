export const environment = {
  production: false,
  port: 3000,

  // Google Search Console Configuration
  google: {
    credentialsPath: '../../service-account-credentials.json',
    // CRA-specific URLs on canada.ca
    siteUrl: 'https://www.canada.ca/',
    // URL filters for CRA pages only
    craUrlFilters: [
      '/en/revenue-agency/',
      '/fr/agence-revenu/',
      '/en/services/taxes/',
      '/fr/services/impots/',
    ],
  },

  // Scam Detection Settings
  scamDetection: {
    impressionThreshold: 500, // Minimum impressions to flag
    defaultDateRangeDays: 28, // Default analysis period
  },

  // Cache Settings (in seconds)
  cache: {
    analyticsTtl: 3600, // 1 hour
    trendsTtl: 1800, // 30 minutes
    keywordsTtl: 300, // 5 minutes
  },

  // CORS
  frontendUrl: 'http://localhost:4200',
};
