import { type Page } from '@playwright/test';
import { ReportPageBase } from './report_base.page';

export class AgentPerformancePage extends ReportPageBase {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/agent-performance');
    await this.expectReportShell(/Agent Performance/i);
    await this.waitForTableIdle();
  }

  async filterByAgent(agentName: string) {
    return this.selectFilter('Agent', agentName);
  }

  async filterByProject(projectName: string): Promise<void> {
    await this.selectFilter('Project', projectName);
  }
}
