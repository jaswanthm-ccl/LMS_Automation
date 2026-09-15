import { test, expect } from '../../fixtures/auth.fixture';
import { PropertyPurposePage } from '../../pages/master_menu/property_purpose.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Property Purpose Module', () => {
  test('should open the property purpose list', async ({ page }) => {
    const propertyPurposePage = new PropertyPurposePage(page);

    await propertyPurposePage.gotoPropertyPurposePage();

    await expect(page.getByRole('heading', { name: /Property Purpose/i })).toBeVisible();
  });

  test('should manage a property purpose lifecycle', async ({ page }) => {
    const propertyPurposePage = new PropertyPurposePage(page);
    const purposeName = `property purpose ${getRandomLetters(6)}`;
    const updatedPurposeName = `${purposeName} updated`;

    await propertyPurposePage.gotoPropertyPurposePage();
    await propertyPurposePage.addPropertyPurpose(purposeName);
    await expect(page.getByText(/Property purpose created successfully/i)).toBeVisible();

    await propertyPurposePage.searchPropertyPurpose(purposeName);
    await expect(propertyPurposePage.propertyPurposeRow(purposeName)).toBeVisible();

    await propertyPurposePage.viewPropertyPurpose(purposeName);
    const viewDialog = page.getByRole('dialog', { name: /View Property Purpose/i });
    await expect(viewDialog).toContainText(purposeName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await propertyPurposePage.editPropertyPurpose(purposeName, updatedPurposeName);
    await expect(page.getByText(/Property purpose updated successfully/i)).toBeVisible();

    await propertyPurposePage.searchPropertyPurpose(updatedPurposeName);
    await expect(propertyPurposePage.propertyPurposeRow(updatedPurposeName)).toBeVisible();
    await propertyPurposePage.deactivatePropertyPurpose(updatedPurposeName);
    await expect(page.getByText(/Property purpose deactivated/i)).toBeVisible();

    await propertyPurposePage.filterByStatus('Inactive');
    await expect(propertyPurposePage.propertyPurposeRow(updatedPurposeName)).toBeVisible();
    await propertyPurposePage.restorePropertyPurpose(updatedPurposeName);
    await expect(page.getByText(/Property purpose (restored|activated) successfully/i)).toBeVisible();

    await propertyPurposePage.filterByStatus('Active');
    await expect(propertyPurposePage.propertyPurposeRow(updatedPurposeName)).toBeVisible();
  });
});
