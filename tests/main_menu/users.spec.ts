import { test, expect } from '../../fixtures/auth.fixture';
import { UsersPage } from '../../pages/main_menu/users.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

test.describe('Users Module - CRUD & Lifecycle', () => {
    test('should create, search, view, edit, and delete a user', async ({ page }) => {
        test.setTimeout(60000);
        const usersPage = new UsersPage(page);

        const uniqueSuffix = getRandomLetters(4);
        const firstName = `User${uniqueSuffix}`;
        const lastName = 'QA';
        const email = `test.${uniqueSuffix.toLowerCase()}${getRandomNumber(3)}@example.com`;
        const phone = `9${getRandomNumber(9)}`;
        const updatedFirstName = `${firstName}Edit`;

        // 1. Navigate to Users Page
        await usersPage.gotoUsersPage();

        // 2. Add New User
        await usersPage.addUser({
            firstName,
            lastName,
            email,
            password: 'Password@123',
            phone,
            gender: 'Male',
            roleName: 'Agent',
        });
        await expect(page.getByText('User created successfully')).toBeVisible();

        // 3. Search and Verify in Table
        await usersPage.searchUser(firstName);
        await expect(page.getByRole('cell', { name: firstName })).toBeVisible();

        // 4. View User
        await usersPage.viewUser(firstName);

        // 5. Edit User
        await usersPage.editUser(firstName, updatedFirstName);
        await expect(page.getByText('User updated successfully')).toBeVisible();

        // 6. Search Updated User & Delete
        await usersPage.searchUser(updatedFirstName);
        await expect(page.getByRole('cell', { name: updatedFirstName })).toBeVisible();
        await usersPage.deleteUser(updatedFirstName);
        await expect(page.getByText(/User (deleted|deactivated) successfully/i)).toBeVisible();
    });
});
