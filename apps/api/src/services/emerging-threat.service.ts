import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { ComparisonService } from './comparison.service';
import { ScamDetectionService } from './scam-detection.service';
import { SearchConsoleService } from './search-console.service';
import {
  EmergingThreat,
  EmergingThreatsResponse,
  CTRAnomaly,
  CTRBenchmarks,
  RiskLevel,
  TermComparison,
  DateRange,
} from '@cra-scam-detection/shared-types';
import { environment } from '../environments/environment';
import { v4 as uuidv4 } from 'uuid';
import * as stringSimilarity from 'string-similarity';

/**
 * Fallback CTR benchmarks (used when no dynamic data available)
 * Based on typical Google Search Console data for legitimate queries
 */
const FALLBACK_CTR_BENCHMARKS: Record<string, { min: number; expected: number }> = {
  '1-3': { min: 0.03, expected: 0.20 },   // Position 1-3: expect 15-30%, anomaly if < 3%
  '4-8': { min: 0.02, expected: 0.10 },   // Position 4-8: expect 8-15%, anomaly if < 2%
  '9-15': { min: 0.01, expected: 0.05 },  // Position 9-15: expect 3-8%, anomaly if < 1%
  '16+': { min: 0.005, expected: 0.02 },  // Position 16+: expect <3%, anomaly if < 0.5%
};

/**
 * Dynamic pattern detection regexes
 */
const DYNAMIC_PATTERNS = {
  dollarAmount: /\$\s*\d+(?:,\d{3})*(?:\.\d{2})?|\d+\s*(?:dollars?|bucks)/i,
  yearReference: /\b20(2[4-9]|[3-9]\d)\b/,  // Years 2024-2099
  urgencyWords: /\b(urgent|immediate|immediately|act now|claim now|apply now|hurry|limited time|expires|last chance|final notice)\b/i,
  freeMoneyPattern: /\b(free|bonus|extra|secret|hidden|unclaimed)\s+(money|cash|payment|benefit|refund|cheque|check)\b/i,
  craContext: /\b(cra|canada revenue|revenue agency|tax)\b/i,
};

@Injectable()
export class EmergingThreatService {
  private readonly logger = new Logger(EmergingThreatService.name);
  private dynamicBenchmarks: CTRBenchmarks | null = null;

  constructor(
    private readonly cacheService: CacheService,
    private readonly comparisonService: ComparisonService,
    private readonly scamDetectionService: ScamDetectionService,
    private readonly searchConsoleService: SearchConsoleService
  ) {}

  /**
   * Get CTR benchmarks - dynamic from your data, with fallback to industry defaults
   */
  async getCTRBenchmarks(): Promise<CTRBenchmarks> {
    if (this.dynamicBenchmarks) {
      return this.dynamicBenchmarks;
    }

    try {
      this.dynamicBenchmarks = await this.searchConsoleService.calculateCTRBenchmarks(90, 10);
      this.logger.log(
        `Using dynamic CTR benchmarks from ${this.dynamicBenchmarks.totalQueriesAnalyzed} queries`
      );
      return this.dynamicBenchmarks;
    } catch (error) {
      this.logger.warn(`Failed to calculate dynamic benchmarks, using fallbacks: ${error.message}`);
      // Return a CTRBenchmarks object using fallback values
      return {
        '1-3': { positionRange: '1-3', min: 0.03, expected: 0.20, max: 0.30, sampleSize: 0 },
        '4-8': { positionRange: '4-8', min: 0.02, expected: 0.10, max: 0.15, sampleSize: 0 },
        '9-15': { positionRange: '9-15', min: 0.01, expected: 0.05, max: 0.08, sampleSize: 0 },
        '16+': { positionRange: '16+', min: 0.005, expected: 0.02, max: 0.03, sampleSize: 0 },
        calculatedAt: new Date().toISOString(),
        dataRange: { startDate: '', endDate: '' },
        totalQueriesAnalyzed: 0,
      };
    }
  }

  /**
   * Get emerging threats by analyzing comparison data
   * Compares current period vs previous period and identifies suspicious terms
   */
  async getEmergingThreats(days = 7): Promise<EmergingThreatsResponse> {
    const cacheKey = `emerging-threats:${days}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        this.logger.log(`Analyzing emerging threats for ${days}-day comparison`);

        // Get dynamic CTR benchmarks from actual data
        const benchmarks = await this.getCTRBenchmarks();

        // Get comparison data
        const comparison = days === 7
          ? await this.comparisonService.compareWeekOverWeek()
          : await this.comparisonService.compareMonthOverMonth();

        // Analyze all terms for emerging threats
        const threats: EmergingThreat[] = [];

        for (const term of comparison.terms) {
          const threat = this.analyzeTermForThreats(term, benchmarks);
          if (threat && threat.riskScore >= 30) {
            threats.push(threat);
          }
        }

        // Sort by risk score descending
        threats.sort((a, b) => b.riskScore - a.riskScore);

        const response: EmergingThreatsResponse = {
          currentPeriod: comparison.currentPeriod,
          previousPeriod: comparison.previousPeriod,
          threats,
          summary: {
            critical: threats.filter(t => t.riskLevel === 'critical').length,
            high: threats.filter(t => t.riskLevel === 'high').length,
            medium: threats.filter(t => t.riskLevel === 'medium').length,
            low: threats.filter(t => t.riskLevel === 'low').length,
            total: threats.length,
          },
        };

        this.logger.log(
          `Found ${response.summary.total} emerging threats ` +
          `(${response.summary.critical} critical, ${response.summary.high} high)`
        );

        return response;
      },
      environment.cache.analyticsTtl
    );
  }

  /**
   * Analyze a single term for threat indicators
   */
  private analyzeTermForThreats(term: TermComparison, benchmarks: CTRBenchmarks): EmergingThreat | null {
    const query = term.query.toLowerCase();

    // Skip if whitelisted (use scam detection service's whitelist)
    // We'll check this in the controller instead

    // Calculate CTR anomaly using dynamic benchmarks
    const ctrAnomaly = this.calculateCTRAnomaly(
      term.current.ctr,
      term.current.position,
      benchmarks
    );

    // Find matching dynamic patterns
    const matchedPatterns = this.checkDynamicPatterns(query);

    // Find similar known scam terms
    const similarScams = this.findSimilarScams(query);

    // Calculate composite risk score
    const riskScore = this.calculateRiskScore(term, ctrAnomaly, matchedPatterns, similarScams);

    // Determine risk level
    const riskLevel = this.getRiskLevel(riskScore);

    // Only return if there's meaningful risk
    if (riskScore < 20 && matchedPatterns.length === 0 && similarScams.length === 0) {
      return null;
    }

    return {
      id: uuidv4(),
      query: term.query,
      riskScore,
      riskLevel,
      ctrAnomaly,
      matchedPatterns,
      similarScams,
      current: term.current,
      previous: term.previous,
      change: {
        impressions: term.change.impressions,
        impressionsPercent: term.change.impressionsPercent,
        ctrDelta: term.current.ctr - term.previous.ctr,
      },
      isNew: term.isNew,
      firstSeen: new Date().toISOString(),
      status: 'pending',
    };
  }

  /**
   * Calculate CTR anomaly based on position benchmarks
   * KEY INSIGHT: Low CTR at good position = users clicking scam sites instead
   *
   * @param actualCTR The actual CTR from Search Console
   * @param position The average position for this query
   * @param benchmarks Dynamic benchmarks calculated from your actual data
   */
  calculateCTRAnomaly(actualCTR: number, position: number, benchmarks: CTRBenchmarks): CTRAnomaly {
    // Get benchmark for this position range
    let benchmarkKey: '1-3' | '4-8' | '9-15' | '16+';
    if (position <= 3) {
      benchmarkKey = '1-3';
    } else if (position <= 8) {
      benchmarkKey = '4-8';
    } else if (position <= 15) {
      benchmarkKey = '9-15';
    } else {
      benchmarkKey = '16+';
    }

    const benchmark = benchmarks[benchmarkKey];
    const expectedCTR = benchmark.expected;
    const minCTR = benchmark.min;

    // Calculate anomaly score (0-1)
    // Higher score = more anomalous (actual CTR much lower than expected)
    let anomalyScore = 0;
    if (actualCTR < expectedCTR) {
      anomalyScore = Math.min(1, (expectedCTR - actualCTR) / expectedCTR);
    }

    // Is it anomalous? (below minimum threshold for position)
    const isAnomalous = actualCTR < minCTR;

    return {
      expectedCTR,
      actualCTR,
      anomalyScore,
      isAnomalous,
    };
  }

  /**
   * Check for dynamic scam patterns (dollar amounts, years, urgency)
   */
  checkDynamicPatterns(query: string): string[] {
    const matched: string[] = [];

    // Check for dollar amounts
    const dollarMatch = query.match(DYNAMIC_PATTERNS.dollarAmount);
    if (dollarMatch) {
      matched.push(`DOLLAR_AMOUNT: ${dollarMatch[0]}`);
    }

    // Check for year references (future years are more suspicious)
    const yearMatch = query.match(DYNAMIC_PATTERNS.yearReference);
    if (yearMatch) {
      matched.push(`YEAR: ${yearMatch[0]}`);
    }

    // Check for urgency words
    const urgencyMatch = query.match(DYNAMIC_PATTERNS.urgencyWords);
    if (urgencyMatch) {
      matched.push(`URGENCY: ${urgencyMatch[0]}`);
    }

    // Check for free money patterns
    const freeMoneyMatch = query.match(DYNAMIC_PATTERNS.freeMoneyPattern);
    if (freeMoneyMatch) {
      matched.push(`FREE_MONEY: ${freeMoneyMatch[0]}`);
    }

    // Check for CRA context (needed for some patterns to be suspicious)
    const hasCraContext = DYNAMIC_PATTERNS.craContext.test(query);
    if (hasCraContext && matched.length > 0) {
      matched.unshift('CRA_CONTEXT');
    }

    return matched;
  }

  /**
   * Find known scam terms similar to this query
   * Uses fuzzy string matching with 70% similarity threshold
   */
  findSimilarScams(query: string): string[] {
    const config = this.scamDetectionService.getKeywordsConfig();
    const allScamTerms: string[] = [
      ...config.categories.fakeExpiredBenefits.terms,
      ...config.categories.illegitimatePaymentMethods.terms,
      ...config.categories.threatLanguage.terms,
    ];

    const similar: string[] = [];
    const queryLower = query.toLowerCase();

    for (const scamTerm of allScamTerms) {
      const similarity = stringSimilarity.compareTwoStrings(
        queryLower,
        scamTerm.toLowerCase()
      );

      if (similarity >= 0.7) {
        similar.push(`${scamTerm} (${Math.round(similarity * 100)}%)`);
      }
    }

    // Also check for shared keywords (at least 2 meaningful words in common)
    const queryWords = new Set(queryLower.split(/\s+/).filter(w => w.length > 2));
    for (const scamTerm of allScamTerms) {
      const scamWords = new Set(scamTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      const intersection = [...queryWords].filter(w => scamWords.has(w));

      if (intersection.length >= 2) {
        const matchStr = `${scamTerm} (shared: ${intersection.join(', ')})`;
        if (!similar.includes(matchStr)) {
          similar.push(matchStr);
        }
      }
    }

    return similar.slice(0, 5); // Limit to top 5
  }

  /**
   * Calculate composite risk score (0-100)
   *
   * Formula:
   *   ctrFactor (40%) + positionFactor (25%) + volumeFactor (20%) + emergenceFactor (15%)
   */
  calculateRiskScore(
    term: TermComparison,
    ctrAnomaly: CTRAnomaly,
    matchedPatterns: string[],
    similarScams: string[]
  ): number {
    // 1. CTR Factor (40% weight) - KEY SIGNAL
    // Low CTR at good position = users clicking elsewhere (scam sites)
    let ctrFactor = ctrAnomaly.anomalyScore;
    if (ctrAnomaly.isAnomalous) {
      ctrFactor = Math.min(1, ctrFactor + 0.3); // Boost if definitely anomalous
    }

    // 2. Position Factor (25% weight)
    // Good position + low clicks = very suspicious
    let positionFactor = 0;
    const position = term.current.position;
    const clicks = term.current.clicks;
    const impressions = term.current.impressions;

    if (position <= 3 && clicks < 50 && impressions > 100) {
      positionFactor = 0.9;
    } else if (position <= 8 && clicks < 20 && impressions > 50) {
      positionFactor = 0.7;
    } else if (position <= 15 && clicks < 10 && impressions > 30) {
      positionFactor = 0.5;
    }

    // 3. Volume Factor (20% weight)
    // Sudden spike in impressions
    let volumeFactor = 0;
    const impressionGrowth = term.change.impressionsPercent;
    if (impressionGrowth >= 300) {
      volumeFactor = 1.0;
    } else if (impressionGrowth >= 200) {
      volumeFactor = 0.8;
    } else if (impressionGrowth >= 100) {
      volumeFactor = 0.6;
    } else if (impressionGrowth >= 50) {
      volumeFactor = 0.3;
    }

    // 4. Emergence Factor (15% weight)
    // New terms appearing with volume are emerging threats
    let emergenceFactor = 0;
    if (term.isNew) {
      if (impressions > 100) {
        emergenceFactor = 0.9;
      } else if (impressions > 50) {
        emergenceFactor = 0.6;
      } else if (impressions > 20) {
        emergenceFactor = 0.3;
      }
    }

    // Calculate base score
    let score = (
      (ctrFactor * 0.40) +
      (positionFactor * 0.25) +
      (volumeFactor * 0.20) +
      (emergenceFactor * 0.15)
    ) * 100;

    // Boost for pattern matches
    if (matchedPatterns.length > 0) {
      const patternBoost = Math.min(20, matchedPatterns.length * 5);
      score += patternBoost;
    }

    // Boost for similar known scams
    if (similarScams.length > 0) {
      const similarBoost = Math.min(15, similarScams.length * 5);
      score += similarBoost;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Convert risk score to risk level
   */
  private getRiskLevel(score: number): RiskLevel {
    if (score >= 76) return 'critical';
    if (score >= 51) return 'high';
    if (score >= 31) return 'medium';
    return 'low';
  }
}
