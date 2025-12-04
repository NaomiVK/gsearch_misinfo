import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, searchconsole_v1 } from 'googleapis';
import { CacheService } from './cache.service';
import { environment } from '../environments/environment';
import {
  SearchAnalyticsRow,
  SearchAnalyticsQuery,
  DateRange,
} from '@cra-scam-detection/shared-types';
import * as path from 'path';

@Injectable()
export class SearchConsoleService implements OnModuleInit {
  private readonly logger = new Logger(SearchConsoleService.name);
  private searchConsole: searchconsole_v1.Searchconsole;
  private readonly siteUrl: string;
  private readonly craUrlFilters: string[];

  constructor(private readonly cacheService: CacheService) {
    this.siteUrl = environment.google.siteUrl;
    this.craUrlFilters = environment.google.craUrlFilters;
  }

  async onModuleInit() {
    await this.initializeClient();
  }

  /**
   * Initialize Google Search Console API client
   */
  private async initializeClient(): Promise<void> {
    try {
      const credentialsPath = path.resolve(
        process.cwd(),
        'service-account-credentials.json'
      );

      this.logger.log(`Loading credentials from: ${credentialsPath}`);

      const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });

      const authClient = await auth.getClient();
      this.searchConsole = google.searchconsole({
        version: 'v1',
        auth: authClient as Parameters<typeof google.searchconsole>[0]['auth'],
      });

      this.logger.log('Google Search Console client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Search Console client:', error);
      throw error;
    }
  }

  /**
   * Fetch search analytics data from Google Search Console
   */
  async getSearchAnalytics(
    query: SearchAnalyticsQuery
  ): Promise<SearchAnalyticsRow[]> {
    const cacheKey = `analytics:${JSON.stringify(query)}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const allRows: SearchAnalyticsRow[] = [];

        // Fetch data for each CRA URL filter
        for (const urlFilter of this.craUrlFilters) {
          try {
            const rows = await this.fetchWithPagination(query, urlFilter);
            allRows.push(...rows);
          } catch (error) {
            this.logger.warn(
              `Error fetching data for filter ${urlFilter}:`,
              error
            );
          }
        }

        // Deduplicate by query (aggregate impressions/clicks for same query)
        return this.aggregateByQuery(allRows);
      },
      environment.cache.analyticsTtl
    );
  }

  /**
   * Fetch data with pagination support
   */
  private async fetchWithPagination(
    query: SearchAnalyticsQuery,
    urlFilter: string
  ): Promise<SearchAnalyticsRow[]> {
    const allRows: SearchAnalyticsRow[] = [];
    const rowLimit = query.rowLimit || 25000;
    let startRow = 0;

    while (true) {
      const response = await this.searchConsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: query.startDate,
          endDate: query.endDate,
          dimensions: query.dimensions || ['query'],
          dimensionFilterGroups: [
            {
              groupType: 'and',
              filters: [
                {
                  dimension: 'page',
                  operator: 'contains',
                  expression: urlFilter,
                },
              ],
            },
          ],
          rowLimit: Math.min(rowLimit, 25000),
          startRow,
        },
      });

      const rows = response.data.rows || [];
      if (rows.length === 0) break;

      allRows.push(
        ...rows.map((row) => ({
          keys: row.keys || [],
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        }))
      );

      if (rows.length < 25000) break;
      startRow += 25000;
    }

    return allRows;
  }

  /**
   * Aggregate rows by query (combine data from multiple URL filters)
   */
  private aggregateByQuery(rows: SearchAnalyticsRow[]): SearchAnalyticsRow[] {
    const queryMap = new Map<string, SearchAnalyticsRow>();

    for (const row of rows) {
      const query = row.keys[0]?.toLowerCase() || '';
      const existing = queryMap.get(query);

      if (existing) {
        // Aggregate metrics
        const totalImpressions = existing.impressions + row.impressions;
        const totalClicks = existing.clicks + row.clicks;

        existing.impressions = totalImpressions;
        existing.clicks = totalClicks;
        existing.ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
        // Weighted average position
        existing.position =
          (existing.position * existing.impressions +
            row.position * row.impressions) /
          totalImpressions;
      } else {
        queryMap.set(query, { ...row, keys: [query] });
      }
    }

    return Array.from(queryMap.values());
  }

  /**
   * Get search analytics for a specific date range (convenience method)
   */
  async getAnalyticsForDateRange(
    dateRange: DateRange
  ): Promise<SearchAnalyticsRow[]> {
    return this.getSearchAnalytics({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dimensions: ['query'],
      rowLimit: 25000,
    });
  }

  /**
   * Get queries with minimum impression threshold
   */
  async getQueriesAboveThreshold(
    dateRange: DateRange,
    minImpressions: number = environment.scamDetection.impressionThreshold
  ): Promise<SearchAnalyticsRow[]> {
    const allData = await this.getAnalyticsForDateRange(dateRange);
    return allData.filter((row) => row.impressions >= minImpressions);
  }

  /**
   * Get date range for last N days
   */
  static getDateRange(days: number): DateRange {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // GSC data has 2-day lag

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }
}
