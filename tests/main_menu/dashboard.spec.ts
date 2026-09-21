import { test, expect } from '../../fixtures/auth.fixture';
import { DashboardPage } from '../../pages/main_menu/dashboard.page';

test.describe('Dashboard Module', () => {
  test('should load the dashboard summary and show its main sections', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    const response = await dashboardPage.gotoDashboard();
    const body = await response.json();

    expect(body.data).toEqual(expect.objectContaining({
      kpis: expect.any(Object),
      conversion_funnel: expect.any(Array),
      live_operations: expect.any(Object),
      hourly_productivity: expect.any(Object),
      report_shortcuts: expect.any(Array),
    }));
    await expect(dashboardPage.heading).toBeVisible();
    await expect(dashboardPage.totalLeadsCard).toBeVisible();
    await expect(dashboardPage.conversionFunnelSection).toBeVisible();
    await expect(dashboardPage.liveOperationsSection).toBeVisible();
    await expect(dashboardPage.hourlyProductivitySection).toBeVisible();
  });

  test('should render every KPI value returned by the dashboard API', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    const response = await dashboardPage.gotoDashboard();
    const body = await response.json();

    for (const [key, metric] of Object.entries(body.data.kpis) as Array<[string, {
      label: string;
      value: number;
      previous_value: number;
      change_percent: number | null;
      trend: 'up' | 'down' | 'flat';
    }]>) {
      expect(metric.previous_value).toEqual(expect.any(Number));
      expect(metric.change_percent === null || typeof metric.change_percent === 'number').toBeTruthy();
      expect(['up', 'down', 'flat']).toContain(metric.trend);
      await expect(dashboardPage.kpiCard(key)).toContainText(String(metric.value));
    }
  });

  test('should show the available dashboard filters', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.gotoDashboard();
    await dashboardPage.openFilters();

    await expect(page.getByText('Project', { exact: true })).toBeVisible();
    await expect(page.getByText('Start Date', { exact: true })).toBeVisible();
    await expect(page.getByText('End Date', { exact: true })).toBeVisible();
    await expect(page.getByText('Agent', { exact: true })).toBeVisible();
    await expect(page.getByText('Lead Source', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('should apply and reset a dashboard date range', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.gotoDashboard();
    await dashboardPage.openFilters();

    const filteredResponse = await dashboardPage.applyDateRange('01-01-2026', '02-01-2026');
    const filteredUrl = new URL(filteredResponse.url());
    expect(filteredUrl.searchParams.get('date_from')).toBe('2026-01-01');
    expect(filteredUrl.searchParams.get('date_to')).toBe('2026-01-02');

    const resetResponse = await dashboardPage.resetFilters();
    const resetUrl = new URL(resetResponse.url());
    expect(resetUrl.searchParams.has('date_from')).toBeFalsy();
    expect(resetUrl.searchParams.has('date_to')).toBeFalsy();
    await dashboardPage.openFilters();
    await expect(dashboardPage.startDateInput).toHaveValue('');
    await expect(dashboardPage.endDateInput).toHaveValue('');
  });

  test('should refresh the dashboard and open the daily call report', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.gotoDashboard();
    const refreshResponse = await dashboardPage.refresh();
    expect(new URL(refreshResponse.url()).searchParams.get('timezone')).toBeTruthy();

    await dashboardPage.openDailyCallReport();
    await expect(page).toHaveURL(/\/daily-call-report$/);
    await expect(page.getByText('Daily Call Report', { exact: true }).last()).toBeVisible();
  });
});
