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
