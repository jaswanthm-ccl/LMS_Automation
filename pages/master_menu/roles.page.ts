/* known issues when editing a role with an existing name no error message is displayed then same adding an role with 
the same name will not show any error 
*/



import { Page, Locator, Response, expect } from "@playwright/test";

export type CreatedRole = {
    id: number;
    deleteUrl: string;
};

export class RolesPage {
    readonly page: Page;
    readonly addRoleButton: Locator;
    readonly roleNameInput: Locator;
    readonly descriptionInput: Locator;
    readonly saveButton: Locator;
    readonly searchInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.addRoleButton = page.getByRole('button', { name: '+ Add' });
        this.roleNameInput = page.getByRole('textbox', { name: 'Enter role name' });
        this.descriptionInput = page.getByRole('textbox', { name: 'Enter description (optional)' });
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    private waitForRoleApi(method: string, path: RegExp): Promise<Response> {
        return this.page.waitForResponse((response) => {
            const pathname = new URL(response.url()).pathname;
            return response.request().resourceType() === 'xhr' &&
                response.request().method() === method &&
                path.test(pathname);
        });
    }

    private async expectSuccessfulApi(
        responsePromise: Promise<Response>,
        operation: string,
    ): Promise<Response> {
        const response = await responsePromise;
        expect(response.ok(), `${operation} API request should succeed`).toBeTruthy();
        return response;
    }

    // 1. Navigation
    async gotoRolesPage() {
        const rolesResponse = this.waitForRoleApi('GET', /\/roles\/?$/);
        await this.page.goto('/roles');
        await this.expectSuccessfulApi(rolesResponse, 'Load Roles');
        await expect(this.page.getByRole('heading', { name: 'Roles List' })).toBeVisible();
    }

    // 2. Add Role (Backend requires at least 1 permission)
    async addRole(
        name: string,
        description = 'for test',
        permissionName = 'View Dashboard',
    ): Promise<CreatedRole> {
        await this.addRoleButton.click();
        await this.roleNameInput.fill(name);
        if (description) {
            await this.descriptionInput.fill(description);
        }
        await this.page.getByRole('checkbox', { name: permissionName }).check();
        const createResponsePromise = this.waitForRoleApi('POST', /\/roles\/?$/);
        await this.saveButton.click();

        const createResponse = await this.expectSuccessfulApi(createResponsePromise, 'Create Role');

        const responseBody = await createResponse.json();
        const roleId = Number(responseBody?.data?.id ?? responseBody?.id);
        expect(Number.isInteger(roleId), 'Create Role API response should include its ID').toBeTruthy();

        const createUrl = new URL(createResponse.url());
        return {
            id: roleId,
            deleteUrl: `${createUrl.origin}${createUrl.pathname.replace(/\/$/, '')}/${roleId}`,
        };
    }

    // 3. Search Role
    async searchRole(name: string) {
        const searchResponse = this.waitForRoleApi('GET', /\/roles\/?$/);
        await this.searchInput.fill(name);
        await this.searchInput.press('Enter');
        await this.expectSuccessfulApi(searchResponse, 'Search Roles');
    }

    roleRow(name: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name, exact: true }),
        });
    }

    // 4. View Role
    async viewRole(name: string) {
        const roleResponse = this.waitForRoleApi('GET', /\/roles\/\d+\/?$/);
        await this.roleRow(name).getByTitle('View', { exact: true }).click();
        await this.expectSuccessfulApi(roleResponse, 'View Role');
        await expect(this.page.getByLabel('View Role').getByText(name)).toBeVisible();
        await this.page.getByRole('dialog', { name: 'View Role' })
            .getByRole('button', { name: 'Close modal' })
            .click();
    }

    // 5. Edit Role
    async editRole(name: string, updatedName: string) {
        const roleResponse = this.waitForRoleApi('GET', /\/roles\/\d+\/?$/);
        await this.roleRow(name).getByTitle('Edit', { exact: true }).click();
        await this.expectSuccessfulApi(roleResponse, 'Load Role for editing');
        await expect(this.roleNameInput).not.toHaveValue('');
        await this.roleNameInput.fill(updatedName);
        const updateResponse = this.waitForRoleApi('PUT', /\/roles\/\d+\/?$/);
        await this.saveButton.click();
        await this.expectSuccessfulApi(updateResponse, 'Update Role');
    }

    // 6. Deactivate Role
    async deleteRole(name: string) {
        await this.roleRow(name).getByTitle('Deactivate', { exact: true }).click();
        const confirmationDialog = this.page.getByRole('dialog', {
            name: /Confirm (Delete|Deactivate)/,
        });
        await expect(confirmationDialog).toBeVisible();
        const deleteResponse = this.waitForRoleApi('DELETE', /\/roles\/\d+\/?$/);
        await confirmationDialog.getByRole('button', { name: 'Yes', exact: true }).click();
        await this.expectSuccessfulApi(deleteResponse, 'Deactivate Role');
    }

    // 7. Filter by Status
    async filterByStatus(status: 'Active' | 'Inactive') {
        const filters = this.page.getByRole('button', { name: /Filters/ });
        const statusWrapper = this.page.locator('ccl-form-field-wrapper').filter({ hasText: 'Status' });
        if (!(await statusWrapper.isVisible())) {
            await filters.click();
            await statusWrapper.waitFor({ state: 'visible' });
        }
        await statusWrapper.locator('.ccl-dropdown__trigger').click();
        const filterResponse = this.waitForRoleApi('GET', /\/roles\/?$/);
        await this.page
            .locator('.ccl-dropdown__option')
            .filter({ hasText: new RegExp(`^${status}$`) })
            .click();
        await this.expectSuccessfulApi(filterResponse, `Filter ${status} Roles`);
    }

    // 8. Restore Role
    async restoreRole(name: string) {
        await this.roleRow(name).getByTitle('Restore', { exact: true }).click();
        const confirmationDialog = this.page.getByRole('dialog', { name: 'Confirm Restore' });
        await expect(confirmationDialog).toBeVisible();
        const restoreResponse = this.waitForRoleApi('PATCH', /\/roles\/\d+\/restore\/?$/);
        await confirmationDialog.getByRole('button', { name: 'Yes', exact: true }).click();
        await this.expectSuccessfulApi(restoreResponse, 'Restore Role');
    }
}
