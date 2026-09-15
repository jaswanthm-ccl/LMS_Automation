import { test, expect } from '../../fixtures/auth.fixture';
import { FloorDetailsPage } from '../../pages/master_menu/floor_details.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Floor Details Module - CRUD & Lifecycle', () => {
  test('should create, search, view, edit, deactivate, and restore a floor detail', async ({ page }) => {
    const floorDetailsPage = new FloorDetailsPage(page);
    const floorDetailName = `floor detail ${getRandomLetters(6)}`;
    const updatedFloorDetailName = `${floorDetailName} updated`;

    await floorDetailsPage.gotoFloorDetailsPage();

    await floorDetailsPage.addFloorDetail(floorDetailName);
    await expect(page.getByText(/Floor detail (master )?created successfully/i)).toBeVisible();

    await floorDetailsPage.searchFloorDetail(floorDetailName);
    await expect(floorDetailsPage.floorDetailRow(floorDetailName)).toBeVisible();

    await floorDetailsPage.viewFloorDetail(floorDetailName);
    const viewDialog = page.getByRole('dialog').filter({ hasText: floorDetailName }).last();
    await expect(viewDialog).toContainText(floorDetailName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await floorDetailsPage.editFloorDetail(floorDetailName, updatedFloorDetailName);
    await expect(page.getByText(/Floor detail (master )?updated successfully/i)).toBeVisible();

    await floorDetailsPage.searchFloorDetail(updatedFloorDetailName);
    await expect(floorDetailsPage.floorDetailRow(updatedFloorDetailName)).toBeVisible();

    await floorDetailsPage.deactivateFloorDetail(updatedFloorDetailName);
    await expect(page.getByText(/Floor detail (master )?deactivated( successfully)?/i)).toBeVisible();

    await floorDetailsPage.filterByStatus('Inactive');
    await expect(floorDetailsPage.floorDetailRow(updatedFloorDetailName)).toBeVisible();

    await floorDetailsPage.restoreFloorDetail(updatedFloorDetailName);
    await expect(page.getByText(/Floor detail (master )?(restored|activated) successfully/i)).toBeVisible();

    await floorDetailsPage.filterByStatus('Active');
    await expect(floorDetailsPage.floorDetailRow(updatedFloorDetailName)).toBeVisible();
  });
});
