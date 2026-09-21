import { Locator, Page  , expect} from "@playwright/test";

export class StatesPage {
    readonly page : Page;
    readonly addStateButton : Locator;
    readonly stateName : Locator;
    readonly stateCode : Locator;
    readonly country : Locator;
    readonly saveButton : Locator;
    readonly searchInput : Locator;

    constructor(page : Page){
        this.page = page;
        this.addStateButton = page.getByRole('button', { name: 'Add' });
        this.stateName = page.locator('ccl-input[formcontrolname="name"] input');
        this.stateCode = page.locator('ccl-input[formcontrolname="code"] input');
        this.country = page.locator('app-custom-model ccl-dropdown .ccl-dropdown__trigger');
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    async gotoStatesPage(){
        await this.page.goto('/states');
        await expect(this.searchInput).toBeVisible();
    }

    async searchState(name : string){
        if (await this.searchInput.inputValue() === name) {
            await this.page.locator('.table-section-loader-overlay').waitFor({ state: 'hidden' });
            await expect(this.stateRow(name)).toBeVisible();
            return;
        }
        const searchResponse = this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            return response.request().method() === 'GET' &&
                /\/api\/v1\/states\/?$/.test(url.pathname) &&
                url.searchParams.get('search') === name.toLowerCase();
        });
        await this.searchInput.fill(name);
        await this.searchInput.press('Enter');
        expect((await searchResponse).ok(), 'State search should succeed').toBeTruthy();
        await expect(this.stateRow(name)).toBeVisible();
    }

    stateRow(name: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name, exact: true }),
        });
    }

    async editState(currentName: string, updatedName: string){
        const row = this.stateRow(currentName);
        await expect(row).toBeVisible();
        await row.getByTitle('Edit', { exact: true }).click();
        await expect(this.stateName).toHaveValue(currentName);
        await this.stateName.fill(updatedName);
        await this.saveButton.click();
    }
    
    async deleteState(name: string) {
        await this.searchState(name);
        const row = this.stateRow(name);
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
                /\/api\/v1\/states\/?$/.test(url.pathname) &&
                url.searchParams.get('status') === status.toLowerCase();
        });
        await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`) }).click();
        expect((await filterResponse).ok(), `Filter ${status} states should succeed`).toBeTruthy();
    }
    
    async addState(name : string , code : string , country : string){
        await this.addStateButton.click();
        await this.stateName.fill(name);
        await this.stateCode.fill(code);
        await this.country.click();
        await this.page.locator('.ccl-dropdown__search-input').first().fill(country);
        await this.page.locator('.ccl-dropdown__option').filter({ hasText: country }).first().click();
        await this.saveButton.click();
     }

    async restoreState(name: string) {
        await this.searchState(name);
        const row = this.stateRow(name);
        await row.getByTitle('Restore', { exact: true }).click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
    }
        
    }

