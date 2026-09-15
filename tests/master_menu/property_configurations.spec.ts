import { test, expect } from '../../fixtures/auth.fixture';
import { PropertyConfigurationsPage } from '../../pages/master_menu/property_configurations.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Property Configurations Module', () => {
  test('should open the property configurations list', async ({ page }) => {
    const propertyConfigurationsPage = new PropertyConfigurationsPage(page);

    await propertyConfigurationsPage.gotoPropertyConfigurationsPage();

    await expect(page.getByRole('heading', { name: /Property Configurations/i })).toBeVisible();
  });

  test('should manage a property configuration lifecycle', async ({ page }) => {
    const propertyConfigurationsPage = new PropertyConfigurationsPage(page);
    const configurationName = `property configuration ${getRandomLetters(6)}`;
    const updatedConfigurationName = `${configurationName} updated`;

    await propertyConfigurationsPage.gotoPropertyConfigurationsPage();
    await propertyConfigurationsPage.addConfiguration(configurationName);
    await expect(page.getByText('Property configuration created successfully')).toBeVisible();

    await propertyConfigurationsPage.searchConfiguration(configurationName);
    await expect(propertyConfigurationsPage.configurationRow(configurationName)).toBeVisible();

    await propertyConfigurationsPage.viewConfiguration(configurationName);
    const viewDialog = page.getByRole('dialog', { name: 'View Property Configuration' });
    await expect(viewDialog).toContainText(configurationName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await propertyConfigurationsPage.editConfiguration(configurationName, updatedConfigurationName);
    await expect(page.getByText('Property configuration updated successfully')).toBeVisible();

    await propertyConfigurationsPage.searchConfiguration(updatedConfigurationName);
    await expect(propertyConfigurationsPage.configurationRow(updatedConfigurationName)).toBeVisible();
    await propertyConfigurationsPage.deactivateConfiguration(updatedConfigurationName);
    await expect(page.getByText('Property configuration deactivated successfully')).toBeVisible();

    await propertyConfigurationsPage.filterByStatus('Inactive');
    await expect(propertyConfigurationsPage.configurationRow(updatedConfigurationName)).toBeVisible();
    await propertyConfigurationsPage.restoreConfiguration(updatedConfigurationName);
    await expect(propertyConfigurationsPage.configurationRow(updatedConfigurationName)).toBeHidden();

    await propertyConfigurationsPage.filterByStatus('Active');
    await expect(propertyConfigurationsPage.configurationRow(updatedConfigurationName)).toBeVisible();
  });
});
