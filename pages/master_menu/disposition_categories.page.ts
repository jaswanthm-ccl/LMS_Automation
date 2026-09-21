import { expect, type Locator, type Page, type Response } from '@playwright/test';

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
    const response = this.waitForMutation('POST', /\/api\/v1\/disposition-categories\/?$/);
    await this.saveButton.click();
    await this.expectSuccessful(response, 'Create disposition category');
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

  private waitForMutation(method: 'POST' | 'PUT' | 'PATCH', path: RegExp): Promise<Response> {
    return this.page.waitForResponse((response) =>
      response.request().method() === method && path.test(new URL(response.url()).pathname),
    );
  }

  private async expectSuccessful(responsePromise: Promise<Response>, operation: string): Promise<void> {
    const response = await responsePromise;
    expect(response.ok(), `${operation} API request should succeed`).toBeTruthy();
  }

  async viewCategory(name: string): Promise<void> {
    await this.categoryRow(name).getByTitle('View', { exact: true }).click();
  }

  async editCategory(name: string, updatedName: string): Promise<void> {
    await this.categoryRow(name).getByTitle('Edit', { exact: true }).click();
    await expect(this.nameInput).toHaveValue(name);
    await this.nameInput.fill(updatedName);
    const response = this.waitForMutation('PUT', /\/api\/v1\/disposition-categories\/\d+\/?$/);
    await this.saveButton.click();
    await this.expectSuccessful(response, 'Update disposition category');
  }

  async deactivateCategory(name: string): Promise<void> {
    await this.categoryRow(name).getByTitle('Deactivate', { exact: true }).click();
    const response = this.waitForMutation(
      'PATCH',
      /\/api\/v1\/disposition-categories\/\d+\/deactivate\/?$/,
    );
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
    await this.expectSuccessful(response, 'Deactivate disposition category');
  }

  async restoreCategory(name: string): Promise<void> {
    await this.categoryRow(name).getByTitle('Restore', { exact: true }).click();
    const response = this.waitForMutation(
      'PATCH',
      /\/api\/v1\/disposition-categories\/\d+\/activate\/?$/,
    );
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
    await this.expectSuccessful(response, 'Restore disposition category');
  }

  async filterByStatus(status: 'Active' | 'Inactive'): Promise<void> {
    const filtersButton = this.page.getByRole('button', { name: /Filters/ });
    const statusWrapper = this.page.locator('ccl-form-field-wrapper').filter({ hasText: 'Status' });
    if (!(await statusWrapper.isVisible())) {
      await filtersButton.click();
      await statusWrapper.waitFor({ state: 'visible' });
    }
    await statusWrapper.locator('.ccl-dropdown__trigger').click();
    const response = this.page.waitForResponse((candidate) =>
      candidate.request().method() === 'GET' &&
      /\/api\/v1\/disposition-categories\/?$/.test(new URL(candidate.url()).pathname),
    );
    await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`) }).click();
    expect((await response).ok(), `Filter ${status} disposition categories should succeed`).toBeTruthy();
  }
}
