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

    await expect(settingsPage.settingInput('Daily Lead Cap')).toHaveValue(String(body.data.daily_lead_cap));
    await expect(settingsPage.settingInput('SLA Minutes')).toHaveValue(String(body.data.sla_minutes));
    await expect(settingsPage.settingInput('Pending Alert Threshold Hours')).toHaveValue(
      String(body.data.pending_alert_threshold_hours),
    );
    await expect(settingsPage.settingInput('Inactivity Threshold Hours')).toHaveValue(
      String(body.data.inactivity_threshold_hours),
    );
    await expect(settingsPage.settingInput('Calling Timezone')).toHaveValue(body.data.calling_timezone);
    await expect(settingsPage.settingInput('Calling Start Time')).toHaveValue(body.data.calling_start_time);
    await expect(settingsPage.settingInput('Calling End Time')).toHaveValue(body.data.calling_end_time);
    await expect(settingsPage.roundRobinResetRule).toContainText(
      settingsPage.resetRuleLabel(body.data.round_robin_reset_rule),
    );

    await expect(settingsPage.saveButton).toBeVisible();
  });

  test('should save the current settings without changing their values', async ({ page }) => {
    const settingsPage = new SettingsPage(page);

    const loadResponse = await settingsPage.gotoSettings();
    const original = (await loadResponse.json()).data;
    const saveResponse = await settingsPage.saveCurrentSettings();
    const requestBody = saveResponse.request().postDataJSON();
    const responseBody = await saveResponse.json();

    expect(requestBody).toEqual({
      daily_lead_cap: original.daily_lead_cap,
      sla_minutes: original.sla_minutes,
      pending_alert_threshold_hours: original.pending_alert_threshold_hours,
      inactivity_threshold_hours: original.inactivity_threshold_hours,
      round_robin_reset_rule: original.round_robin_reset_rule,
      calling_timezone: original.calling_timezone,
      calling_start_time: original.calling_start_time,
      calling_end_time: original.calling_end_time,
    });
    expect(responseBody.data.settings).toEqual(requestBody);
    await expect(page.getByText('Settings updated successfully', { exact: true })).toBeVisible();
  });

  test('should reject an invalid daily lead cap without changing the saved setting', async ({ page }) => {
    const settingsPage = new SettingsPage(page);

    const loadResponse = await settingsPage.gotoSettings();
    const originalDailyLeadCap = (await loadResponse.json()).data.daily_lead_cap;
    await settingsPage.settingInput('Daily Lead Cap').fill('0');
    await settingsPage.settingInput('SLA Minutes').click();
    await expect(page.getByText('Daily lead cap must be at least 1', { exact: true })).toBeVisible();

    const rejectedResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/api/v1/distribution-settings',
    );
    await settingsPage.saveButton.click();
    const rejectedResponse = await rejectedResponsePromise;
    expect(rejectedResponse.status()).toBe(422);
    await expect(page.getByText('Daily lead cap must be at least 1', { exact: true })).toBeVisible();

    await settingsPage.gotoSettings();
    await expect(settingsPage.settingInput('Daily Lead Cap')).toHaveValue(String(originalDailyLeadCap));
  });

  test('should reject navigation when the settings API fails', async ({ page }) => {
    await page.route('**/api/v1/distribution-settings', (route) =>
      route.fulfill({ status: 500, json: { message: 'Injected failure' } }),
    );

    await expect(new SettingsPage(page).gotoSettings()).rejects.toThrow(/HTTP 500/);
  });
});
