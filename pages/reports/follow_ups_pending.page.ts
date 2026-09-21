import { expect, type Locator, type Page } from '@playwright/test';

export class FollowUpsPendingReportPage {
  readonly page: Page;
  readonly filtersButton: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filtersButton = page.getByRole('button', { name: /Filters/i });
    this.exportButton = page.getByRole('button', { name: /Export/i });
  }

  async gotoFollowUpsPendingReport(): Promise<void> {
    await this.page.goto('/reports/follow-ups-pending');
    await expect(
      this.page.getByRole('heading', { name: /Follow-Up Pending Report/i }),
    ).toBeVisible();
    await this.waitForTableIdle();
  }

  followUpRow(leadName: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name: leadName, exact: true }),
    });
  }

  private async waitForTableIdle(): Promise<void> {
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
    await this.page
      .locator('.table-section-loader-overlay[aria-busy="true"]')
      .waitFor({ state: 'hidden', timeout: 30_000 })
      .catch(() => {});
  }

  private async openFilters(): Promise<void> {
    const resetButton = this.page.getByRole('button', { name: /Reset/i });
    if (!(await resetButton.isVisible().catch(() => false))) {
      await this.filtersButton.click();
      await expect(resetButton).toBeVisible();
    }
  }

  private filterField(label: string): Locator {
    return this.page.locator('ccl-form-field-wrapper').filter({
      has: this.page.getByText(label, { exact: true }),
    });
  }

  filterTrigger(label: string): Locator {
    return this.filterField(label).locator('.ccl-dropdown__trigger');
  }

  private async selectFromFilterField(label: string, optionText: string): Promise<void> {
    await this.openFilters();
    const field = this.filterField(label);
    await field.locator('.ccl-dropdown__trigger').click();
    await this.page
      .locator('.ccl-dropdown__option')
      .filter({ hasText: new RegExp(`^${optionText}$`, 'i') })
      .first()
      .click();
    await this.waitForTableIdle();
  }

  async filterByStatus(status: 'Pending' | 'Overdue'): Promise<void> {
    await this.selectFromFilterField('Status', status);
  }

  async filterOverdueOnly(value: 'Yes' | 'No'): Promise<void> {
    await this.selectFromFilterField('Overdue Only', value);
  }

  async filterByAgent(agentName: string): Promise<void> {
    await this.openFilters();
    const field = this.filterField('Agent');
    await field.locator('.ccl-dropdown__trigger').click();
    const searchInput = this.page.locator('.ccl-dropdown__search-input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(agentName);
    }
    await this.page
      .locator('.ccl-dropdown__option')
      .filter({ hasText: agentName })
      .first()
      .click();
    await this.waitForTableIdle();
  }

  async resetFilters(): Promise<void> {
    await this.openFilters();
    await this.page.getByRole('button', { name: /Reset/i }).click();
    await this.waitForTableIdle();
  }

  async viewLead(leadName: string): Promise<Locator> {
    await this.waitForTableIdle();
    const viewButton = this.followUpRow(leadName).getByTitle('View Lead', { exact: true });
    await expect(viewButton).toBeVisible();
    await viewButton.click();
    const dialog = this.page
      .getByRole('dialog', { name: /Lead Profile/i })
      .or(this.page.locator('app-custom-model:visible'))
      .first();
    await expect(dialog).toBeVisible();
    return dialog;
  }
}
