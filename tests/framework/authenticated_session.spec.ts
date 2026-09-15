import { test, expect } from '../../fixtures/auth.fixture';

test('browser project starts with an authenticated session', async ({ page }) => {
  await page.goto('/dashboard-component');

  await expect(page).toHaveURL(/dashboard-component/);
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();

  const loginRequests = await page.evaluate(() =>
    performance.getEntriesByType('resource').filter(({ name }) => name.includes('/auth/login')).length,
  );
  expect(loginRequests).toBe(0);
});
