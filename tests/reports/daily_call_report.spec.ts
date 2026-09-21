import { test, expect } from '../../fixtures/auth.fixture';
import { DailyCallReportPage } from '../../pages/reports/daily_call_report.page';
import { TEST_AGENT } from '../../utils/test_agent';

test.describe('Daily Call Report', () => {
  test('should open the daily call report', async ({ page }) => {
    const report = new DailyCallReportPage(page);
    await report.goto();

    await expect(page.getByRole('columnheader', { name: /Lead Name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Disposition/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Follow-Up Scheduled/i })).toBeVisible();
  });

  test('should filter by agent', async ({ page }) => {
    test.setTimeout(60_000);
    const report = new DailyCallReportPage(page);
    await report.goto();
    const response = await report.filterByAgent(TEST_AGENT.name);
    expect(new URL(response.url()).searchParams.get('agent_id')).toMatch(/^\d+$/);
  });
});
