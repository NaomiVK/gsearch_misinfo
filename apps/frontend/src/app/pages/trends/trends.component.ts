import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { TrendsResult } from '@cra-scam-detection/shared-types';

@Component({
  selector: 'app-trends',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trends.component.html',
  styleUrl: './trends.component.scss',
})
export class TrendsComponent implements OnInit {
  private readonly api = inject(ApiService);

  loading = signal(true);
  error = signal<string | null>(null);
  trendsData = signal<TrendsResult | null>(null);

  // Custom keyword search
  customKeywords = signal('');

  ngOnInit(): void {
    this.loadScamKeywordTrends();
  }

  async loadScamKeywordTrends(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.getScamKeywordTrends().toPromise();
      if (response?.success && response.data) {
        this.trendsData.set(response.data);
      } else {
        this.error.set(response?.error || 'Failed to load trends data');
      }
    } catch (err) {
      this.error.set('Failed to connect to API or Google Trends');
      console.error('Trends load error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async searchCustomKeywords(): Promise<void> {
    const keywords = this.customKeywords()
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.getTrends(keywords).toPromise();
      if (response?.success && response.data) {
        this.trendsData.set(response.data);
      } else {
        this.error.set(response?.error || 'Failed to load trends data');
      }
    } catch (err) {
      this.error.set('Failed to connect to API');
      console.error('Trends search error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  getInterestClass(value: number): string {
    if (value >= 75) return 'bg-danger';
    if (value >= 50) return 'bg-warning';
    if (value >= 25) return 'bg-info';
    return 'bg-secondary';
  }
}
