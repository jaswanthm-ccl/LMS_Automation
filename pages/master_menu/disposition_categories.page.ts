import { expect, type Locator, type Page } from '@playwright/test';

export class DispositionCategoriesPage {
  readonly page: Page;
  readonly addButton: Locator;
  readonly nameInput: Locator;
  readonly subDispositionInput: Locator;
  readonly saveButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: '+ Add' });
    this.nameInput = page.getByRole('textbox', { name: 'Enter disposition category' });
    this.subDispositionInput = page.getByRole('textbox', { name: 'Enter sub disposition' }).first();
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.searchInput = page.getByRole('searchbox', { name: 'Search' });
  }

  async gotoDispositionCategoriesPage(): Promise<void> {
    await this.page.goto('/disposition-categories');
  }

  categoryRow(name: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    });
  }

  async addCategory(name: string, subDispositionName: string): Promise<void> {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.subDispositionInput.fill(subDispositionName);
    await this.saveButton.click();
  }

  async searchCategory(name: string): Promise<void> {
    const searchResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/v1\/disposition-categories\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('search') === name.toLowerCase(),
    );
    await this.searchInput.fill(name);
    await this.searchInput.press('Enter');
    expect((await searchResponse).ok(), 'Disposition category search should succeed').toBeTruthy();
  }

  async viewCategory(name: string): Promise<void> {
    await this.categoryRow(name).getByTitle('View', { exact: true }).click();
  }

  async editCategory(name: string, updatedName: string): Promise<void> {
    await this.categoryRow(name).getByTitle('Edit', { exact: true }).click();
    await expect(this.nameInput).toHaveValue(name);
    await this.nameInput.fill(updatedName);
    await this.saveButton.click();
  }

  async deactivateCategory(name: string): Promise<void> {
    await this.categoryRow(name).getByTitle('Deactivate', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
  }

  async restoreCategory(name: string): Promise<void> {
    await this.categoryRow(name).getByTitle('Restore', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
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
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
  }
}
