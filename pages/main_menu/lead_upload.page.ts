import { expect, type Locator, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

export class LeadUploadPage {
  readonly page: Page;
  readonly importButton: Locator;
  readonly downloadSampleButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.importButton = page.getByRole('button', { name: /Import/i });
    this.downloadSampleButton = page.getByRole('button', { name: /Download Sample/i });
  }

  async gotoLeads(): Promise<void> {
    await this.page.goto('/lead');
    await expect(this.importButton).toBeVisible();
  }

  async openImportDialog(): Promise<Locator> {
    await this.importButton.click();
    const dialog = this.page.getByRole('dialog', { name: /Import Leads/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Upload file/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Browse File/i })).toBeVisible();
    return dialog;
  }

  async openUploadHistory(): Promise<void> {
    const dialog = await this.openImportDialog();
    await dialog.getByRole('button', { name: /View Upload History/i }).click();
    await expect(this.page.getByRole('columnheader', { name: /File Name/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /Uploaded By/i })).toBeVisible();
  }

  /** Builds a minimal CSV using required template headers + known masters. */
  buildSampleCsv(options: {
    leadName: string;
    phone: string;
    leadSource: string;
    project?: string;
    country?: string;
    state?: string;
    city?: string;
  }): string {
    const headers = [
      'lead name',
      'primary phone',
      'lead source',
      'project',
      'country',
      'state',
      'city',
      'remarks',
    ];
    const row = [
      options.leadName,
      options.phone,
      options.leadSource,
      options.project ?? '',
      options.country ?? 'India',
      options.state ?? 'Tamil Nadu',
      options.city ?? 'Chennai',
      'automation upload',
    ];
    return `${headers.join(',')}\n${row.map((v) => `"${v}"`).join(',')}\n`;
  }

  writeTempCsv(contents: string): string {
    const filePath = path.join(
      os.tmpdir(),
      `lms-lead-upload-${getRandomLetters(5)}-${getRandomNumber(4)}.csv`,
    );
    fs.writeFileSync(filePath, contents, 'utf-8');
    return filePath;
  }

  async uploadFile(filePath: string): Promise<void> {
    const dialog = await this.openImportDialog();
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    const submit = dialog.getByRole('button', { name: /Upload|Submit|Save|Next|Continue/i });
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    }
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
  }

  async uploadViaApi(filePath: string): Promise<{ batchId: number }> {
    const apiBase = process.env.API_BASE_URL!;
    const response = await this.page.context().request.post(`${apiBase}/api/v1/lead-uploads`, {
      multipart: {
        file: {
          name: path.basename(filePath),
          mimeType: 'text/csv',
          buffer: fs.readFileSync(filePath),
        },
      },
    });
    const text = await response.text();
    expect(response.ok(), `Upload failed: ${response.status()} ${text}`).toBeTruthy();
    const body = JSON.parse(text);
    const batchId = Number(body?.data?.id ?? body?.data?.upload_batch_id);
    expect(batchId, `Upload batch id missing: ${text.slice(0, 300)}`).toBeGreaterThan(0);
    return { batchId };
  }

  async processBatch(batchId: number): Promise<{
    status: 'COMPLETED';
    totalRows: number;
    successCount: number;
    duplicateCount: number;
    rejectedCount: number;
  }> {
    const apiBase = process.env.API_BASE_URL!;
    const response = await this.page.context().request.post(
      `${apiBase}/api/v1/lead-uploads/${batchId}/process`,
    );
    const text = await response.text();
    expect(response.ok(), `Process failed: ${response.status()} ${text}`).toBeTruthy();
    const body = JSON.parse(text);
    const data = body?.data;
    return {
      status: String(data?.status) as 'COMPLETED',
      totalRows: Number(data?.total_rows),
      successCount: Number(data?.success_count),
      duplicateCount: Number(data?.duplicate_count),
      rejectedCount: Number(data?.rejected_count),
    };
  }
}
