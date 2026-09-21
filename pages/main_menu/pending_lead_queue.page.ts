import { expect, type Locator, type Page, type Response } from '@playwright/test';

const pendingListPath = /^\/api\/v1\/lead-assignments\/pending\/?$/;

export class PendingLeadQueuePage {
  readonly page: Page;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByRole('searchbox', { name: 'Search' });
  }

  private waitForPendingList(search?: string): Promise<Response> {
    return this.page.waitForResponse((response) => {
      const url = new URL(response.url());
      const actualSearch = url.searchParams.get('search');
      return response.request().resourceType() === 'xhr' &&
        response.request().method() === 'GET' &&
        pendingListPath.test(url.pathname) &&
        (search === undefined || actualSearch?.toLowerCase() === search.toLowerCase());
    });
  }

  private async successful(responsePromise: Promise<Response>, operation: string): Promise<void> {
    const response = await responsePromise;
    expect(response.ok(), `${operation} API request should succeed`).toBeTruthy();
  }

  async gotoPendingLeadQueuePage(): Promise<void> {
    const response = this.waitForPendingList();
    await this.page.goto('/pending-lead-queue');
    await this.successful(response, 'Load Pending Lead Queue');
    await expect(this.page.getByRole('heading', { name: /Pending Lead Queue/i })).toBeVisible();
  }

  queueRow(leadName: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name: leadName }),
    });
  }

  async searchPendingLead(term: string): Promise<void> {
    if ((await this.searchInput.inputValue()) === term) {
      return;
    }

    const response = this.waitForPendingList(term);
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
    await this.successful(response, 'Search Pending Lead Queue');
  }

  async filterByPendingReason(reasonLabel: string): Promise<void> {
    const filtersButton = this.page.getByRole('button', { name: /Filters/i });
    await filtersButton.click();
    const reasonWrapper = this.page
      .locator('ccl-form-field-wrapper')
      .filter({ hasText: /Pending Reason/i });
    await reasonWrapper.locator('.ccl-dropdown__trigger').click();
    const option = this.page
      .locator('.ccl-dropdown__option')
      .filter({ hasText: new RegExp(`^${reasonLabel}$`, 'i') });
    await expect(option).toHaveCount(1);
    const response = this.waitForPendingList();
    await option.click();
    await this.successful(response, 'Filter Pending Lead Queue');
  }

  async viewPendingLead(leadName: string): Promise<void> {
    await this.queueRow(leadName).getByTitle('View', { exact: true }).click();
  }

  async openAssign(leadName: string): Promise<Locator> {
    await this.queueRow(leadName).getByTitle('Assign', { exact: true }).click();
    const dialog = this.page.getByRole('dialog', { name: /Assign Lead/i });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async assignLead(leadName: string, agentLabel: string): Promise<void> {
    const dialog = await this.openAssign(leadName);

    const agentTrigger = dialog.locator('.ccl-dropdown__trigger');
    const blockingMessage = dialog.getByText(/daily cap|No agents are mapped/i);

    await expect(async () => {
      expect((await agentTrigger.isVisible()) || (await blockingMessage.isVisible())).toBeTruthy();
    }).toPass({ timeout: 10_000 });

    if (await blockingMessage.isVisible()) {
      const text = await dialog.innerText();
      await dialog.getByRole('button', { name: 'Close modal' }).click();
      if (/daily cap/i.test(text)) {
        throw new Error('DAILY_CAP_REACHED');
      }
      throw new Error('NO_AGENTS_MAPPED');
    }

    await agentTrigger.click();

    const searchInput = this.page.locator('.ccl-dropdown__search-input:visible');
    if (await searchInput.isVisible()) {
      await searchInput.fill(agentLabel);
    }
    const agentOption = this.page
      .locator('.ccl-dropdown__option:not(.disabled)')
      .filter({ hasText: agentLabel });
    await expect(agentOption).toHaveCount(1);
    await agentOption.click();

    await dialog.getByRole('button', { name: /^Assign$/i }).click();

    const confirmDialog = this.page.getByRole('dialog', { name: /Confirm Assignment/i });
    await expect(confirmDialog).toBeVisible();
    const response = this.page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return candidate.request().resourceType() === 'xhr' &&
        candidate.request().method() === 'POST' &&
        /^\/api\/v1\/leads\/\d+\/assign\/?$/.test(url.pathname);
    });
    await confirmDialog.getByRole('button', { name: /^Yes$|^Confirm$/i }).click();
    await this.successful(response, 'Assign Pending Lead');
    await expect(confirmDialog).toBeHidden();
  }

  async assignLeadViaApi(
    leadId: number,
    agentId: number,
    options: { overrideDailyCap?: boolean } = {},
  ): Promise<void> {
    const apiBase = process.env.API_BASE_URL;
    expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();
    const apiOrigin = new URL(apiBase!).origin;

    const response = await this.page.context().request.post(
      `${apiOrigin}/api/v1/leads/${leadId}/assign`,
      {
        data: {
          agent_id: agentId,
          override_daily_cap: options.overrideDailyCap ?? false,
        },
      },
    );
    expect(
      response.ok(),
      `Lead assign failed: ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
  }
}
