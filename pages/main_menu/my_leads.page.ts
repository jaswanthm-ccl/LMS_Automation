import { expect, type Locator, type Page } from '@playwright/test';

/** Keep the optional Doocti widget from covering the LMS controls under test. */
export async function dismissAgentOverlays(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      #doocti-cti-iframe,
      app-doocti-container {
        display: none !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `,
  });
}

export class MyLeadsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private isAgentLeadsResponse(url: string): boolean {
    return new URL(url).pathname === '/api/v1/agent/leads';
  }

  async goto(): Promise<void> {
    const agentLeadsResponse = this.page.waitForResponse(
      (res) =>
        this.isAgentLeadsResponse(res.url()) && res.request().method() === 'GET',
      { timeout: 15_000 },
    );

    await this.page.goto('/my-leads');
    const response = await agentLeadsResponse;
    expect(response.ok(), `My Leads API failed with HTTP ${response.status()}`).toBeTruthy();

    await expect(
      this.page.getByRole('heading', { name: /My Assigned Leads/i }),
    ).toBeVisible({ timeout: 10_000 });
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    await dismissAgentOverlays(this.page);
  }

  leadRow(name: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    });
  }

  async searchLead(name: string): Promise<void> {
    const search = this.page.getByRole('searchbox', { name: /Search/i });
    const searchResponse = this.page.waitForResponse(
      (res) =>
        this.isAgentLeadsResponse(res.url()) && res.request().method() === 'GET',
    );
    await search.fill(name);
    await search.press('Enter');
    const response = await searchResponse;
    expect(response.ok(), `My Leads search failed with HTTP ${response.status()}`).toBeTruthy();
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
  }

  async viewLead(name: string): Promise<Locator> {
    await dismissAgentOverlays(this.page);
    const row = this.leadRow(name);
    await row.getByTitle('View', { exact: true }).click();

    const dialog = this.page.locator('app-custom-model:visible');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    return dialog;
  }

  async openNotes(name: string): Promise<Locator> {
    await dismissAgentOverlays(this.page);
    await this.leadRow(name).getByTitle('Notes', { exact: true }).click();
    const dialog = this.page.locator('app-custom-model:visible');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    return dialog;
  }
}
