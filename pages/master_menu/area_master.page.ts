import { expect, type Locator, type Page } from '@playwright/test';

export class AreaMasterPage {
  readonly page: Page;
  readonly addButton: Locator;
  readonly areaNameInput: Locator;
  readonly measurementUnitInput: Locator;
  readonly isDefaultCheckbox: Locator;
  readonly saveButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: /Add/ });
    this.areaNameInput = page.locator('ccl-input[formcontrolname="area_name"] input');
    this.measurementUnitInput = page.getByRole('textbox', { name: 'Enter measurement unit' });
    this.isDefaultCheckbox = page.locator('#is_default');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.searchInput = page.getByRole('searchbox', { name: 'Search' });
  }

  async gotoAreaMasterPage(): Promise<void> {
    await this.page.goto('/area-master');
  }

  areaRow(areaName: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name: areaName, exact: true }),
    });
  }

  async addArea(areaName: string, measurementUnit = 'Sq. Ft.', isDefault = false): Promise<void> {
    await this.addButton.click();
    await this.areaNameInput.fill(areaName);
    await this.measurementUnitInput.fill(measurementUnit);
    await this.isDefaultCheckbox.setChecked(isDefault);
    await this.saveButton.click();
  }

  async searchArea(areaName: string): Promise<void> {
    await this.searchInput.fill(areaName);
    await this.searchInput.press('Enter');
  }

  async viewArea(areaName: string): Promise<void> {
    await this.areaRow(areaName).getByTitle('View', { exact: true }).click();
  }

  async editArea(
    areaName: string,
    updatedAreaName: string,
    measurementUnit = 'Sq. Ft.',
    isDefault = false,
  ): Promise<void> {
    await this.areaRow(areaName).getByTitle('Edit', { exact: true }).click();
    await expect(this.areaNameInput).toHaveValue(areaName);
    await this.areaNameInput.fill(updatedAreaName);
    await this.measurementUnitInput.fill(measurementUnit);
    await this.isDefaultCheckbox.setChecked(isDefault);
    await this.saveButton.click();
  }

  async deactivateArea(areaName: string): Promise<void> {
    await this.areaRow(areaName).getByTitle('Deactivate', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
  }

  async restoreArea(areaName: string): Promise<void> {
    await this.areaRow(areaName).getByTitle('Restore', { exact: true }).click();
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
