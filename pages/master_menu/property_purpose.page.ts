import { expect, type Locator, type Page } from '@playwright/test';

export class PropertyPurposePage {
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

  async gotoPropertyPurposePage(): Promise<void> {
    await this.page.goto('/property-purpose');
  }

  propertyPurposeRow(name: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    });
  }

  async addPropertyPurpose(name: string, isDefault = false): Promise<void> {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.isDefaultCheckbox.setChecked(isDefault);
    await this.saveButton.click();
  }

  async searchPropertyPurpose(name: string): Promise<void> {
    const searchResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/v1\/property-purposes\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('search') === name.toLowerCase(),
    );
    await this.searchInput.fill(name);
    await this.searchInput.press('Enter');
    expect((await searchResponse).ok(), 'Property purpose search should succeed').toBeTruthy();
  }

  async viewPropertyPurpose(name: string): Promise<void> {
    await this.propertyPurposeRow(name).getByTitle('View', { exact: true }).click();
  }

  async editPropertyPurpose(name: string, updatedName: string, isDefault = false): Promise<void> {
    await this.propertyPurposeRow(name).getByTitle('Edit', { exact: true }).click();
    await expect(this.nameInput).toHaveValue(name);
    await this.nameInput.fill(updatedName);
    await this.isDefaultCheckbox.setChecked(isDefault);
    await this.saveButton.click();
  }

  async deactivatePropertyPurpose(name: string): Promise<void> {
    await this.propertyPurposeRow(name).getByTitle('Deactivate', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
  }

  async restorePropertyPurpose(name: string): Promise<void> {
    await this.propertyPurposeRow(name).getByTitle('Restore', { exact: true }).click();
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
