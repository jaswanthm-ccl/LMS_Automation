import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAgentOverlays } from './my_leads.page';

export class RecordingsPage {
  readonly page: Page;
  readonly filtersButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filtersButton = page.getByRole('button', { name: /Filters/i });
  }

  async goto(): Promise<{ allowed: boolean }> {
    const listWait = this.page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/api/v1/recordings' &&
        res.request().method() === 'GET',
      { timeout: 15_000 },
    );

    await this.page.goto('/recording');
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    await dismissAgentOverlays(this.page);

    const res = await listWait;
    if (res.status() === 403) {
      return { allowed: false };
    }
    expect(res.ok(), `Recordings API failed with HTTP ${res.status()}`).toBeTruthy();

    await expect(this.page.getByRole('heading', { name: /^Recordings$/i })).toBeVisible({
      timeout: 15_000,
    });
    return { allowed: true };
  }

  async expectTableShell(): Promise<void> {
    await expect(this.page.getByRole('columnheader', { name: /Lead Name/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Recording Status/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Call Status/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Duration/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Actions/i })).toBeVisible();
    await expect(this.filtersButton).toBeVisible();
  }

  recordingRow(leadName: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name: leadName }),
    });
  }
}
