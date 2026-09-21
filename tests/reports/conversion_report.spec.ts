import { test, expect } from '../../fixtures/auth.fixture';
import { ConversionReportPage } from '../../pages/reports/conversion_report.page';
import { TEST_AGENT } from '../../utils/test_agent';

test.describe('Conversion Report', () => {
  test('should open the conversion report', async ({ page }) => {
    const report = new ConversionReportPage(page);
    await report.goto();

    await expect(page.getByRole('columnheader', { name: /Lead Name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible();
  });

  test('should filter by agent', async ({ page }) => {
    test.setTimeout(60_000);
    const report = new ConversionReportPage(page);
    await report.goto();
    const response = await report.filterByAgent(TEST_AGENT.name);
    expect(new URL(response.url()).searchParams.get('agent_id')).toMatch(/^\d+$/);
  });
});
