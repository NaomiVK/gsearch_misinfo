import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ScamDetectionService } from '../services/scam-detection.service';
import { SearchConsoleService } from '../services/search-console.service';
import { DateRange } from '@cra-scam-detection/shared-types';
import { environment } from '../environments/environment';

@Controller('scams')
export class ScamsController {
  private readonly logger = new Logger(ScamsController.name);

  constructor(
    private readonly scamDetectionService: ScamDetectionService,
    private readonly searchConsoleService: SearchConsoleService
  ) {}

  /**
   * GET /api/scams/detect
   * Run scam detection analysis for a date range
   */
  @Get('detect')
  async detectScams(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('days') days?: string
  ) {
    let dateRange: DateRange;

    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      const daysNum = days
        ? parseInt(days, 10)
        : environment.scamDetection.defaultDateRangeDays;
      dateRange = SearchConsoleService.getDateRange(daysNum);
    }

    this.logger.log(
      \`Running scam detection for \${dateRange.startDate} to \${dateRange.endDate}\`
    );

    const result = await this.scamDetectionService.detectScams(dateRange);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/scams/flagged
   * Get flagged terms (alias for detect, for clearer API)
   */
  @Get('flagged')
  async getFlaggedTerms(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('days') days?: string,
    @Query('severity') severity?: string
  ) {
    let dateRange: DateRange;

    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      const daysNum = days
        ? parseInt(days, 10)
        : environment.scamDetection.defaultDateRangeDays;
      dateRange = SearchConsoleService.getDateRange(daysNum);
    }

    const result = await this.scamDetectionService.detectScams(dateRange);

    // Filter by severity if specified
    let flaggedTerms = result.flaggedTerms;
    if (severity) {
      const severities = severity.split(',').map((s) => s.trim().toLowerCase());
      flaggedTerms = flaggedTerms.filter((t) =>
        severities.includes(t.severity)
      );
    }

    return {
      success: true,
      data: {
        period: result.period,
        flaggedTerms,
        summary: result.summary,
      },
    };
  }

  /**
   * GET /api/scams/keywords
   * Get the current scam keywords configuration
   */
  @Get('keywords')
  async getKeywordsConfig() {
    const config = this.scamDetectionService.getKeywordsConfig();

    return {
      success: true,
      data: config,
    };
  }

  /**
   * GET /api/scams/dashboard
   * Get dashboard summary data
   */
  @Get('dashboard')
  async getDashboardData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('days') days?: string
  ) {
    let dateRange: DateRange;

    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      const daysNum = days
        ? parseInt(days, 10)
        : environment.scamDetection.defaultDateRangeDays;
      dateRange = SearchConsoleService.getDateRange(daysNum);
    }

    const detection = await this.scamDetectionService.detectScams(dateRange);

    // Get critical alerts (critical severity terms)
    const criticalAlerts = detection.flaggedTerms
      .filter((t) => t.severity === 'critical')
      .slice(0, 10);

    // Get new terms (status === 'new')
    const newTerms = detection.flaggedTerms
      .filter((t) => t.status === 'new')
      .slice(0, 10);

    // Get trending terms (highest impressions for now)
    const trendingTerms = [...detection.flaggedTerms]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    return {
      success: true,
      data: {
        summary: detection.summary,
        flaggedTerms: detection.flaggedTerms,
        criticalAlerts,
        newTerms,
        trendingTerms,
        totalQueriesAnalyzed: detection.totalQueriesAnalyzed,
        period: dateRange,
      },
    };
  }
}
