import { Page, Locator, expect } from "@playwright/test";

export class LeadSourcesPage {
    readonly page: Page;
    readonly addLeadSourceButton: Locator;
    readonly leadSourceNameInput: Locator;
    readonly leadSourceTypeSelect: Locator; 
    readonly isdefaultCheckbox: Locator; 
    readonly saveButton: Locator;
    readonly searchInput: Locator;

    

    constructor(page: Page) {
        this.page = page;
        this.addLeadSourceButton = page.getByRole('button', { name: '+ Add' });
        this.leadSourceNameInput = page.getByRole('textbox', { name: 'Enter lead source name' });
        this.leadSourceTypeSelect = page.getByText('Select lead source type')
        this.isdefaultCheckbox = page.getByRole('checkbox', { name: 'Is Default ' });
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    async gotoLeadSourcesPage() {
        await this.page.goto('/lead-sources');
    }

    async addLeadSource(leadSourceName: string, leadSourceType = 'Upload', isDefault = false) {
        await this.addLeadSourceButton.click();
        await this.leadSourceNameInput.fill(leadSourceName);
        await this.leadSourceTypeSelect.click();
        await this.page.getByText(leadSourceType, { exact: true }).click();
        await this.isdefaultCheckbox.setChecked(isDefault);
        await this.saveButton.click();
        
    }
    async searchLeadSource(leadSourceName: string) {
        await this.searchInput.fill(leadSourceName);
        await this.searchInput.press('Enter');
    }
    leadSourceRow(name: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name, exact: true }),
        });
    }
    async viewLeadSource(leadSourceName: string) {
        await this.leadSourceRow(leadSourceName).getByTitle('View', { exact: true }).click();
    }
    async editLeadSource(name: string, updatedName: string, isDefault = false) {
        await this.leadSourceRow(name).getByTitle('Edit', { exact: true }).click();
        // Wait for the existing record to load before changing its fields.
        await expect(this.leadSourceNameInput).toHaveValue(name);
        await this.leadSourceNameInput.fill(updatedName);
        await this.isdefaultCheckbox.setChecked(isDefault);
        await this.saveButton.click();
    }
    async deactivateLeadSource(name: string) {
        await this.leadSourceRow(name).getByTitle('Deactivate', { exact: true }).click();
        await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
    }
    async restoreLeadSource(name: string) {
        await this.leadSourceRow(name).getByTitle('Restore', { exact: true }).click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
    }
    async filterByStatus(status: 'Active' | 'Inactive') {
        const filters = this.page.getByRole('button', { name: /Filters/ });
        const statusWrapper = this.page.locator('ccl-form-field-wrapper').filter({ hasText: 'Status' });
        if (!(await statusWrapper.isVisible())) {
            await filters.click();
            await statusWrapper.waitFor({ state: 'visible' });
        }
        await statusWrapper.locator('.ccl-dropdown__trigger').click();
        await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`) }).click();
        await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
    }
}
