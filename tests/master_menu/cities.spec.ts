import { test, expect } from '../../fixtures/auth.fixture';
import { CountriesPage } from '../../pages/master_menu/countries.page';
import { CitiesPage } from '../../pages/master_menu/cities.page';
import {
  EXISTING_COUNTRY,
  EXISTING_COUNTRY_CODE2,
  EXISTING_COUNTRY_CODE3,
  EXISTING_STATE,
  getRandomLetters,
} from '../../utils/common';

test.describe('Cities Module - CRUD & Lifecycle', () => {
  test('should create, search, edit, and deactivate a city', async ({ page }) => {
    test.setTimeout(60000);
    const countriesPage = new CountriesPage(page);
    const citiesPage = new CitiesPage(page);
    const uniqueCityName = `city ${getRandomLetters(4)}`;

    await countriesPage.ensureCountryExists(
      EXISTING_COUNTRY,
      EXISTING_COUNTRY_CODE2,
      EXISTING_COUNTRY_CODE3,
    );

    await citiesPage.gotoCitiesPage();
    await citiesPage.addCity(uniqueCityName, EXISTING_COUNTRY, EXISTING_STATE);

    await citiesPage.searchCity(uniqueCityName);
    await expect(page.getByRole('cell', { name: uniqueCityName })).toBeVisible();

    const updatedCityName = `${uniqueCityName} updated`;
    await citiesPage.editCity(uniqueCityName, updatedCityName);
    await citiesPage.searchCity(updatedCityName);
    await expect(citiesPage.cityRow(updatedCityName)).toBeVisible();

    await citiesPage.deleteCity(updatedCityName);

    await citiesPage.filterByStatus('Inactive');
    await citiesPage.searchCity(updatedCityName);
    await expect(page.getByRole('cell', { name: updatedCityName })).toBeVisible();
    await expect(page.getByLabel('Inactive, error badge').getByText('Inactive')).toBeVisible();
  });

  test('should restore an inactive city', async ({ page }) => {
    test.setTimeout(60000);
    const countriesPage = new CountriesPage(page);
    const citiesPage = new CitiesPage(page);
    const uniqueCityName = `city ${getRandomLetters(4)}`;

    await countriesPage.ensureCountryExists(
      EXISTING_COUNTRY,
      EXISTING_COUNTRY_CODE2,
      EXISTING_COUNTRY_CODE3,
    );

    await citiesPage.gotoCitiesPage();
    await citiesPage.addCity(uniqueCityName, EXISTING_COUNTRY, EXISTING_STATE);
    await citiesPage.searchCity(uniqueCityName);
    await expect(citiesPage.cityRow(uniqueCityName)).toBeVisible();
    await citiesPage.deleteCity(uniqueCityName);

    await citiesPage.filterByStatus('Inactive');
    await citiesPage.searchCity(uniqueCityName);
    await expect(citiesPage.cityRow(uniqueCityName)).toBeVisible();
    await citiesPage.restoreCity(uniqueCityName);
    await citiesPage.filterByStatus('Active');
    await citiesPage.searchCity(uniqueCityName);
    await expect(citiesPage.cityRow(uniqueCityName)).toBeVisible();
  });
});
