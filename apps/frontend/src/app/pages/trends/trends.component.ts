import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { TrendsResult } from '@cra-scam-detection/shared-types';
import { NgApexchartsModule, ChartComponent, ApexChart, ApexXAxis, ApexYAxis, ApexStroke, ApexTooltip, ApexDataLabels, ApexLegend, ApexFill, ApexGrid, ApexMarkers } from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  legend: ApexLegend;
  fill: ApexFill;
  grid: ApexGrid;
  markers: ApexMarkers;
  colors: string[];
};

type TimePeriod = {
  label: string;
  value: string;
  description: string;
};

@Component({
  selector: 'app-trends',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './trends.component.html',
  styleUrl: './trends.component.scss',
})
export class TrendsComponent implements OnInit {
  @ViewChild('chart') chart!: ChartComponent;
  
  private readonly api = inject(ApiService);

  loading = signal(true);
  error = signal<string | null>(null);
  trendsData = signal<TrendsResult | null>(null);
  
  // Search term
  searchTerm = signal('');
  currentSearchTerm = signal('');
  
  // Time period selection
  selectedTimePeriod = signal<string>('today 3-m');
  timePeriods: TimePeriod[] = [
    { label: 'Past hour', value: 'now 1-H', description: 'Last 60 minutes' },
    { label: 'Past 4 hours', value: 'now 4-H', description: 'Last 4 hours' },
    { label: 'Past day', value: 'now 1-d', description: 'Last 24 hours' },
    { label: 'Past 7 days', value: 'now 7-d', description: 'Last week' },
    { label: 'Past 30 days', value: 'today 1-m', description: 'Last month' },
    { label: 'Past 90 days', value: 'today 3-m', description: 'Last 3 months' },
    { label: 'Past 12 months', value: 'today 12-m', description: 'Last year' },
    { label: 'Past 5 years', value: 'today 5-y', description: 'Last 5 years' },
  ];
  
  // Chart options
  chartOptions: Partial<ChartOptions> = {
    series: [],
    chart: {
      type: 'area',
      height: 350,
      fontFamily: 'inherit',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      animations: {
        enabled: true,
        speed: 500,
      },
    },
    colors: ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01'],
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 90, 100],
      },
    },
    xaxis: {
      type: 'category',
      labels: {
        rotate: -45,
        style: {
          fontSize: '11px',
        },
      },
    },
    yaxis: {
      min: 0,
      max: 100,
      title: {
        text: 'Interest',
        style: {
          fontSize: '12px',
        },
      },
      labels: {
        formatter: (val: number) => val.toFixed(0),
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number) => `${val} interest`,
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
    },
    grid: {
      borderColor: '#e7e7e7',
      row: {
        colors: ['#f3f3f3', 'transparent'],
        opacity: 0.5,
      },
    },
    markers: {
      size: 0,
      hover: {
        size: 5,
      },
    },
  };

  ngOnInit(): void {
    this.loadScamKeywordTrends();
  }

  async loadScamKeywordTrends(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.currentSearchTerm.set('Monitored Scam Keywords');

    try {
      const response = await this.api.getScamKeywordTrends().toPromise();
      if (response?.success && response.data) {
        this.trendsData.set(response.data);
        this.updateChart(response.data);
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

  async searchTrends(): Promise<void> {
    const term = this.searchTerm().trim();

    if (term.length === 0) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.currentSearchTerm.set(term);

    try {
      console.log(`Searching trends for "${term}" with timeRange: ${this.selectedTimePeriod()}`);
      const response = await this.api.getTrends([term], this.selectedTimePeriod()).toPromise();
      console.log('Trends API response:', JSON.stringify(response, null, 2));
      if (response?.success && response.data) {
        console.log('Success - data received with', response.data.interestOverTime?.length, 'data points');
        this.trendsData.set(response.data);
        this.updateChart(response.data);
      } else {
        console.error('API returned error:', response?.error, 'Full response:', response);
        this.error.set(response?.error || 'Failed to load trends data');
      }
    } catch (err: unknown) {
      console.error('Trends search exception:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.error.set(`Failed to connect to API: ${errorMessage}`);
    } finally {
      this.loading.set(false);
    }
  }

  onTimePeriodChange(): void {
    if (this.currentSearchTerm() && this.currentSearchTerm() !== 'Monitored Scam Keywords') {
      this.searchTrends();
    }
  }

  updateChart(data: TrendsResult): void {
    if (!data.interestOverTime || data.interestOverTime.length === 0) {
      this.chartOptions.series = [];
      return;
    }

    const series = data.keywords.map((keyword) => ({
      name: keyword,
      data: data.interestOverTime.map((point) => point.values[keyword] || 0),
    }));

    const categories = data.interestOverTime.map((point) => point.date);

    this.chartOptions = {
      ...this.chartOptions,
      series,
      xaxis: {
        ...this.chartOptions.xaxis,
        categories,
      },
    };
  }

  getInterestLevel(value: number): { label: string; class: string } {
    if (value >= 75) return { label: 'Very High', class: 'bg-danger' };
    if (value >= 50) return { label: 'High', class: 'bg-warning' };
    if (value >= 25) return { label: 'Medium', class: 'bg-info' };
    return { label: 'Low', class: 'bg-secondary' };
  }

  getSelectedTimePeriodLabel(): string {
    return this.timePeriods.find(p => p.value === this.selectedTimePeriod())?.label || 'Past 90 days';
  }

  getPeakInterest(): number {
    const data = this.trendsData();
    if (!data?.interestOverTime) return 0;
    
    let peak = 0;
    data.interestOverTime.forEach(point => {
      Object.values(point.values).forEach(val => {
        if (val > peak) peak = val;
      });
    });
    return peak;
  }

  getAverageInterest(): number {
    const data = this.trendsData();
    if (!data?.interestOverTime || data.interestOverTime.length === 0) return 0;

    let sum = 0;
    let count = 0;
    data.interestOverTime.forEach(point => {
      Object.values(point.values).forEach(val => {
        sum += val;
        count++;
      });
    });
    return count > 0 ? Math.round(sum / count) : 0;
  }

  getTrendDirection(): { label: string; icon: string; class: string } {
    const data = this.trendsData();
    if (!data?.interestOverTime || data.interestOverTime.length < 2) {
      return { label: 'N/A', icon: 'bi-dash', class: 'text-muted' };
    }

    const points = data.interestOverTime;
    const midpoint = Math.floor(points.length / 2);

    // Calculate average of first half vs second half
    let firstHalfSum = 0, firstHalfCount = 0;
    let secondHalfSum = 0, secondHalfCount = 0;

    points.forEach((point, index) => {
      Object.values(point.values).forEach(val => {
        if (index < midpoint) {
          firstHalfSum += val;
          firstHalfCount++;
        } else {
          secondHalfSum += val;
          secondHalfCount++;
        }
      });
    });

    const firstHalfAvg = firstHalfCount > 0 ? firstHalfSum / firstHalfCount : 0;
    const secondHalfAvg = secondHalfCount > 0 ? secondHalfSum / secondHalfCount : 0;
    const change = secondHalfAvg - firstHalfAvg;
    const percentChange = firstHalfAvg > 0 ? (change / firstHalfAvg) * 100 : 0;

    if (percentChange > 10) {
      return { label: 'Rising', icon: 'bi-arrow-up', class: 'text-danger' };
    } else if (percentChange < -10) {
      return { label: 'Falling', icon: 'bi-arrow-down', class: 'text-success' };
    } else {
      return { label: 'Stable', icon: 'bi-arrow-right', class: 'text-info' };
    }
  }
}
