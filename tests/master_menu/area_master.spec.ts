import { test, expect } from '../../fixtures/auth.fixture';
import { AreaMasterPage } from '../../pages/master_menu/area_master.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Area Master Module - CRUD & Lifecycle', () => {
  test('should create, search, view, edit, deactivate, and restore an area', async ({ page }) => {
    const areaMasterPage = new AreaMasterPage(page);
    const areaName = `area ${getRandomLetters(6)}`;
    const updatedAreaName = `${areaName} updated`;

    await areaMasterPage.gotoAreaMasterPage();

    await areaMasterPage.addArea(areaName);
    await expect(page.getByText(/Area (master )?created successfully/i)).toBeVisible();

    await areaMasterPage.searchArea(areaName);
    await expect(areaMasterPage.areaRow(areaName)).toBeVisible();

    await areaMasterPage.viewArea(areaName);
    const viewDialog = page.getByRole('dialog').filter({ hasText: areaName }).last();
    await expect(viewDialog).toContainText(areaName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await areaMasterPage.editArea(areaName, updatedAreaName);
    await expect(page.getByText(/Area (master )?updated successfully/i)).toBeVisible();

    await areaMasterPage.searchArea(updatedAreaName);
    await expect(areaMasterPage.areaRow(updatedAreaName)).toBeVisible();

    await areaMasterPage.deactivateArea(updatedAreaName);
    await expect(page.getByText(/Area (master )?deactivated( successfully)?/i)).toBeVisible();

    await areaMasterPage.filterByStatus('Inactive');
    await expect(areaMasterPage.areaRow(updatedAreaName)).toBeVisible();

    await areaMasterPage.restoreArea(updatedAreaName);
    await expect(page.getByText(/Area (master )?(restored|activated) successfully/i)).toBeVisible();

    await areaMasterPage.filterByStatus('Active');
    await expect(areaMasterPage.areaRow(updatedAreaName)).toBeVisible();
  });
});
