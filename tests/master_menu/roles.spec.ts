import { test, expect } from "../../fixtures/role.fixture";
import { RolesPage } from "../../pages/master_menu/roles.page";
import { getRandomLetters } from "../../utils/common";


test.describe('Roles Module - CRUD & Lifecycle', () => {
    test.describe.configure({ mode: 'serial' });

    let cleanedUpRoleName = '';

    test('should create, search, view, edit, and deactivate a role', async ({ page, roleCleanup }) => {
        const rolesPage = new RolesPage(page);
        const uniqueRoleName = `role ${getRandomLetters(4)}`;
        const updatedRoleName = `${uniqueRoleName} updated`;
        cleanedUpRoleName = updatedRoleName;

        // 1. Navigate
        await rolesPage.gotoRolesPage();

        // 2. Add Role
        const createdRole = await rolesPage.addRole(uniqueRoleName, 'for test');
        roleCleanup.register(createdRole);
        await expect(page.getByText('Role created successfully')).toBeVisible();

        // 3. Search & Verify in Table
        await rolesPage.searchRole(uniqueRoleName);
        await expect(page.getByRole('cell', { name: uniqueRoleName })).toBeVisible();

        // 4. View Role 
        await rolesPage.viewRole(uniqueRoleName);
        await expect(page.getByRole('cell', { name: uniqueRoleName })).toBeVisible();
     
        // 5. Edit Role 
        await rolesPage.editRole(uniqueRoleName, updatedRoleName);

        await expect(page.getByText('Role updated successfully')).toBeVisible();

        // 6. Search Updated Role and Deactivate
        await rolesPage.searchRole(updatedRoleName); 
        await rolesPage.deleteRole(updatedRoleName);
        await expect(page.getByText('Role deactivated successfully')).toBeVisible();
        await rolesPage.filterByStatus('Inactive');
        await rolesPage.searchRole(updatedRoleName);
        await expect(page.getByRole('cell', { name: updatedRoleName })).toBeVisible();
        await rolesPage.restoreRole(updatedRoleName);
        await expect(page.getByText('Role restored successfully')).toBeVisible();
        await rolesPage.filterByStatus('Active');
        await rolesPage.searchRole(updatedRoleName);
        await expect(page.getByRole('cell', { name: updatedRoleName })).toBeVisible();
        
    });

    test('should leave the created role inactive after automatic cleanup', async ({ page }) => {
        const rolesPage = new RolesPage(page);

        await rolesPage.gotoRolesPage();
        await rolesPage.filterByStatus('Inactive');
        await rolesPage.searchRole(cleanedUpRoleName);

        const cleanedUpRole = rolesPage.roleRow(cleanedUpRoleName);
        await expect(cleanedUpRole).toBeVisible();
        await expect(cleanedUpRole.getByText('Inactive', { exact: true })).toBeVisible();
    });

});
