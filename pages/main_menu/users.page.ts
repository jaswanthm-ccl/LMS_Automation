import { Locator, Page, expect } from "@playwright/test";

export class UsersPage {
    readonly page: Page;
    readonly addUserButton: Locator;
    readonly firstNameInput: Locator;
    readonly lastNameInput: Locator;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly phoneInput: Locator;
    readonly saveButton: Locator;
    readonly searchInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.addUserButton = page.getByRole('button', { name: 'Add' });
        this.firstNameInput = page.locator('ccl-input[formcontrolname="first_name"] input');
        this.lastNameInput = page.locator('ccl-input[formcontrolname="last_name"] input');
        this.emailInput = page.locator('ccl-input[formcontrolname="email"] input');
        this.passwordInput = page.locator('ccl-input[formcontrolname="password_hash"] input');
        this.phoneInput = page.locator('ccl-input[formcontrolname="phone_number"] input');
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    // 1. Navigation
    async gotoUsersPage() {
        await this.page.goto('/users');
    }

    // 2. Search User
    async searchUser(term: string) {
        await this.searchInput.fill(term);
        await this.searchInput.press('Enter');
        await this.page.waitForTimeout(1000);
    }

    // 3. Add User
    async addUser(options: {
        firstName: string;
        lastName: string;
        email: string;
        password?: string;
        phone: string;
        gender?: string;
        roleName?: string;
    }) {
        await this.addUserButton.click();
        await this.firstNameInput.fill(options.firstName);
        await this.lastNameInput.fill(options.lastName);
        await this.emailInput.fill(options.email);
        await this.passwordInput.fill(options.password || 'Test@1234');
        await this.phoneInput.fill(options.phone);

        const modal = this.page.locator('app-custom-model');

        // Select Gender (first dropdown in the form)
        if (options.gender) {
            const genderDropdown = modal.locator('ccl-dropdown .ccl-dropdown__trigger').first();
            await genderDropdown.click();
            await this.page.locator('.ccl-dropdown__option').filter({ hasText: options.gender }).first().click();
        }

        // Select Role (second dropdown in the form)
        if (options.roleName) {
            const roleDropdown = modal.locator('ccl-dropdown .ccl-dropdown__trigger').nth(1);
            await roleDropdown.click();
            await this.page.locator('.ccl-dropdown__option').filter({ hasText: options.roleName }).first().click();
        }

        await this.saveButton.click();
    }

    userRow(name: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name, exact: true }),
        });
    }

    // 4. Edit User
    async editUser(nameOrNewFirstName: string, newFirstName?: string) {
        if (newFirstName) {
            await this.userRow(nameOrNewFirstName).getByTitle('Edit', { exact: true }).click();
            await expect(this.firstNameInput).not.toHaveValue('');
            await this.firstNameInput.fill(newFirstName);
        } else {
            await this.page.getByTitle('Edit').first().click();
            await expect(this.firstNameInput).not.toHaveValue('');
            await this.firstNameInput.fill(nameOrNewFirstName);
        }
        await this.saveButton.click();
    }

    // 5. View User
    async viewUser(expectedName: string) {
        await this.userRow(expectedName).getByTitle('View', { exact: true }).click();
        await expect(this.page.locator('app-custom-model')).toContainText(expectedName);
        await this.page.getByRole('button', { name: 'Close modal' }).click();
    }

    // 6. Delete / Deactivate User
    async deleteUser(name?: string) {
        if (name) {
            await this.userRow(name).getByTitle('Deactivate', { exact: true }).click();
        } else {
            await this.page.getByTitle('Deactivate').first().click();
        }
        await this.page.getByRole('button', { name: 'Yes' }).click();
    }
}
