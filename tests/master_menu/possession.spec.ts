import { test, expect } from '../../fixtures/auth.fixture';
import { PossessionPage } from '../../pages/master_menu/possession.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Possession Module', () => {
  test('should open the possession list', async ({ page }) => {
    const possessionPage = new PossessionPage(page);

    await possessionPage.gotoPossessionPage();

    await expect(page.getByRole('heading', { name: /Possession/i })).toBeVisible();
  });

  test('should manage a possession lifecycle', async ({ page }) => {
    const possessionPage = new PossessionPage(page);
    const possessionName = `possession ${getRandomLetters(6)}`;
    const updatedPossessionName = `${possessionName} updated`;

    await possessionPage.gotoPossessionPage();
    await possessionPage.addPossession(possessionName);
    await expect(page.getByText(/Possession created successfully/i)).toBeVisible();

    await possessionPage.searchPossession(possessionName);
    await expect(possessionPage.possessionRow(possessionName)).toBeVisible();

    await possessionPage.viewPossession(possessionName);
    const viewDialog = page.getByRole('dialog', { name: /View Possession/i });
    await expect(viewDialog).toContainText(possessionName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await possessionPage.editPossession(possessionName, updatedPossessionName);
    await expect(page.getByText(/Possession updated successfully/i)).toBeVisible();

    await possessionPage.searchPossession(updatedPossessionName);
    await expect(possessionPage.possessionRow(updatedPossessionName)).toBeVisible();
    await possessionPage.deactivatePossession(updatedPossessionName);
    await expect(page.getByText(/Possession deactivated/i)).toBeVisible();

    await possessionPage.filterByStatus('Inactive');
    await expect(possessionPage.possessionRow(updatedPossessionName)).toBeVisible();
    await possessionPage.restorePossession(updatedPossessionName);
    await expect(page.getByText(/Possession (restored|activated) successfully/i)).toBeVisible();

    await possessionPage.filterByStatus('Active');
    await expect(possessionPage.possessionRow(updatedPossessionName)).toBeVisible();
  });
});
