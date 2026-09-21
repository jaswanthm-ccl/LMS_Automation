import { expect, type Page } from '@playwright/test';
import { ReportPageBase } from './report_base.page';

export class ConversionReportPage extends ReportPageBase {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/conversion-report');
    // Title may render as plain text rather than a heading role.
    await expect(this.page.getByText(/Conversion Report/i).first()).toBeVisible();
    await expect(this.exportButton).toBeVisible();
    await expect(this.filtersButton).toBeVisible();
    await this.waitForTableIdle();
  }

  async filterByAgent(agentName: string) {
    return this.selectFilter('Agent', agentName);
  }

  async filterByProject(projectName: string): Promise<void> {
    await this.selectFilter('Project', projectName);
  }
}
