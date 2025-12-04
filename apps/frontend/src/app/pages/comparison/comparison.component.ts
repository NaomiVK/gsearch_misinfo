import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../services/api.service';
import { ComparisonResult, DateRange } from '@cra-scam-detection/shared-types';

@Component({
  selector: 'app-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbDatepickerModule],
  templateUrl: './comparison.component.html',
  styleUrl: './comparison.component.scss',
})
export class ComparisonComponent implements OnInit {
  private readonly api = inject(ApiService);

  loading = signal(true);
  error = signal<string | null>(null);
  comparisonData = signal<ComparisonResult | null>(null);

  // Default to week-over-week
  period1 = signal<DateRange>(this.getLastWeek());
  period2 = signal<DateRange>(this.getPreviousWeek());

  ngOnInit(): void {
    this.loadWeekOverWeek();
  }

  async loadWeekOverWeek(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.getWeekOverWeek().toPromise();
      if (response?.success && response.data) {
        this.comparisonData.set(response.data);
      } else {
        this.error.set(response?.error || 'Failed to load comparison data');
      }
    } catch (err) {
      this.error.set('Failed to connect to API');
      console.error('Comparison load error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadCustomComparison(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api
        .getComparison(this.period1(), this.period2())
        .toPromise();
      if (response?.success && response.data) {
        this.comparisonData.set(response.data);
      } else {
        this.error.set(response?.error || 'Failed to load comparison data');
      }
    } catch (err) {
      this.error.set('Failed to connect to API');
      console.error('Comparison load error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  getChangeClass(change: number): string {
    if (change > 0) return 'text-danger';
    if (change < 0) return 'text-success';
    return 'text-muted';
  }

  getChangeIcon(change: number): string {
    if (change > 0) return 'bi-arrow-up';
    if (change < 0) return 'bi-arrow-down';
    return 'bi-dash';
  }

  formatChange(change: number): string {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }

  private getLastWeek(): DateRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
    };
  }

  private getPreviousWeek(): DateRange {
    const end = new Date();
    end.setDate(end.getDate() - 7);
    const start = new Date();
    start.setDate(start.getDate() - 14);
    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
