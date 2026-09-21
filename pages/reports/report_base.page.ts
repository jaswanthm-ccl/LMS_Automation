import { expect, type Locator, type Page, type Response } from '@playwright/test';

/** Shared helpers for LMS report pages (filters, export, table idle). */
export class ReportPageBase {
  readonly page: Page;
  readonly filtersButton: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filtersButton = page.getByRole('button', { name: /Filters/i });
    this.exportButton = page.getByRole('button', { name: /Export/i });
  }

  protected async waitForTableIdle(): Promise<void> {
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
    await this.page
      .locator('.table-section-loader-overlay[aria-busy="true"]')
      .waitFor({ state: 'hidden', timeout: 30_000 })
      .catch(() => {});
  }

  protected async openFilters(): Promise<void> {
    const resetButton = this.page.getByRole('button', { name: /Reset/i });
    if (!(await resetButton.isVisible().catch(() => false))) {
      await this.filtersButton.click();
      await expect(resetButton).toBeVisible();
    }
  }

  protected filterField(label: string): Locator {
    return this.page.locator('ccl-form-field-wrapper').filter({
      has: this.page.getByText(label, { exact: true }),
    });
  }

  filterTrigger(label: string): Locator {
    return this.filterField(label).locator('.ccl-dropdown__trigger');
  }

  async selectFilter(label: string, optionText: string): Promise<Response> {
    await this.openFilters();
    const field = this.filterField(label);
    const trigger = field.locator('.ccl-dropdown__trigger');
    await trigger.click();

    const searchInput = this.page.locator('.ccl-dropdown__search-input:visible').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(optionText);
    }

    const escaped = optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Prefer the open panel so we don't click a stale option from another dropdown.
    const panel = this.page
      .locator('.ccl-dropdown__panel:visible, .ccl-dropdown__menu:visible, .ccl-dropdown__options:visible')
      .last();
    const optionRoot = (await panel.count()) > 0 ? panel : this.page;

    const exactOption = optionRoot
      .locator('.ccl-dropdown__option:not(.disabled)')
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`, 'i') })
      .first();
    const option =
      (await exactOption.isVisible().catch(() => false))
        ? exactOption
        : optionRoot
            .locator('.ccl-dropdown__option:not(.disabled)')
            .filter({ hasText: new RegExp(escaped, 'i') })
            .first();

    await expect(option, `Filter option "${optionText}" for ${label}`).toBeVisible({
      timeout: 10_000,
    });

    const reportResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.startsWith('/api/v1/reports/'),
      { timeout: 30_000 },
    );

    const checkbox = option.locator('input[type="checkbox"], .ccl-checkbox, [role="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click({ force: true });
    } else {
      await option.click();
    }

    // Multi-select panels may need Apply; never Escape (cancels selection on some reports).
    const apply = this.page.getByRole('button', { name: /^(Apply|Done|Ok)$/i }).first();
    if (await apply.isVisible().catch(() => false)) {
      await apply.click();
    }

    const response = await reportResponse;
    expect(
      response.ok(),
      `${label} report filter request failed with HTTP ${response.status()}`,
    ).toBeTruthy();
    await this.waitForTableIdle();
    return response;
  }

  async resetFilters(): Promise<void> {
    await this.openFilters();
    await this.page.getByRole('button', { name: /Reset/i }).click();
    await this.waitForTableIdle();
  }

  async expectReportShell(heading: RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(this.exportButton).toBeVisible();
    await expect(this.filtersButton).toBeVisible();
  }
}
