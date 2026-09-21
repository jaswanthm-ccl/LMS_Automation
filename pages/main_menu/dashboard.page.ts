import { expect, type Locator, type Page, type Response } from '@playwright/test';

const dashboardSummaryPath = /\/api\/v1\/dashboard\/summary\/?$/;

export class DashboardPage {
  readonly heading: Locator;
  readonly totalLeadsCard: Locator;
  readonly conversionFunnelSection: Locator;
  readonly liveOperationsSection: Locator;
  readonly hourlyProductivitySection: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Dashboard', exact: true });
    this.totalLeadsCard = page.getByText('Total Leads', { exact: true });
    this.conversionFunnelSection = page.getByRole('heading', {
      name: /Conversion Funnel Analysis/,
    });
    this.liveOperationsSection = page.getByText('Live Operations', { exact: true });
    this.hourlyProductivitySection = page.getByText('Hourly Productivity Heatmap', {
      exact: true,
    });
  }

  private waitForSummary(): Promise<Response> {
    return this.page.waitForResponse((response) => {
      const request = response.request();
      const url = new URL(response.url());

      return request.method() === 'GET' &&
        request.resourceType() === 'xhr' &&
        dashboardSummaryPath.test(url.pathname);
    });
  }

  private async expectSuccessful(responsePromise: Promise<Response>): Promise<Response> {
    const response = await responsePromise;
    expect(response.ok(), 'Dashboard summary API request should succeed').toBeTruthy();
    return response;
  }

  async gotoDashboard(): Promise<Response> {
    const response = this.waitForSummary();
    await this.page.goto('/dashboard-component');
    const result = await this.expectSuccessful(response);
    await expect(this.heading).toBeVisible();
    return result;
  }

  async openFilters(): Promise<void> {
    await this.page.getByRole('button', { name: /Filters/ }).click();
    await expect(this.page.getByText('Project', { exact: true })).toBeVisible();
  }

  async refresh(): Promise<Response> {
    const response = this.waitForSummary();
    await this.page.getByRole('button', { name: /Refresh/ }).click();
    return this.expectSuccessful(response);
  }

  async openDailyCallReport(): Promise<void> {
    await this.page.getByRole('button', { name: /Daily Call Report/ }).click();
  }
}
