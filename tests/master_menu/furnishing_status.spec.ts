import { test, expect } from '../../fixtures/auth.fixture';
import { FurnishingStatusPage } from '../../pages/master_menu/furnishing_status.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Furnishing Status Module - CRUD & Lifecycle', () => {
  test('should create, search, view, edit, deactivate, and restore a furnishing status', async ({ page }) => {
    const furnishingStatusPage = new FurnishingStatusPage(page);
    const furnishingStatusName = `furnishing status ${getRandomLetters(6)}`;
    const updatedFurnishingStatusName = `${furnishingStatusName} updated`;

    await furnishingStatusPage.gotoFurnishingStatusesPage();

    await furnishingStatusPage.addFurnishingStatus(furnishingStatusName);
    await expect(page.getByText(/Furnishing status created successfully/i)).toBeVisible();

    await furnishingStatusPage.searchFurnishingStatus(furnishingStatusName);
    await expect(furnishingStatusPage.furnishingStatusRow(furnishingStatusName)).toBeVisible();

    await furnishingStatusPage.viewFurnishingStatus(furnishingStatusName);
    const viewDialog = page.getByRole('dialog', { name: /View Furnishing Status/i });
    await expect(viewDialog).toContainText(furnishingStatusName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await furnishingStatusPage.editFurnishingStatus(furnishingStatusName, updatedFurnishingStatusName);
    await expect(page.getByText(/Furnishing status updated successfully/i)).toBeVisible();

    await furnishingStatusPage.searchFurnishingStatus(updatedFurnishingStatusName);
    await expect(furnishingStatusPage.furnishingStatusRow(updatedFurnishingStatusName)).toBeVisible();

    await furnishingStatusPage.deactivateFurnishingStatus(updatedFurnishingStatusName);

    await furnishingStatusPage.filterByStatus('Inactive');
    await expect(furnishingStatusPage.furnishingStatusRow(updatedFurnishingStatusName)).toBeVisible();

    await furnishingStatusPage.restoreFurnishingStatus(updatedFurnishingStatusName);

    await furnishingStatusPage.filterByStatus('Active');
    await expect(furnishingStatusPage.furnishingStatusRow(updatedFurnishingStatusName)).toBeVisible();
  });
});
