import { test, expect } from '../../fixtures/auth.fixture';
import { CallDispositionReportPage } from '../../pages/reports/call_disposition_report.page';
import { TEST_AGENT } from '../../utils/test_agent';

test.describe('Call Disposition Report', () => {
  test('should open the call disposition report', async ({ page }) => {
    const report = new CallDispositionReportPage(page);
    await report.goto();

    await expect(page.getByRole('columnheader', { name: /Category/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Sub Disposition/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Count/i })).toBeVisible();
  });

  test('should filter by agent', async ({ page }) => {
    test.setTimeout(60_000);
    const report = new CallDispositionReportPage(page);
    await report.goto();
    const response = await report.filterByAgent(TEST_AGENT.name);
    expect(new URL(response.url()).searchParams.get('agent_id')).toMatch(/^\d+$/);
  });
});
