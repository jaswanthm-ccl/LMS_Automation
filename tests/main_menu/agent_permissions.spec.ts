import { test, expect } from '../../fixtures/agent.fixture';

const reportingApis = [
  { name: 'Dashboard summary', path: '/api/v1/dashboard/summary' },
  { name: 'Daily Call Report', path: '/api/v1/reports/daily-calls' },
  { name: 'Agent Performance Report', path: '/api/v1/reports/agent-performance' },
  { name: 'Call Disposition Report', path: '/api/v1/reports/dispositions' },
  { name: 'Follow-Up Pending Report', path: '/api/v1/reports/follow-ups-pending' },
  { name: 'Conversion Report', path: '/api/v1/reports/conversion' },
] as const;

test.describe('Agent role permissions', () => {
  test('should expose only the approved Agent permissions', async ({ page }) => {
    const apiBase = process.env.API_BASE_URL!;
    expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();

    const response = await page.request.get(`${apiBase}/api/v1/users/profile`);
    expect(response.status()).toBe(200);
    const profile = (await response.json()).data;
    const permissionSlugs = profile.permissions.map((permission: string | { slug?: string; name?: string }) =>
      typeof permission === 'string' ? permission : permission.slug ?? permission.name,
    );

    expect(profile.role.name).toBe('Agent');
    expect([...permissionSlugs].sort()).toEqual([
      'agent_leads_view',
      'disposition_category_view',
      'recording_playback_own',
    ].sort());
  });

  for (const report of reportingApis) {
    test(`should deny Agent access to ${report.name}`, async ({ page }) => {
      const apiBase = process.env.API_BASE_URL!;
      expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();

      const response = await page.request.get(`${apiBase}${report.path}`);
      expect(response.status(), `${report.name} must reject the default Agent role`).toBe(403);
    });
  }

  test('should render safe Agent content for direct admin-page navigation', async ({ page }) => {
    for (const path of ['/dashboard-component', '/users', '/roles']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: /My Assigned Leads/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Save Settings/i })).toHaveCount(0);
    }
  });

  test('should hide admin-only navigation links from the Agent menu', async ({ page }) => {
    test.fail(true, 'Known LMS frontend defect: Agent menu exposes admin integration/settings links');

    await page.goto('/my-leads');
    await expect(page.getByRole('heading', { name: /My Assigned Leads/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Integration Setting Config/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Integration Sync Log/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Settings/i })).toHaveCount(0);
  });

  test('should block the Distribution Settings page from the Agent UI', async ({ page }) => {
    test.fail(true, 'Known LMS frontend defect: Agent can render the Distribution Settings form');

    await page.goto('/settings');

    const restrictedHeading = page.getByRole('heading', { name: 'Distribution Settings' });
    const safeHeading = page.getByRole('heading', { name: /My Assigned Leads|Access Denied/i });
    await expect(restrictedHeading.or(safeHeading)).toBeVisible();
    await expect(restrictedHeading).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Save Settings/i })).toHaveCount(0);
    await expect(safeHeading).toBeVisible();
  });
});
