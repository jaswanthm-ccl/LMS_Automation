import { expect, type Page } from '@playwright/test';
import { dismissAgentOverlays } from './my_leads.page';

export class IntegrationSyncAlertPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    const listResponse = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/integration-sync-alerts' &&
        response.request().method() === 'GET',
      { timeout: 15_000 },
    );

    await this.page.goto('/integration-sync-alert');
    const response = await listResponse;
    if (!response.ok()) {
      throw new Error(`Integration Sync Alerts API failed with HTTP ${response.status()}`);
    }

    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    await dismissAgentOverlays(this.page);
    await expect(
      this.page.getByRole('heading', { name: 'Integration Sync Alerts', exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async expectTableShell(): Promise<void> {
    await expect(this.page.getByRole('columnheader', { name: /Integration/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Failure Reason/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Last Notified/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Created At/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: 'Actions', exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: /Filters/i })).toBeVisible();
  }
}
