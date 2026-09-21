import { test, expect } from '../../fixtures/agent.fixture';

const protectedIntegrationApis = [
  { name: 'Integration Settings', path: '/api/v1/integration-configs' },
  {
    name: 'Integration Sync Logs',
    path: '/api/v1/integration-sync-logs?page=1&limit=5',
  },
  {
    name: 'Integration Sync Alerts',
    path: '/api/v1/integration-sync-alerts?page=1&limit=5',
  },
  { name: 'Distribution Settings', path: '/api/v1/distribution-settings' },
] as const;

test.describe('Integration Management access control (agent)', () => {
  for (const integrationApi of protectedIntegrationApis) {
    test(`should deny agent access to ${integrationApi.name}`, async ({ page }) => {
      const apiBase = process.env.API_BASE_URL!;
      expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();

      const response = await page.request.get(`${apiBase}${integrationApi.path}`);
      expect(
        response.status(),
        `${integrationApi.name} should be restricted to authorized admin roles`,
      ).toBe(403);
    });
  }
});
