import { expect, type Locator, type Page, type Response } from '@playwright/test';

const settingsPath = '/api/v1/distribution-settings';

export class SettingsPage {
  readonly heading: Locator;
  readonly saveButton: Locator;
  readonly roundRobinResetRule: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Distribution Settings' });
    this.saveButton = page.getByRole('button', { name: /Save Settings/ });
    this.roundRobinResetRule = page
      .locator('ccl-form-field-wrapper')
      .filter({ hasText: 'Round Robin Reset Rule' })
      .locator('ccl-dropdown');
  }

  settingInput(label: string): Locator {
    return this.page
      .locator('ccl-form-field-wrapper')
      .filter({ hasText: label })
      .locator('input');
  }

  resetRuleLabel(rule: string): string {
    const labels: Record<string, string> = {
      DAILY: 'Daily',
      WEEKLY: 'Weekly',
      MONTHLY: 'Monthly',
      NEVER: 'Never',
    };

    const label = labels[rule];
    if (!label) {
      throw new Error(`Unsupported round-robin reset rule: ${rule}`);
    }
    return label;
  }

  async gotoSettings(): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) => {
      const request = response.request();
      return new URL(response.url()).pathname === settingsPath && request.method() === 'GET';
    });

    await this.page.goto('/settings');
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`Distribution Settings API failed with HTTP ${response.status()}`);
    }

    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    await expect(this.heading).toBeVisible();
    return response;
  }

  async saveCurrentSettings(): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) => {
      const request = response.request();
      return new URL(response.url()).pathname === settingsPath && request.method() === 'PUT';
    });

    await this.saveButton.click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`Save Distribution Settings failed with HTTP ${response.status()}`);
    }
    return response;
  }
}
