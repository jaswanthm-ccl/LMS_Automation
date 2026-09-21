import { type Page } from '@playwright/test';
import { ReportPageBase } from './report_base.page';

export class CallDispositionReportPage extends ReportPageBase {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/call-disposition-report');
    await this.expectReportShell(/Call Disposition Report/i);
    await this.waitForTableIdle();
  }

  async filterByAgent(agentName: string) {
    return this.selectFilter('Agent', agentName);
  }

  async filterByProject(projectName: string): Promise<void> {
    await this.selectFilter('Project', projectName);
  }
}
