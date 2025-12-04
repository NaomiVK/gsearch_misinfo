/**
 * Scam Detection Types
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FlaggedTermStatus = 'new' | 'active' | 'reviewed' | 'dismissed' | 'escalated';

/**
 * A flagged search term that matches scam patterns
 */
export type FlaggedTerm = {
  id: string;
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  severity: Severity;
  matchedCategory: string; // Which category triggered the flag
  matchedPatterns: string[]; // Specific patterns that matched
  firstDetected: string; // ISO date
  lastSeen: string; // ISO date
  status: FlaggedTermStatus;
  notes?: string;
};

/**
 * Scam detection result for a date range
 */
export type ScamDetectionResult = {
  analysisDate: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalQueriesAnalyzed: number;
  flaggedTerms: FlaggedTerm[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
};

/**
 * Keyword category configuration
 */
export type KeywordCategory = {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  terms: string[];
  // For contextual matching (must contain one of these + a term)
  mustContain?: string[];
  // Regex patterns for complex matching
  patterns?: string[];
};

/**
 * Full scam keywords configuration
 */
export type ScamKeywordsConfig = {
  version: string;
  lastUpdated: string;
  categories: {
    fakeExpiredBenefits: KeywordCategory;
    illegitimatePaymentMethods: KeywordCategory;
    threatLanguage: KeywordCategory;
    suspiciousModifiers: KeywordCategory;
  };
  whitelist: {
    description: string;
    patterns: string[];
  };
  seasonalMultipliers: {
    taxSeason: {
      startMonth: number;
      startDay: number;
      endMonth: number;
      endDay: number;
      multiplier: number;
    };
    gstPayment: {
      days: number[];
      months: number[];
      multiplier: number;
    };
    ccrPayment: {
      days: number[];
      months: number[];
      multiplier: number;
    };
  };
  // Keywords to monitor in Google Trends
  trendsKeywords: string[];
};

/**
 * Dashboard KPI summary
 */
export type DashboardSummary = {
  period: {
    startDate: string;
    endDate: string;
  };
  flaggedTermsCount: number;
  newTermsCount: number;
  totalSuspiciousImpressions: number;
  averagePosition: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  comparisonToPrevious?: {
    flaggedTermsChange: number;
    impressionsChange: number;
    newTermsInPeriod: number;
  };
};

/**
 * Export data format
 */
export type ExportData = {
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: DashboardSummary;
  flaggedTerms: FlaggedTerm[];
};

/**
 * Dashboard data response
 */
export type DashboardData = {
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  flaggedTerms: FlaggedTerm[];
  criticalAlerts: FlaggedTerm[];
  newTerms: FlaggedTerm[];
  trendingTerms: FlaggedTerm[];
  totalQueriesAnalyzed: number;
  period: {
    startDate: string;
    endDate: string;
  };
};

/**
 * Comparison result data
 */
export type ComparisonResult = {
  period1: {
    startDate: string;
    endDate: string;
    totalFlagged: number;
    criticalCount: number;
    totalImpressions: number;
  };
  period2: {
    startDate: string;
    endDate: string;
    totalFlagged: number;
    criticalCount: number;
    totalImpressions: number;
  };
  changes: {
    totalFlaggedChange: number;
    criticalChange: number;
    impressionsChange: number;
  };
  newTerms: FlaggedTerm[];
  removedTerms: FlaggedTerm[];
  trendingTerms: Array<{
    query: string;
    severity: Severity;
    currentImpressions: number;
    previousImpressions: number;
    changePercent: number;
  }>;
};
