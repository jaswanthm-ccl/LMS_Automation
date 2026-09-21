import { test, expect } from '../../fixtures/auth.fixture';
import { IntegrationSyncAlertPage } from '../../pages/main_menu/integration_sync_alert.page';

test.describe('Integration Sync Alerts (admin)', () => {
  test('should open the alerts list and show its table shell', async ({ page }) => {
    const alerts = new IntegrationSyncAlertPage(page);
    await alerts.goto();
    await alerts.expectTableShell();
  });

  test('should reject navigation when the alerts API fails', async ({ page }) => {
    await page.route('**/api/v1/integration-sync-alerts**', (route) =>
      route.fulfill({ status: 500, json: { message: 'Injected failure' } }),
    );

    await expect(new IntegrationSyncAlertPage(page).goto()).rejects.toThrow(/HTTP 500/);
  });
});
