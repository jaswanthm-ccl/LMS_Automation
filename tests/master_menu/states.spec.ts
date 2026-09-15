import { test, expect } from '../../fixtures/auth.fixture';
import { CountriesPage } from '../../pages/master_menu/countries.page';
import { StatesPage } from '../../pages/master_menu/states.page';
import {
  EXISTING_COUNTRY,
  EXISTING_COUNTRY_CODE2,
  EXISTING_COUNTRY_CODE3,
  getRandomLetters,
} from '../../utils/common';

test.describe('States Module - CRUD & Lifecycle', () => {
  test('should create, search, edit, and deactivate a state', async ({ page }) => {
    test.setTimeout(60000);
    const countriesPage = new CountriesPage(page);
    const statesPage = new StatesPage(page);
    const uniqueStateName = `state ${getRandomLetters(4)}`;
    const uniqueStateCode = getRandomLetters(2);

    await countriesPage.ensureCountryExists(
      EXISTING_COUNTRY,
      EXISTING_COUNTRY_CODE2,
      EXISTING_COUNTRY_CODE3,
    );

    await statesPage.gotoStatesPage();
    await statesPage.addState(uniqueStateName, uniqueStateCode, EXISTING_COUNTRY);
    await expect(page.getByText('State created successfully')).toBeVisible();

    await statesPage.searchState(uniqueStateName);
    await expect(page.getByRole('cell', { name: uniqueStateName })).toBeVisible();

    const updatedStateName = `${uniqueStateName} updated`;
    await statesPage.editState(updatedStateName);
    await expect(page.getByText('State updated successfully')).toBeVisible();

    await statesPage.deleteState(updatedStateName);
    await expect(page.getByText('State deactivated')).toBeVisible();

    await statesPage.filterByStatus('Inactive');
    await statesPage.searchState(updatedStateName);
    await expect(page.getByRole('cell', { name: updatedStateName })).toBeVisible();
    await expect(page.getByLabel('Inactive, error badge').getByText('Inactive')).toBeVisible();
  });

  test('should restore an inactive state', async ({ page }) => {
    test.setTimeout(60000);
    const countriesPage = new CountriesPage(page);
    const statesPage = new StatesPage(page);
    const uniqueStateName = `state ${getRandomLetters(4)}`;
    const uniqueStateCode = getRandomLetters(2);

    await countriesPage.ensureCountryExists(
      EXISTING_COUNTRY,
      EXISTING_COUNTRY_CODE2,
      EXISTING_COUNTRY_CODE3,
    );

    await statesPage.gotoStatesPage();
    await statesPage.addState(uniqueStateName, uniqueStateCode, EXISTING_COUNTRY);
    await expect(page.getByText('State created successfully')).toBeVisible();
    await statesPage.deleteState(uniqueStateName);
    await expect(page.getByText('State deactivated')).toBeVisible();

    await statesPage.filterByStatus('Inactive');
    await statesPage.restoreState(uniqueStateName);
    await expect(page.getByText('State restored successfully')).toBeVisible();
  });
});
