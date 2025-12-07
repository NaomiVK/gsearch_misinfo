import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbNavModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../services/api.service';
import {
  EmergingThreat,
  EmergingThreatsResponse,
  ScamKeywordsConfig,
  KeywordCategory,
} from '@cra-scam-detection/shared-types';

type CategoryKey = 'fakeExpiredBenefits' | 'illegitimatePaymentMethods' | 'threatLanguage' | 'suspiciousModifiers';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbNavModule, NgbTooltipModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);

  activeTab = signal(1);
  loading = signal(false);
  error = signal<string | null>(null);

  emergingThreats = signal<EmergingThreatsResponse | null>(null);
  keywordsConfig = signal<ScamKeywordsConfig | null>(null);
  selectedDays = signal(7);
  selectedCategory = signal('fakeExpiredBenefits');
  newKeyword = signal('');
  newWhitelistPattern = signal('');

  ngOnInit(): void {
    this.loadEmergingThreats();
    this.loadKeywordsConfig();
  }

  loadEmergingThreats(): void {
    this.loading.set(true);
    this.api.getEmergingThreats(this.selectedDays()).subscribe({
      next: (res) => {
        if (res.success) {
          this.emergingThreats.set(res.data);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load emerging threats');
        this.loading.set(false);
        console.error(err);
      },
    });
  }

  loadKeywordsConfig(): void {
    this.api.getKeywordsConfig().subscribe({
      next: (res) => {
        if (res.success) {
          this.keywordsConfig.set(res.data);
        }
      },
      error: (err) => {
        console.error('Failed to load keywords config', err);
      },
    });
  }

  onDaysChange(): void {
    this.loadEmergingThreats();
  }

  getRiskClass(level: string): string {
    switch (level) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'secondary';
    }
  }

  addToKeywords(threat: EmergingThreat): void {
    const category = this.promptCategory();
    if (!category) return;

    this.api.addKeyword(threat.query, category).subscribe({
      next: () => {
        this.loadKeywordsConfig();
        this.loadEmergingThreats();
      },
      error: (err) => console.error('Failed to add keyword', err),
    });
  }

  addToWhitelist(threat: EmergingThreat): void {
    this.api.addWhitelist(threat.query).subscribe({
      next: () => {
        this.loadKeywordsConfig();
        this.loadEmergingThreats();
      },
      error: (err) => console.error('Failed to add to whitelist', err),
    });
  }

  dismissThreat(threat: EmergingThreat): void {
    this.api.dismissThreat(threat.id).subscribe({
      next: () => this.loadEmergingThreats(),
      error: (err) => console.error('Failed to dismiss', err),
    });
  }

  private promptCategory(): string | null {
    const options = [
      'fakeExpiredBenefits',
      'illegitimatePaymentMethods',
      'threatLanguage',
      'suspiciousModifiers',
    ];
    const choice = prompt(
      `Select category:\n1. Fake/Expired Benefits\n2. Illegitimate Payment Methods\n3. Threat Language\n4. Suspicious Modifiers\n\nEnter number (1-4):`
    );
    if (choice && ['1', '2', '3', '4'].includes(choice)) {
      return options[parseInt(choice, 10) - 1];
    }
    return null;
  }

  addKeyword(): void {
    const term = this.newKeyword().trim();
    if (!term) return;

    this.api.addKeyword(term, this.selectedCategory()).subscribe({
      next: () => {
        this.newKeyword.set('');
        this.loadKeywordsConfig();
      },
      error: (err) => console.error('Failed to add keyword', err),
    });
  }

  addWhitelistPattern(): void {
    const pattern = this.newWhitelistPattern().trim();
    if (!pattern) return;

    this.api.addWhitelist(pattern).subscribe({
      next: () => {
        this.newWhitelistPattern.set('');
        this.loadKeywordsConfig();
      },
      error: (err) => console.error('Failed to add whitelist pattern', err),
    });
  }

  getCategoryDisplayName(key: string): string {
    const names: Record<string, string> = {
      fakeExpiredBenefits: 'Fake/Expired Benefits',
      illegitimatePaymentMethods: 'Illegitimate Payment Methods',
      threatLanguage: 'Threat Language',
      suspiciousModifiers: 'Suspicious Modifiers',
    };
    return names[key] || key;
  }

  getCategory(config: ScamKeywordsConfig, key: CategoryKey): KeywordCategory {
    return config.categories[key];
  }

  categoryKeys: CategoryKey[] = ['fakeExpiredBenefits', 'illegitimatePaymentMethods', 'threatLanguage', 'suspiciousModifiers'];
}
