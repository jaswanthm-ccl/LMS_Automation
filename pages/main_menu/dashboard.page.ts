import { expect, type Locator, type Page, type Response } from '@playwright/test';

const dashboardSummaryPath = /\/api\/v1\/dashboard\/summary\/?$/;

export class DashboardPage {
  readonly heading: Locator;
  readonly totalLeadsCard: Locator;
  readonly conversionFunnelSection: Locator;
  readonly liveOperationsSection: Locator;
  readonly hourlyProductivitySection: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;

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
    this.startDateInput = this.filterField('Start Date').locator('input[type="text"]');
    this.endDateInput = this.filterField('End Date').locator('input[type="text"]');
  }

  private filterField(label: string): Locator {
    return this.page.locator('ccl-form-field-wrapper').filter({ hasText: label });
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
    if (!(await this.startDateInput.isVisible())) {
      await this.page.getByRole('button', { name: /Filters/ }).click();
    }
    await expect(this.startDateInput).toBeVisible();
  }

  kpiCard(key: string): Locator {
    const labels: Record<string, string> = {
      total_leads: 'Total Leads',
      connected_leads: 'Connected Leads',
      overall_conversion_rate: 'Conversion Rate',
      follow_ups: 'Follow Ups',
      overdue_follow_ups: 'Overdue Follow Ups',
    };
    const label = labels[key];
    if (!label) {
      throw new Error(`Unsupported dashboard KPI: ${key}`);
    }
    return this.page.getByText(label, { exact: true }).locator('../..');
  }

  async applyDateRange(startDate: string, endDate: string): Promise<Response> {
    await this.startDateInput.fill(startDate);
    await expect(this.endDateInput).toBeEnabled();

    const response = this.waitForSummary();
    await this.endDateInput.fill(endDate);
    await this.endDateInput.press('Tab');
    return this.expectSuccessful(response);
  }

  async resetFilters(): Promise<Response> {
    const response = this.waitForSummary();
    await this.page.getByRole('button', { name: /Reset/ }).click();
    return this.expectSuccessful(response);
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
