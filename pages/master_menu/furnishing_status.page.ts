import { expect, type Locator, type Page } from '@playwright/test';

export class FurnishingStatusPage {
  readonly page: Page;
  readonly addButton: Locator;
  readonly nameInput: Locator;
  readonly isDefaultCheckbox: Locator;
  readonly saveButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: /Add/ });
    this.nameInput = page.locator('ccl-input[formcontrolname="name"] input');
    this.isDefaultCheckbox = page.locator('#is_default');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.searchInput = page.getByRole('searchbox', { name: 'Search' });
  }

  async gotoFurnishingStatusesPage(): Promise<void> {
    await this.page.goto('/furnishing-status');
  }

  furnishingStatusRow(name: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    });
  }

  async addFurnishingStatus(name: string, isDefault = false): Promise<void> {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.isDefaultCheckbox.setChecked(isDefault);
    await this.saveButton.click();
  }

  async searchFurnishingStatus(name: string): Promise<void> {
    await this.searchInput.fill(name);
    await this.searchInput.press('Enter');
  }

  async viewFurnishingStatus(name: string): Promise<void> {
    await this.furnishingStatusRow(name).getByTitle('View', { exact: true }).click();
  }

  async editFurnishingStatus(name: string, updatedName: string, isDefault = false): Promise<void> {
    await this.furnishingStatusRow(name).getByTitle('Edit', { exact: true }).click();
    await expect(this.nameInput).toHaveValue(name);
    await this.nameInput.fill(updatedName);
    await this.isDefaultCheckbox.setChecked(isDefault);
    await this.saveButton.click();
  }

  async deactivateFurnishingStatus(name: string): Promise<void> {
    const row = this.furnishingStatusRow(name);
    await row.getByTitle('Deactivate', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(row).toBeHidden();
  }

  async restoreFurnishingStatus(name: string): Promise<void> {
    const row = this.furnishingStatusRow(name);
    await row.getByTitle('Restore', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(row).toBeHidden();
  }

  async filterByStatus(status: 'Active' | 'Inactive'): Promise<void> {
    const filtersButton = this.page.getByRole('button', { name: /Filters/ });
    const statusWrapper = this.page.locator('ccl-form-field-wrapper').filter({ hasText: 'Status' });
    if (!(await statusWrapper.isVisible())) {
      await filtersButton.click();
      await statusWrapper.waitFor({ state: 'visible' });
    }
    await statusWrapper.locator('.ccl-dropdown__trigger').click();
    await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`) }).click();
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
  }
}
