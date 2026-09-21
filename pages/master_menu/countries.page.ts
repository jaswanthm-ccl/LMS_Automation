import { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export class CountriesPage {

    readonly page : Page;
    readonly addCountryButton : Locator;
    readonly countryName : Locator;
    readonly countryCode2 : Locator;
    readonly countryCode3 : Locator;
    readonly phoneCode : Locator;
    readonly currencyCode : Locator;
    readonly currencySymbol : Locator;
    readonly isDefault : Locator;
    readonly searchInput : Locator;
    readonly saveButton : Locator;



    constructor(page : Page) {

        this.page = page;
        this.addCountryButton = page.getByRole('button', { name: 'Add' });
        

        // Form Fields
        this.countryName = page.locator('ccl-input[formcontrolname="name"] input');
        this.countryCode2 = page.locator('ccl-input[formcontrolname="code"] input');
        this.countryCode3 = page.locator('ccl-input[formcontrolname="code3"] input');
        this.phoneCode = page.locator('ccl-input[formcontrolname="phone_code"] input');
        this.currencyCode = page.locator('ccl-input[formcontrolname="currency_code"] input');
        this.currencySymbol = page.locator('ccl-input[formcontrolname="currency_symbol"] input');
        this.isDefault = page.locator('#is_default');

        // Modal Save Button
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });

    }

    countryRow(name: string) : Locator{
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell' , {
                name,
                exact: true,
            }),
        });
    }

    private async hasCountryRow(name: string): Promise<boolean> {
        try {
            await this.countryRow(name).waitFor({ state: 'visible', timeout: 2000 });
            return true;
        } catch {
            return false;
        }
    }

    async gotoCountriesPage(){
        await this.page.goto('/countries');
        await expect(this.searchInput).toBeVisible();
    }
        

    async addCountry(name : string , code2 : string , code3 = '' , phone = '' , currency = '', symbol = '',isDefault = false ){
        await this.addCountryButton.click();
        await this.countryName.fill(name);
        await this.countryCode2.fill(code2);

        if(code3){
            await this.countryCode3.fill(code3);
        }
        
        await this.phoneCode.fill(phone);
        
        if(currency){
            await this.currencyCode.fill(currency);
        }
        if(symbol){
            await this.currencySymbol.fill(symbol);
        }
        if(isDefault){
            await this.isDefault.click();
        }
        await this.saveButton.click();
    }

    async searchCountry(name : string){
        if (await this.searchInput.inputValue() === name) {
            await this.page.locator('.table-section-loader-overlay').waitFor({ state: 'hidden' });
            return;
        }
        const searchResponse = this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            return response.request().method() === 'GET' &&
                /\/api\/v1\/countries\/?$/.test(url.pathname) &&
                url.searchParams.get('search') === name.toLowerCase();
        });
        await this.searchInput.fill(name);
        await this.searchInput.press('Enter');
        expect((await searchResponse).ok(), 'Country search should succeed').toBeTruthy();
        await this.page.locator('.table-section-loader-overlay').waitFor({ state: 'hidden' });
    }

    async viewCountry(name : string) {
        const row = this.countryRow(name);
        await expect(row).toBeVisible();
        await row.getByTitle('View', { exact: true }).click();
    } 

    async editCountry(name : string , newName : string){
        const row = this.countryRow(name);
        await row.getByTitle('Edit', { exact: true }).click();
        await this.countryName.fill(newName);
        await this.saveButton.click();

        await expect(this.page.getByText('Country updated successfully')).toBeVisible();
        await this.searchCountry(newName);
        await expect(this.countryRow(newName)).toBeVisible();
        
    }

    async deleteCountry(name: string) {
        await this.searchCountry(name);
        const row = this.countryRow(name);
        await expect(row).toBeVisible();
        await row.getByTitle('Deactivate', { exact: true }).click();
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
        const filterResponse = this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            return response.request().method() === 'GET' &&
                /\/api\/v1\/countries\/?$/.test(url.pathname) &&
                url.searchParams.get('status') === status.toLowerCase();
        });
        await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`) }).click();
        expect((await filterResponse).ok(), `Filter ${status} countries should succeed`).toBeTruthy();
        await this.page.locator('.table-section-loader-overlay').waitFor({ state: 'hidden' });
    }

    async restoreCountry(name: string) {
        await this.searchCountry(name);
        const row = this.countryRow(name);
        await expect(row).toBeVisible();
        await row.getByTitle('Restore', { exact: true }).click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
    }

    /**
     * Reuse a shared country for dependent tests.
     * If it is active → do nothing.
     * If it is inactive → restore it.
     * If it is missing → create it once (fixed codes, not random).
     */
    async ensureCountryExists(
        name: string,
        code2: string,
        code3 = '',
        phone = '91',
        currency = 'INR',
        symbol = '₹',
    ): Promise<void> {
        await this.gotoCountriesPage();
        await this.searchCountry(name);

        const activeRow = this.countryRow(name);
        if (await this.hasCountryRow(name)) {
            return;
        }

        // Maybe soft-deleted / inactive
        await this.filterByStatus('Inactive');
        await this.searchCountry(name);
        if (await this.hasCountryRow(name)) {
            await this.restoreCountry(name);
            await expect(this.page.getByText('Country restored successfully')).toBeVisible();
            await this.filterByStatus('Active');
            return;
        }

        // Not present at all — create once with fixed codes
        await this.filterByStatus('Active');
        await this.addCountry(name, code2, code3, phone, currency, symbol);
        await expect(this.page.getByText('Country created successfully')).toBeVisible();
        await this.searchCountry(name);
        await expect(activeRow).toBeVisible();
    }
}
