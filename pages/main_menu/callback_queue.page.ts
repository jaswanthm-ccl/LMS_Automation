import { expect, type Page } from '@playwright/test';
import { dismissAgentOverlays } from './my_leads.page';

export class CallbackQueuePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    const queueResponse = this.page.waitForResponse(
      (res) => {
        const url = new URL(res.url());
        return (
          url.pathname === '/api/v1/agent/follow-ups' &&
          res.request().method() === 'GET'
        );
      },
      { timeout: 15_000 },
    );
    await this.page.goto('/callback-queue');
    const response = await queueResponse;
    expect(response.ok(), `Callback Queue API failed with HTTP ${response.status()}`).toBeTruthy();
    await expect(
      this.page.getByRole('heading', { name: /Follow-Up\s*\/\s*Callback Queue/i }),
    ).toBeVisible();
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    await dismissAgentOverlays(this.page);
  }

  async selectQueueType(option: 'Today' | 'Overdue' | 'Upcoming' | 'Range'): Promise<void> {
    await dismissAgentOverlays(this.page);
    const field = this.page.locator('ccl-form-field-wrapper').filter({
      has: this.page.getByText(/Queue Type/i),
    });
    const queueResponse = this.page.waitForResponse((res) => {
      const url = new URL(res.url());
      return (
        url.pathname === '/api/v1/agent/follow-ups' &&
        url.searchParams.get('filter') === option.toLowerCase() &&
        res.request().method() === 'GET'
      );
    });
    await field.locator('.ccl-dropdown__trigger').click();
    await this.page
      .locator('.ccl-dropdown__option:visible')
      .filter({ hasText: new RegExp(`^\\s*${option}\\s*$`, 'i') })
      .click();
    const response = await queueResponse;
    expect(response.ok(), `Callback Queue filter failed with HTTP ${response.status()}`).toBeTruthy();
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
  }

  followUpRow(leadName: string) {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name: leadName, exact: true }),
    });
  }
}
