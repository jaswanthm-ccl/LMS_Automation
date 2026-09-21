import { test, expect } from '../../fixtures/auth.fixture';
import { AgentPerformancePage } from '../../pages/reports/agent_performance.page';
import { TEST_AGENT } from '../../utils/test_agent';

test.describe('Agent Performance', () => {
  test('should open the agent performance report', async ({ page }) => {
    const report = new AgentPerformancePage(page);
    await report.goto();

    await expect(page.getByRole('columnheader', { name: /^Agent/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Calls Made/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Follow-ups Scheduled/i })).toBeVisible();
  });

  test('should filter by agent', async ({ page }) => {
    test.setTimeout(60_000);
    const report = new AgentPerformancePage(page);
    await report.goto();
    const response = await report.filterByAgent(TEST_AGENT.name);
    expect(new URL(response.url()).searchParams.get('agent_id')).toMatch(/^\d+$/);
  });
});
