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
        this.searchInput = page.getByPlaceholder('Search');
    }

    async gotoStatesPage(){
        await this.page.goto('/states');
    
    }

    async searchState(name : string){
        await this.page.getByRole('searchbox', { name: 'Search' }).fill(name);
        await this.page.getByRole('searchbox', { name: 'Search' }).press('Enter');
        await this.page.waitForTimeout(2000);
    }
    async editState(name : string){
        await this.page.getByTitle('Edit').first().click();
        await expect(this.stateName).not.toHaveValue('');
        await this.stateName.fill(name);
        await this.saveButton.click();
    }
    
    async deleteState(name?: string) {
        if (name) {
            await this.searchState(name);
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
        await this.page.getByTitle('Restore').first().click();
        await this.page.getByRole('button', { name: 'Yes' }).click();
    }
        
    }

