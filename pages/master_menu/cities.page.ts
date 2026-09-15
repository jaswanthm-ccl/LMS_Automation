import { Locator, Page, expect } from "@playwright/test";

export class CitiesPage {
    readonly page: Page;
    readonly addCityButton: Locator;
    readonly cityName: Locator;
    readonly countryDropdown: Locator;
    readonly stateDropdown: Locator;
    readonly saveButton: Locator;
    readonly searchInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.addCityButton = page.getByRole('button', { name: 'Add' });
        this.cityName = page.locator('ccl-input[formcontrolname="name"] input');
        
        // Inside the Add City modal, dropdown 0 is Country and dropdown 1 is State
        const modal = page.locator('app-custom-model');
        this.countryDropdown = modal.locator('ccl-dropdown .ccl-dropdown__trigger').first();
        this.stateDropdown = modal.locator('ccl-dropdown .ccl-dropdown__trigger').nth(1);
        
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByPlaceholder('Search');
    }

    async gotoCitiesPage() {
        await this.page.goto('/cities');
    }

    async searchCity(name: string) {
        await this.page.getByRole('searchbox', { name: 'Search' }).fill(name);
        await this.page.getByRole('searchbox', { name: 'Search' }).press('Enter');
        await this.page.waitForTimeout(2000);
    }

    async addCity(name: string, countryName?: string, stateName?: string) {
        await this.addCityButton.click();
        await this.cityName.fill(name);

        // 1. Select Country dynamically (or by name if supplied)
        await this.countryDropdown.click();
        if (countryName) {
            await this.page.locator('.ccl-dropdown__search-input').first().fill(countryName);
            await this.page.locator('.ccl-dropdown__option').filter({ hasText: countryName }).first().click();
        } else {
            // Pick an available country from the list
            await this.page.locator('.ccl-dropdown__option').nth(1).click();
        }

        // 2. Select State dynamically (or by name if supplied)
        await this.page.waitForTimeout(500);
        await this.stateDropdown.click();
        if (stateName) {
            await this.page.locator('.ccl-dropdown__search-input').first().fill(stateName);
            await this.page.locator('.ccl-dropdown__option').filter({ hasText: stateName }).first().click();
        } else {
            // Pick the first available state under that country
            await this.page.locator('.ccl-dropdown__option').first().click();
        }

        await this.saveButton.click();
    }

    async editCity(name: string) {
        await this.page.getByTitle('Edit').first().click();
        await expect(this.cityName).not.toHaveValue('');
        await this.cityName.fill(name);
        await this.saveButton.click();
    }

    async deleteCity(name?: string) {
        if (name) {
            await this.searchCity(name);
        }
        await this.page.getByTitle('Deactivate').first().click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
    }

    async filterByStatus(status: 'Active' | 'Inactive') {
        const filterButton = this.page.getByRole('button', { name: 'Filters' });
        const statusWrapper = this.page.locator('ccl-form-field-wrapper').filter({ hasText: 'Status' });
        if (!(await statusWrapper.isVisible())) {
            await filterButton.click();
            await statusWrapper.waitFor({ state: 'visible' });
        }
        await statusWrapper.locator('.ccl-dropdown__trigger').click();
        await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`) }).click();
        await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
    }

    async restoreCity(name?: string) {
        if (name) {
            await this.searchCity(name);
        }
        await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
        await this.page.getByTitle('Restore').first().click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
    }
}
