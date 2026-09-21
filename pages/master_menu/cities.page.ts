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
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    async gotoCitiesPage() {
        await this.page.goto('/cities');
        await expect(this.searchInput).toBeVisible();
    }

    async searchCity(name: string) {
        const searchResponse = this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            return response.request().method() === 'GET' &&
                /\/api\/v1\/cities\/?$/.test(url.pathname) &&
                url.searchParams.get('search') === name.toLowerCase();
        });
        await this.searchInput.fill(name);
        await this.searchInput.press('Enter');
        expect((await searchResponse).ok(), 'City search should succeed').toBeTruthy();
        await expect(this.cityRow(name)).toBeVisible();
    }

    cityRow(name: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name, exact: true }),
        });
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

    async editCity(currentName: string, updatedName: string) {
        await this.cityRow(currentName).getByTitle('Edit', { exact: true }).click();
        await expect(this.cityName).toHaveValue(currentName);
        await this.cityName.fill(updatedName);
        await this.saveButton.click();
    }

    async deleteCity(name?: string) {
        if (name) {
            await this.searchCity(name);
        }
        const row = this.cityRow(name!);
        await row.getByTitle('Deactivate', { exact: true }).click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
        await expect(row).toBeHidden();
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
        await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
    }

    async restoreCity(name?: string) {
        if (name) {
            await this.searchCity(name);
        }
        await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' });
        const row = this.cityRow(name!);
        await row.getByTitle('Restore', { exact: true }).click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
        await expect(row).toBeHidden();
    }
}
