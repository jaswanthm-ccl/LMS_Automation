import { expect, type Locator, type Page, type Response } from '@playwright/test';

const settingsPath = '/api/v1/distribution-settings';

export class SettingsPage {
  readonly heading: Locator;
  readonly saveButton: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Distribution Settings' });
    this.saveButton = page.getByRole('button', { name: /Save Settings/ });
  }

  settingInput(label: string): Locator {
    return this.page
      .locator('ccl-form-field-wrapper')
      .filter({ hasText: label })
      .locator('input');
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
}
