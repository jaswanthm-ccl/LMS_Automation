import { test, expect } from '../../fixtures/auth.fixture';
import { DispositionCategoriesPage } from '../../pages/master_menu/disposition_categories.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Disposition Categories Module', () => {
  test('should open the disposition categories list', async ({ page }) => {
    const dispositionCategoriesPage = new DispositionCategoriesPage(page);

    await dispositionCategoriesPage.gotoDispositionCategoriesPage();

    await expect(page.getByRole('heading', { name: /Disposition Categories/i })).toBeVisible();
  });

  test('should create, search, view, edit, deactivate, and restore a disposition category', async ({ page }) => {
    const dispositionCategoriesPage = new DispositionCategoriesPage(page);
    const categoryName = `disposition category ${getRandomLetters(6)}`;
    const updatedCategoryName = `${categoryName} updated`;
    const subDispositionName = `sub disposition ${getRandomLetters(6)}`;

    await dispositionCategoriesPage.gotoDispositionCategoriesPage();
    await dispositionCategoriesPage.addCategory(categoryName, subDispositionName);

    await dispositionCategoriesPage.searchCategory(categoryName);
    await expect(dispositionCategoriesPage.categoryRow(categoryName)).toBeVisible();

    await dispositionCategoriesPage.viewCategory(categoryName);
    const viewDialog = page.getByRole('dialog', { name: 'View Disposition Category' });
    await expect(viewDialog).toContainText(categoryName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await dispositionCategoriesPage.editCategory(categoryName, updatedCategoryName);

    await dispositionCategoriesPage.searchCategory(updatedCategoryName);
    await expect(dispositionCategoriesPage.categoryRow(updatedCategoryName)).toBeVisible();
    await dispositionCategoriesPage.deactivateCategory(updatedCategoryName);

    await dispositionCategoriesPage.filterByStatus('Inactive');
    await expect(dispositionCategoriesPage.categoryRow(updatedCategoryName)).toBeVisible();
    await dispositionCategoriesPage.restoreCategory(updatedCategoryName);
    await expect(dispositionCategoriesPage.categoryRow(updatedCategoryName)).toBeHidden();

    await dispositionCategoriesPage.filterByStatus('Active');
    await expect(dispositionCategoriesPage.categoryRow(updatedCategoryName)).toBeVisible();
  });
});
