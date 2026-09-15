import { CountriesPage } from '../../pages/master_menu/countries.page';
import { test, expect } from '../../fixtures/auth.fixture';
import {
  EXISTING_COUNTRY,
  EXISTING_COUNTRY_CODE2,
  EXISTING_COUNTRY_CODE3,
} from '../../utils/common';

test.describe('Countries Module', () => {
  // Avoid random country creates (ISO / env limit). Ensure shared country exists, then verify.
  test('should ensure shared country exists and is searchable', async ({ page }) => {
    const countriesPage = new CountriesPage(page);

    await countriesPage.ensureCountryExists(
      EXISTING_COUNTRY,
      EXISTING_COUNTRY_CODE2,
      EXISTING_COUNTRY_CODE3,
    );

    await countriesPage.searchCountry(EXISTING_COUNTRY);
    await expect(page.getByRole('cell', { name: EXISTING_COUNTRY, exact: true })).toBeVisible();
  });
});
