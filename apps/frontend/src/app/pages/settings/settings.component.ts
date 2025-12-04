import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbAccordionModule, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';

type KeywordCategory = {
  name: string;
  displayName: string;
  severity: string;
  terms: string[];
  mustContain?: string[];
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbAccordionModule, NgbNavModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  activeTab = signal(1);

  // Note: In production, these would be fetched from and saved to the API
  // For now, this serves as a reference for the configuration structure
  categories = signal<KeywordCategory[]>([
    {
      name: 'fakeExpiredBenefits',
      displayName: 'Fake/Expired Benefits',
      severity: 'critical',
      terms: [
        'grocery rebate 2024',
        'grocery rebate 2025',
        'inflation relief payment',
        'carbon tax rebate scam',
        'cra benefit payment',
        'emergency benefit 2024',
        'covid benefit 2024',
        'cerb repayment scam',
      ],
    },
    {
      name: 'illegitimatePaymentMethods',
      displayName: 'Illegitimate Payment Methods',
      severity: 'critical',
      mustContain: ['cra', 'canada revenue', 'tax', 'revenue agency'],
      terms: [
        'gift card',
        'bitcoin',
        'cryptocurrency',
        'e-transfer',
        'etransfer',
        'interac',
        'western union',
        'money order',
        'itunes',
        'google play card',
        'steam card',
        'amazon card',
        'whatsapp',
        'text message',
        'sms',
      ],
    },
    {
      name: 'threatLanguage',
      displayName: 'Threat Language',
      severity: 'high',
      mustContain: ['cra', 'canada revenue', 'tax', 'revenue agency'],
      terms: [
        'arrest',
        'warrant',
        'police',
        'deportation',
        'jail',
        'lawsuit',
        'legal action',
        'immediate payment',
        'pay now or',
      ],
    },
    {
      name: 'suspiciousModifiers',
      displayName: 'Suspicious Modifiers',
      severity: 'medium',
      terms: [
        'claim now',
        'urgent',
        'free money',
        'secret',
        'limited time',
        'act fast',
        'expires today',
        'final notice',
        'last chance',
      ],
    },
  ]);

  whitelist = signal<string[]>([
    'cra login',
    'cra my account',
    'cra contact',
    'cra phone number',
    'cra hours',
    'cra address',
    'how to file taxes',
    'tax deadline',
    'rrsp contribution',
    'tfsa limit',
    't4 slip',
    'notice of assessment',
  ]);

  newTerm = signal('');
  newWhitelistTerm = signal('');
  selectedCategory = signal('fakeExpiredBenefits');

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  addTerm(): void {
    const term = this.newTerm().trim().toLowerCase();
    if (!term) return;

    const categoryName = this.selectedCategory();
    const categories = this.categories();
    const category = categories.find((c) => c.name === categoryName);

    if (category && !category.terms.includes(term)) {
      category.terms.push(term);
      this.categories.set([...categories]);
      this.newTerm.set('');
    }
  }

  removeTerm(categoryName: string, term: string): void {
    const categories = this.categories();
    const category = categories.find((c) => c.name === categoryName);

    if (category) {
      category.terms = category.terms.filter((t) => t !== term);
      this.categories.set([...categories]);
    }
  }

  addWhitelistTerm(): void {
    const term = this.newWhitelistTerm().trim().toLowerCase();
    if (!term) return;

    const whitelist = this.whitelist();
    if (!whitelist.includes(term)) {
      this.whitelist.set([...whitelist, term]);
      this.newWhitelistTerm.set('');
    }
  }

  removeWhitelistTerm(term: string): void {
    this.whitelist.set(this.whitelist().filter((t) => t !== term));
  }

  exportConfig(): void {
    const config = {
      version: '1.0.0',
      categories: this.categories().reduce(
        (acc, cat) => {
          acc[cat.name] = {
            severity: cat.severity,
            terms: cat.terms,
            ...(cat.mustContain && { mustContain: cat.mustContain }),
          };
          return acc;
        },
        {} as Record<string, unknown>
      ),
      whitelist: {
        patterns: this.whitelist(),
      },
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scam-keywords.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
