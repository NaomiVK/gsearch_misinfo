import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { ScamDetectionService } from './scam-detection.service';
import {
  TrendDataPoint,
  InterestOverTime,
  TrendExploration,
  TrendsPanelData,
} from '@cra-scam-detection/shared-types';
import { environment } from '../environments/environment';

// Using require for google-trends-api as it doesn't have proper TS types
const googleTrends = require('google-trends-api');

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly scamDetectionService: ScamDetectionService
  ) {}

  /**
   * Get interest over time for a keyword
   */
  async getInterestOverTime(
    keyword: string,
    timeRange = 'today 3-m'
  ): Promise<InterestOverTime | null> {
    const cacheKey = `trends:interest:${keyword}:${timeRange}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const result = await googleTrends.interestOverTime({
            keyword,
            geo: 'CA',
            time: timeRange,
          });

          const parsed = JSON.parse(result);
          const timelineData = parsed.default?.timelineData || [];

          const data: TrendDataPoint[] = timelineData.map(
            (point: { formattedTime: string; value: number[] }) => ({
              date: point.formattedTime,
              value: point.value[0] || 0,
            })
          );

          const averageInterest =
            data.length > 0
              ? data.reduce((sum, p) => sum + p.value, 0) / data.length
              : 0;

          return {
            keyword,
            data,
            averageInterest,
          };
        } catch (error) {
          this.logger.warn(
            `Failed to fetch trends for "${keyword}": ${error.message}`
          );
          return null;
        }
      },
      environment.cache.trendsTtl
    );
  }

  /**
   * Get related queries for a keyword
   */
  async getRelatedQueries(
    keyword: string
  ): Promise<{ rising: string[]; top: string[] } | null> {
    const cacheKey = `trends:related:${keyword}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const result = await googleTrends.relatedQueries({
            keyword,
            geo: 'CA',
          });

          const parsed = JSON.parse(result);
          const defaultData = parsed.default || {};

          const rising =
            defaultData.rankedList?.[0]?.rankedKeyword?.map(
              (item: { query: string }) => item.query
            ) || [];

          const top =
            defaultData.rankedList?.[1]?.rankedKeyword?.map(
              (item: { query: string }) => item.query
            ) || [];

          return { rising, top };
        } catch (error) {
          this.logger.warn(
            `Failed to fetch related queries for "${keyword}": ${error.message}`
          );
          return null;
        }
      },
      environment.cache.trendsTtl
    );
  }

  /**
   * Explore a keyword (combined interest + related)
   */
  async exploreKeyword(keyword: string): Promise<TrendExploration | null> {
    const cacheKey = `trends:explore:${keyword}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const [interest, related] = await Promise.all([
            this.getInterestOverTime(keyword),
            this.getRelatedQueries(keyword),
          ]);

          if (!interest) return null;

          return {
            keyword,
            geo: 'CA',
            timeRange: 'today 3-m',
            interestOverTime: interest.data,
            relatedQueries: {
              rising: (related?.rising || []).map((q) => ({
                query: q,
                value: 0,
                isBreakout: false,
              })),
              top: (related?.top || []).map((q) => ({
                query: q,
                value: 0,
                isBreakout: false,
              })),
            },
          };
        } catch (error) {
          this.logger.error(`Failed to explore keyword "${keyword}":`, error);
          return null;
        }
      },
      environment.cache.trendsTtl
    );
  }

  /**
   * Get trends data for all monitored scam keywords
   */
  async getScamKeywordsTrends(): Promise<TrendsPanelData> {
    const cacheKey = 'trends:scam-panel';

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const keywords = this.scamDetectionService.getTrendsKeywords();
        const monitoredKeywords: TrendsPanelData['monitoredKeywords'] = [];

        // Fetch trends for each keyword (with rate limiting)
        for (const keyword of keywords.slice(0, 10)) {
          // Limit to 10 to avoid rate limits
          try {
            const interest = await this.getInterestOverTime(keyword);
            if (interest && interest.data.length > 0) {
              const recent = interest.data.slice(-7); // Last 7 data points
              const older = interest.data.slice(-14, -7);

              const recentAvg =
                recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
              const olderAvg =
                older.length > 0
                  ? older.reduce((sum, p) => sum + p.value, 0) / older.length
                  : recentAvg;

              const changePercent =
                olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

              monitoredKeywords.push({
                keyword,
                currentInterest: Math.round(recentAvg),
                trend:
                  changePercent > 10
                    ? 'up'
                    : changePercent < -10
                      ? 'down'
                      : 'stable',
                changePercent: Math.round(changePercent),
              });
            }

            // Small delay to avoid rate limiting
            await this.delay(500);
          } catch (error) {
            this.logger.warn(`Skipping trend for "${keyword}": ${error.message}`);
          }
        }

        return {
          lastUpdated: new Date().toISOString(),
          monitoredKeywords,
          risingQueries: [], // Could be populated from related queries
          correlationAlerts: [], // Would need Search Console data to correlate
        };
      },
      environment.cache.trendsTtl
    );
  }

  /**
   * Helper to add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
