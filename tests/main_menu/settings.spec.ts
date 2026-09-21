import { test, expect } from '../../fixtures/auth.fixture';
import { SettingsPage } from '../../pages/main_menu/settings.page';

test.describe('Settings Module', () => {
  test('should load the current distribution settings without changing them', async ({ page }) => {
    const settingsPage = new SettingsPage(page);

    const response = await settingsPage.gotoSettings();
    const body = await response.json();

    expect(body.data).toEqual(expect.objectContaining({
      daily_lead_cap: expect.any(Number),
      sla_minutes: expect.any(Number),
      pending_alert_threshold_hours: expect.any(Number),
      inactivity_threshold_hours: expect.any(Number),
      calling_timezone: expect.any(String),
      calling_start_time: expect.any(String),
      calling_end_time: expect.any(String),
    }));

    for (const label of [
      'Daily Lead Cap',
      'SLA Minutes',
      'Pending Alert Threshold Hours',
      'Inactivity Threshold Hours',
      'Calling Timezone',
      'Calling Start Time',
      'Calling End Time',
    ]) {
      await expect(settingsPage.settingInput(label)).not.toHaveValue('');
    }

    await expect(settingsPage.saveButton).toBeVisible();
  });

  test('should reject navigation when the settings API fails', async ({ page }) => {
    await page.route('**/api/v1/distribution-settings', (route) =>
      route.fulfill({ status: 500, json: { message: 'Injected failure' } }),
    );

    await expect(new SettingsPage(page).gotoSettings()).rejects.toThrow(/HTTP 500/);
  });
});
