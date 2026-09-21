import { expect, type Page } from '@playwright/test';
import { dismissAgentOverlays } from './my_leads.page';

async function waitForSuccessfulGet(
  page: Page,
  pathname: string,
  label: string,
): Promise<void> {
  const response = await page.waitForResponse(
    (candidate) =>
      new URL(candidate.url()).pathname === pathname &&
      candidate.request().method() === 'GET',
    { timeout: 15_000 },
  );
  if (!response.ok()) {
    throw new Error(`${label} API failed with HTTP ${response.status()}`);
  }
}

export class IntegrationSettingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    const listResponse = waitForSuccessfulGet(
      this.page,
      '/api/v1/integration-configs',
      'Integration Settings',
    );
    await Promise.all([
      this.page.goto('/integration-setting-config'),
      listResponse,
    ]);
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    await dismissAgentOverlays(this.page);
    await expect(
      this.page.getByRole('heading', { name: /Integration Settings/i }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async expectTableShell(): Promise<void> {
    await expect(this.page.getByRole('columnheader', { name: /Integration Name/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Provider/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Status/i })).toBeVisible();
    await expect(this.page.getByRole('button', { name: /Filters/i })).toBeVisible();
  }
}

export class IntegrationSyncLogPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    const listResponse = waitForSuccessfulGet(
      this.page,
      '/api/v1/integration-sync-logs',
      'Integration Sync Logs',
    );
    await Promise.all([
      this.page.goto('/integration-sync-log'),
      listResponse,
    ]);
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    await dismissAgentOverlays(this.page);
    await expect(
      this.page.getByRole('heading', { name: /Integration Sync Logs/i }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async expectTableShell(): Promise<void> {
    await expect(this.page.getByRole('columnheader', { name: /Integration/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Status/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Received/i })).toBeVisible();
    await expect(this.page.getByRole('button', { name: /Filters/i })).toBeVisible();
  }
}
