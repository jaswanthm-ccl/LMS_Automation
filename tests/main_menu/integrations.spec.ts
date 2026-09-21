import { test, expect } from '../../fixtures/integration.fixture';
import {
  IntegrationSettingsPage,
  IntegrationSyncLogPage,
} from '../../pages/main_menu/integration.page';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

/**
 * Admin Integration Management — UI shell + real inbound lead via public API.
 * Uses EMAIL/PASSWORD from .env (setup → chromium storageState).
 */

async function lookupFirstId(
  page: import('@playwright/test').Page,
  path: string,
): Promise<number> {
  const apiBase = process.env.API_BASE_URL!;
  const res = await page.context().request.get(`${apiBase}${path}`);
  expect(res.ok(), `${path} should load`).toBeTruthy();
  const body = await res.json();
  const rows = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.data?.data)
      ? body.data.data
      : [];
  expect(rows.length, `${path} should return rows`).toBeGreaterThan(0);
  return Number(rows[0].id);
}

test.describe('Integration Management (admin)', () => {
  test.describe.configure({ mode: 'serial' });

  let createdConfigId = 0;
  let createdLeadId = 0;

  test('should open integration settings shell', async ({ page }) => {
    const settings = new IntegrationSettingsPage(page);
    await settings.goto();
    await settings.expectTableShell();
  });

  test('should open integration sync log shell', async ({ page }) => {
    const logs = new IntegrationSyncLogPage(page);
    await logs.goto();
    await logs.expectTableShell();
  });

  test('should reject Integration Settings navigation when its API fails', async ({ page }) => {
    await page.route('**/api/v1/integration-configs**', (route) =>
      route.fulfill({ status: 500, json: { message: 'Injected failure' } }),
    );

    await expect(new IntegrationSettingsPage(page).goto()).rejects.toThrow(/HTTP 500/);
  });

  test('should reject Sync Logs navigation when its API fails', async ({ page }) => {
    await page.route('**/api/v1/integration-sync-logs**', (route) =>
      route.fulfill({ status: 500, json: { message: 'Injected failure' } }),
    );

    await expect(new IntegrationSyncLogPage(page).goto()).rejects.toThrow(/HTTP 500/);
  });

  test('should accept a public lead via API key and show sync + lead', async ({
    page,
    integrationCleanup,
  }) => {
    test.setTimeout(120_000);
    const apiBase = process.env.API_BASE_URL!;
    expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();

    const unique = getRandomLetters(6);
    const integrationName = `QA Web API ${unique}`;
    const apiKey = `qa_key_${unique}_${getRandomNumber(6)}`;
    const leadName = `IntegLead${unique}`;
    const phone = `9${getRandomNumber(9)}`;

    // Prefer existing project/source lookups used elsewhere in suite
    const projectId = await lookupFirstId(page, '/api/v1/lookups/projects');

    const leadSourceId = await lookupFirstId(page, '/api/v1/lookups/lead-sources');

    // 1) Create dedicated WEBSITE_API integration with known API key
    const createRes = await page.context().request.post(
      `${apiBase}/api/v1/integration-configs`,
      {
        data: {
          name: integrationName,
          source_type: 'WEBSITE_API',
          provider_name: 'QA Automation',
          auth_type: 'API_KEY',
          credentials: { api_key: apiKey },
          default_project_id: projectId,
          default_lead_source_id: leadSourceId,
          sync_mode: 'MANUAL',
          is_active: true,
          payload_field_mapping: {
            fields: {
              name: { external_key: 'name' },
              primary_phone: { external_key: 'primary_phone' },
            },
          },
        },
      },
    );
    const createText = await createRes.text();
    expect(
      createRes.ok(),
      `Create integration failed: ${createRes.status()} ${createText.slice(0, 400)}`,
    ).toBeTruthy();
    const created = JSON.parse(createText);
    const configId = Number(created?.data?.id);
    expect(configId).toBeGreaterThan(0);
    createdConfigId = configId;
    integrationCleanup.registerConfig(configId);
    console.log('created integration', configId, integrationName);

    // 2) Simulate third party → public lead intake
    const intakeRes = await page.context().request.post(
      `${apiBase}/api/v1/public/leads`,
      {
        headers: { 'x-api-key': apiKey },
        data: {
          name: leadName,
          primary_phone: phone,
        },
      },
    );
    const intakeText = await intakeRes.text();
    expect(
      intakeRes.ok(),
      `Public lead intake failed: ${intakeRes.status()} ${intakeText.slice(0, 400)}`,
    ).toBeTruthy();
    const intake = JSON.parse(intakeText);
    const leadId = Number(intake?.data?.lead_id);
    expect(leadId, 'Public intake should return data.lead_id').toBeGreaterThan(0);
    expect(intake?.data?.status).toBe('PENDING');
    expect(intake?.data?.duplicate).toBe(false);
    createdLeadId = leadId;
    integrationCleanup.registerLead(leadId);

    // 3) Sync log should show successful activity for this exact integration
    const logsRes = await page.context().request.get(
      `${apiBase}/api/v1/integration-sync-logs?integration_config_id=${configId}&page=1&limit=5`,
    );
    expect(logsRes.ok(), `Sync logs list: ${logsRes.status()}`).toBeTruthy();
    const logsBody = await logsRes.json();
    const logs = Array.isArray(logsBody?.data) ? logsBody.data : [];
    const match = logs.find(
      (row: { integration_config_id?: number }) =>
        Number(row.integration_config_id) === configId,
    );
    expect(match, 'Expected a sync log for the QA integration').toBeTruthy();
    expect(match.status).toBe('SUCCESS');
    expect(match.records_received).toBe(1);
    expect(match.records_created).toBe(1);
    expect(match.duplicate_count).toBe(0);
    expect(match.rejected_count).toBe(0);

    // 4) Lead should be searchable in LMS
    const leadsPage = new LeadsPage(page);
    await leadsPage.gotoLeadsPage();
    await leadsPage.searchLead(leadName);
    await expect(leadsPage.leadRow(leadName)).toBeVisible({ timeout: 20_000 });
  });

  test('should clean up the public lead and integration configuration', async ({ page }) => {
    expect(createdLeadId).toBeGreaterThan(0);
    expect(createdConfigId).toBeGreaterThan(0);

    const apiBase = process.env.API_BASE_URL!;
    const leadResponse = await page.request.get(
      `${apiBase}/api/v1/leads/${createdLeadId}`,
    );
    expect(leadResponse.ok()).toBeTruthy();
    const lead = await leadResponse.json();
    expect(lead.data.status).toBe('ARCHIVED');
    expect(lead.data.deleted_at).not.toBeNull();

    const configResponse = await page.request.get(
      `${apiBase}/api/v1/integration-configs/${createdConfigId}`,
    );
    expect(configResponse.ok()).toBeTruthy();
    const config = await configResponse.json();
    expect(config.data.is_active).toBe(false);
  });
});
