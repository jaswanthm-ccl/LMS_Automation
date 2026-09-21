import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test } from '../../fixtures/agent.fixture';
import { CallbackQueuePage } from '../../pages/main_menu/callback_queue.page';
import { DooctiDialerPage } from '../../pages/main_menu/doocti_dialer.page';
import { RecordingsPage } from '../../pages/main_menu/recordings.page';
import { getRandomLetters } from '../../utils/common';
import {
  extractCallLogId,
  findRecordingForCall,
  type DooctiRecording,
} from '../../utils/doocti_call_contract';
import {
  cleanupSeededAgentLead,
  seedLeadForTestAgent,
} from '../../utils/seed_agent_lead';
import { TEST_AGENT } from '../../utils/test_agent';

const REAL_CALL_PHONE = '6374376247';
const CALL_INITIATE_TIMEOUT_MS = 60_000;
const RECORDING_WEBHOOK_TIMEOUT_MS = 3 * 60_000;

async function openLeadRow(page: Page, leadName: string): Promise<Locator> {
  const initialResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/agent/leads' &&
      response.request().method() === 'GET',
  );
  await page.goto('/my-leads');
  expect((await initialResponse).ok(), 'My Leads should load successfully').toBeTruthy();
  await expect(page.getByRole('heading', { name: /My Assigned Leads/i })).toBeVisible();

  const searchResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/agent/leads' &&
      response.request().method() === 'GET',
  );
  const search = page.getByRole('searchbox', { name: /Search/i });
  await search.fill(leadName);
  await search.press('Enter');
  expect((await searchResponse).ok(), 'My Leads search should succeed').toBeTruthy();

  const row = page.getByRole('row').filter({
    has: page.getByRole('cell', { name: leadName, exact: true }),
  });
  await expect(row).toBeVisible({ timeout: 20_000 });
  return row;
}

async function waitForRecording(
  request: APIRequestContext,
  callLogId: number,
  leadId: number,
): Promise<DooctiRecording> {
  const apiBase = process.env.API_BASE_URL!;
  let recording: DooctiRecording | null = null;

  await expect.poll(
    async () => {
      const response = await request.get(
        `${apiBase}/api/v1/agent/recordings?lead_id=${leadId}&page=1&limit=20&sort_order=desc`,
      );
      if (!response.ok()) {
        throw new Error(`Recordings API failed with HTTP ${response.status()}`);
      }
      recording = findRecordingForCall(await response.json(), callLogId);
      return recording?.recording_status ?? null;
    },
    {
      message: `Recording for call log ${callLogId} should arrive from Doocti`,
      timeout: RECORDING_WEBHOOK_TIMEOUT_MS,
      intervals: [2_000, 5_000, 10_000],
    },
  ).toBe('AVAILABLE');

  if (!recording) throw new Error(`Recording for call log ${callLogId} was not returned`);
  return recording;
}

function tomorrowAtTen(): { date: string; time: string } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: '10:00' };
}

async function selectDispositionOption(
  page: Page,
  form: Locator,
  fieldLabel: string,
  optionName: string,
): Promise<void> {
  const field = form.locator('ccl-form-field-wrapper').filter({ hasText: fieldLabel });
  await field.locator('.ccl-dropdown__trigger').click();
  await page
    .locator('.ccl-dropdown__option:visible')
    .filter({ hasText: new RegExp(`^\\s*${optionName}\\s*$`, 'i') })
    .click();
}

async function scheduleCallbackDisposition(
  page: Page,
  callLogId: number,
  notes: string,
): Promise<void> {
  const modal = page.locator('app-custom-model:visible');
  const form = modal.locator('app-call-disposition-form');
  await expect(form, 'Disposition form should open after the answered call ends').toBeVisible({
    timeout: 90_000,
  });

  await selectDispositionOption(page, form, 'Disposition Category', 'Connected');
  await selectDispositionOption(page, form, 'Sub Disposition', 'Callback Requested');

  const callback = tomorrowAtTen();
  await form.locator('input[formcontrolname="callback_date"]').fill(callback.date);
  await form.locator('input[formcontrolname="callback_time"]').fill(callback.time);
  await form.getByRole('textbox', { name: /Enter Notes/i }).fill(notes);

  const dispositionResponse = page.waitForResponse(
    (candidate) =>
      new URL(candidate.url()).pathname === `/api/v1/calls/${callLogId}/disposition` &&
      candidate.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await dispositionResponse;
  expect(
    response.ok(),
    `Callback disposition failed with HTTP ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
  await expect(page.getByText('Disposition saved successfully', { exact: true })).toBeVisible();
}

test.describe('Doocti real call', () => {
  test('initiates, completes, records, and disposes a real call', async ({ page, browser }) => {
    test.setTimeout(RECORDING_WEBHOOK_TIMEOUT_MS + 180_000);

    const seededLead = await seedLeadForTestAgent(browser, { phone: REAL_CALL_PHONE });
    const dialer = new DooctiDialerPage(page);
    const agentEmail = process.env.AGENT_EMAIL ?? TEST_AGENT.email;
    let dialerLoggedOut = false;
    let testError: unknown;

    try {
      await page.goto('/my-leads');
      await dialer.enterDialer(process.env.DOOCTI_QUEUE_NAME);

      if (process.env.DOOCTI_AUTH_ONLY === 'true') {
        console.log('Doocti authentication-only check passed; no call was initiated.');
      } else {
        const leadRow = await openLeadRow(page, seededLead.name);
        await dialer.minimize();
        const [response, vendorResponse] = await Promise.all([
          page.waitForResponse(
            (candidate) =>
              new URL(candidate.url()).pathname === '/api/v1/calls/initiate' &&
              candidate.request().method() === 'POST',
            { timeout: CALL_INITIATE_TIMEOUT_MS },
          ),
          page.waitForResponse(
            (candidate) =>
              /\/api\/crm\/call/i.test(new URL(candidate.url()).pathname) &&
              candidate.request().method() === 'POST',
            { timeout: CALL_INITIATE_TIMEOUT_MS },
          ),
          leadRow.getByTitle('Call', { exact: true }).click({ force: true }),
        ]);
        expect(response.ok(), `Call initiation failed with HTTP ${response.status()}`).toBeTruthy();
        expect(
          vendorResponse.ok(),
          `Doocti call request failed with HTTP ${vendorResponse.status()}: ${await vendorResponse.text()}`,
        ).toBeTruthy();
        const callLogId = extractCallLogId(await response.json());
        expect(callLogId, 'Call initiation should return a call_log_id').not.toBeNull();

        console.log(`Call ${callLogId} initiated. Please answer and end the call on ${REAL_CALL_PHONE}.`);

        const recording = await waitForRecording(
          page.context().request,
          callLogId!,
          seededLead.lead_id,
        );
        expect(recording.call_status).toBe('COMPLETED');

        const callbackNotes = `Automated callback ${getRandomLetters(6)}`;
        await scheduleCallbackDisposition(page, callLogId!, callbackNotes);

        await dialer.logout();
        dialerLoggedOut = true;

        const callbackQueue = new CallbackQueuePage(page);
        await callbackQueue.goto();
        await callbackQueue.selectQueueType('Upcoming');
        const callbackRow = callbackQueue.followUpRow(seededLead.name);
        await expect(callbackRow).toBeVisible({ timeout: 20_000 });
        await expect(callbackRow).toContainText(callbackNotes);

        const recordings = new RecordingsPage(page);
        const { allowed } = await recordings.goto();
        expect(allowed, 'Agent should access the Recordings module').toBeTruthy();
        const recordingRow = recordings.recordingRow(seededLead.name).filter({
          has: page.getByRole('cell', { name: String(callLogId), exact: true }),
        });
        await expect(recordingRow).toBeVisible({ timeout: 20_000 });
        await expect(recordingRow).toContainText(/XXXXXX6247/);
        await expect(recordingRow).toContainText(/AVAILABLE/i);
        await expect(recordingRow).toContainText(/COMPLETED/i);
        const duration = recordingRow
          .getByRole('cell')
          .filter({ hasText: /^\s*\d{2}:\d{2}:\d{2}\s*$/ });
        await expect(duration).not.toHaveText('00:00:00');
      }
    } catch (error) {
      testError = error;
    } finally {
      let logoutError: unknown;
      if (!dialerLoggedOut) {
        await dialer.logout().catch((error) => {
          logoutError = error;
        });
      }
      await dialer.tryForceLogout(agentEmail).catch((error) =>
        console.warn('Doocti force-logout cleanup:', error),
      );
      await dialer.restore().catch((error) => console.warn('Doocti restore cleanup:', error));
      await cleanupSeededAgentLead(browser, seededLead);
      if (!testError && logoutError) testError = logoutError;
    }

    if (testError) throw testError;
  });
});
