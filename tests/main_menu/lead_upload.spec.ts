import { test, expect } from '../../fixtures/lead-flow.fixture';
import fs from 'fs';
import { LeadUploadPage } from '../../pages/main_menu/lead_upload.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

test.describe('Lead Upload', () => {
  test.describe.configure({ mode: 'serial' });

  let uploadedLeadId = 0;

  test('should open import dialog and upload history', async ({ page }) => {
    const uploadPage = new LeadUploadPage(page);

    await uploadPage.gotoLeads();
    await expect(uploadPage.downloadSampleButton).toBeVisible();

    const dialog = await uploadPage.openImportDialog();
    await expect(dialog.locator('input[type="file"]')).toBeAttached();
    await dialog.getByRole('button', { name: 'Close modal' }).click();

    await uploadPage.openUploadHistory();
    await expect(page.getByRole('columnheader', { name: /Status/i }).first()).toBeVisible();
  });

  test('should upload a CSV and process the batch', async ({ page, leadFlowCleanup }) => {
    test.setTimeout(90_000);
    const uploadPage = new LeadUploadPage(page);
    const apiBase = process.env.API_BASE_URL!;

    const sourcesRes = await page.context().request.get(`${apiBase}/api/v1/lookups/lead-sources`);
    expect(sourcesRes.ok()).toBeTruthy();
    const sourcesBody = await sourcesRes.json();
    const sources = Array.isArray(sourcesBody?.data)
      ? sourcesBody.data
      : Array.isArray(sourcesBody?.data?.data)
        ? sourcesBody.data.data
        : [];
    expect(sources.length, 'Need at least one lead source').toBeGreaterThan(0);
    const leadSource = String(sources[0].label || sources[0].name);

    const leadName = `UploadLead${getRandomLetters(5)}`;
    const phone = `9${getRandomNumber(9)}`;
    const csv = uploadPage.buildSampleCsv({ leadName, phone, leadSource });
    const filePath = uploadPage.writeTempCsv(csv);

    try {
      const { batchId } = await uploadPage.uploadViaApi(filePath);
      const processResult = await uploadPage.processBatch(batchId);
      expect(processResult.status).toBe('COMPLETED');
      expect(processResult.totalRows).toBe(1);
      expect(processResult.successCount).toBe(1);
      expect(processResult.duplicateCount).toBe(0);
      expect(processResult.rejectedCount).toBe(0);

      // Confirm batch appears in history API
      const historyRes = await page.context().request.get(`${apiBase}/api/v1/lead-uploads?limit=10`);
      expect(historyRes.ok()).toBeTruthy();
      const history = await historyRes.json();
      const rows = Array.isArray(history?.data) ? history.data : [];
      const match = rows.find((r: { id?: number }) => Number(r.id) === batchId);
      expect(match, `Uploaded batch ${batchId} should appear in history`).toBeTruthy();

      const leadsRes = await page.context().request.get(
        `${apiBase}/api/v1/leads?search=${encodeURIComponent(leadName)}&page=1&limit=20`,
      );
      expect(leadsRes.ok()).toBeTruthy();
      const leadsBody = await leadsRes.json();
      const leads = Array.isArray(leadsBody?.data) ? leadsBody.data : [];
      const uploadedLead = leads.find((lead: { id?: number; name?: string }) =>
        lead.name === leadName,
      );
      uploadedLeadId = Number(uploadedLead?.id);
      expect(uploadedLeadId, 'Processed upload should create the exact lead').toBeGreaterThan(0);
      leadFlowCleanup.registerLead(uploadedLeadId);

      await uploadPage.gotoLeads();
      await uploadPage.openUploadHistory();
      await expect(page.getByRole('columnheader', { name: /File Name/i })).toBeVisible();
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('should archive the lead created by the upload during cleanup', async ({ page }) => {
    expect(uploadedLeadId, 'The upload test should capture its created lead id').toBeGreaterThan(0);
    const apiOrigin = new URL(process.env.API_BASE_URL!).origin;
    const response = await page.request.get(`${apiOrigin}/api/v1/leads/${uploadedLeadId}`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.status).toBe('ARCHIVED');
    expect(body.data.deleted_at).not.toBeNull();
  });
});
