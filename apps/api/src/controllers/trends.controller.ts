import { Controller, Get, Query, Logger } from '@nestjs/common';
import { TrendsService } from '../services/trends.service';

@Controller('trends')
export class TrendsController {
  private readonly logger = new Logger(TrendsController.name);

  constructor(private readonly trendsService: TrendsService) {}

  /**
   * GET /api/trends/explore
   * Explore interest over time for a specific keyword
   */
  @Get('explore')
  async exploreKeyword(@Query('keyword') keyword: string) {
    if (!keyword) {
      return {
        success: false,
        error: 'Missing required parameter: keyword',
      };
    }

    this.logger.log(`Exploring trends for keyword: ${keyword}`);

    const result = await this.trendsService.exploreKeyword(keyword);

    if (!result) {
      return {
        success: false,
        error: 'Failed to fetch trends data. The service may be rate limited.',
      };
    }

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/trends/interest
   * Get interest over time for a keyword
   */
  @Get('interest')
  async getInterestOverTime(
    @Query('keyword') keyword: string,
    @Query('timeRange') timeRange?: string
  ) {
    if (!keyword) {
      return {
        success: false,
        error: 'Missing required parameter: keyword',
      };
    }

    const result = await this.trendsService.getInterestOverTime(
      keyword,
      timeRange || 'today 3-m'
    );

    if (!result) {
      return {
        success: false,
        error: 'Failed to fetch interest data',
      };
    }

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/trends/related
   * Get related queries for a keyword
   */
  @Get('related')
  async getRelatedQueries(@Query('keyword') keyword: string) {
    if (!keyword) {
      return {
        success: false,
        error: 'Missing required parameter: keyword',
      };
    }

    const result = await this.trendsService.getRelatedQueries(keyword);

    if (!result) {
      return {
        success: false,
        error: 'Failed to fetch related queries',
      };
    }

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/trends/scam-keywords
   * Get trends data for all monitored scam keywords
   */
  @Get('scam-keywords')
  async getScamKeywordsTrends() {
    this.logger.log('Fetching trends for scam keywords');

    const result = await this.trendsService.getScamKeywordsTrends();

    return {
      success: true,
      data: result,
    };
  }
}
