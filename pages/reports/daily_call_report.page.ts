import { type Page } from '@playwright/test';
import { ReportPageBase } from './report_base.page';

export class DailyCallReportPage extends ReportPageBase {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/daily-call-report');
    await this.expectReportShell(/Daily Call Report/i);
    await this.waitForTableIdle();
  }

  async filterByAgent(agentName: string) {
    return this.selectFilter('Agent', agentName);
  }

  async filterByCallStatus(status: string): Promise<void> {
    await this.selectFilter('Call Status', status);
  }
}
