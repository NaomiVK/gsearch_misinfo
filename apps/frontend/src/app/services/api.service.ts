import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DashboardData,
  ScamDetectionResult,
  ComparisonResult,
  TrendsResult,
  FlaggedTerm,
  DateRange,
  ExportData,
} from '@cra-scam-detection/shared-types';
import { environment } from '../../environments/environment';

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Fetch dashboard data
   */
  getDashboard(dateRange?: DateRange): Observable<ApiResponse<DashboardData>> {
    let params = new HttpParams();
    if (dateRange) {
      params = params
        .set('startDate', dateRange.startDate)
        .set('endDate', dateRange.endDate);
    }
    return this.http.get<ApiResponse<DashboardData>>(
      `${this.baseUrl}/scams/dashboard`,
      { params }
    );
  }

  /**
   * Detect scams
   */
  detectScams(dateRange?: DateRange): Observable<ApiResponse<ScamDetectionResult>> {
    let params = new HttpParams();
    if (dateRange) {
      params = params
        .set('startDate', dateRange.startDate)
        .set('endDate', dateRange.endDate);
    }
    return this.http.get<ApiResponse<ScamDetectionResult>>(
      `${this.baseUrl}/scams/detect`,
      { params }
    );
  }

  /**
   * Get flagged terms with filtering
   */
  getFlaggedTerms(options?: {
    severity?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<ApiResponse<FlaggedTerm[]>> {
    let params = new HttpParams();
    if (options?.severity) params = params.set('severity', options.severity);
    if (options?.status) params = params.set('status', options.status);
    if (options?.startDate) params = params.set('startDate', options.startDate);
    if (options?.endDate) params = params.set('endDate', options.endDate);

    return this.http.get<ApiResponse<FlaggedTerm[]>>(
      `${this.baseUrl}/scams/flagged`,
      { params }
    );
  }

  /**
   * Get comparison data
   */
  getComparison(
    period1: DateRange,
    period2: DateRange
  ): Observable<ApiResponse<ComparisonResult>> {
    const params = new HttpParams()
      .set('period1Start', period1.startDate)
      .set('period1End', period1.endDate)
      .set('period2Start', period2.startDate)
      .set('period2End', period2.endDate);

    return this.http.get<ApiResponse<ComparisonResult>>(
      `${this.baseUrl}/comparison/period`,
      { params }
    );
  }

  /**
   * Get week-over-week comparison
   */
  getWeekOverWeek(): Observable<ApiResponse<ComparisonResult>> {
    return this.http.get<ApiResponse<ComparisonResult>>(
      `${this.baseUrl}/comparison/week-over-week`
    );
  }

  /**
   * Get trends data
   */
  getTrends(keywords: string[]): Observable<ApiResponse<TrendsResult>> {
    const params = new HttpParams().set('keywords', keywords.join(','));
    return this.http.get<ApiResponse<TrendsResult>>(
      `${this.baseUrl}/trends/explore`,
      { params }
    );
  }

  /**
   * Get scam keyword trends
   */
  getScamKeywordTrends(): Observable<ApiResponse<TrendsResult>> {
    return this.http.get<ApiResponse<TrendsResult>>(
      `${this.baseUrl}/trends/scam-keywords`
    );
  }

  /**
   * Export data as JSON
   */
  exportJson(dateRange?: DateRange): Observable<ApiResponse<ExportData>> {
    let params = new HttpParams();
    if (dateRange) {
      params = params
        .set('startDate', dateRange.startDate)
        .set('endDate', dateRange.endDate);
    }
    return this.http.get<ApiResponse<ExportData>>(
      `${this.baseUrl}/export/json`,
      { params }
    );
  }

  /**
   * Download CSV export
   */
  downloadCsv(dateRange?: DateRange): void {
    let url = `${this.baseUrl}/export/csv`;
    if (dateRange) {
      url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
    }
    window.open(url, '_blank');
  }

  /**
   * Download Excel export
   */
  downloadExcel(dateRange?: DateRange): void {
    let url = `${this.baseUrl}/export/excel`;
    if (dateRange) {
      url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
    }
    window.open(url, '_blank');
  }
}
