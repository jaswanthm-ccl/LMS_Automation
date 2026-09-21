import type { APIRequestContext, APIResponse } from '@playwright/test';
import { test as authenticatedTest, expect } from './auth.fixture';
import { archiveLead } from './lead-flow.fixture';

type IntegrationCleanup = {
  registerLead(id: number): void;
  registerConfig(id: number): void;
};

function apiOrigin(): string {
  const configured = process.env.API_BASE_URL;
  if (!configured) throw new Error('API_BASE_URL must be set for integration cleanup');
  return new URL(configured).origin;
}

async function withCleanupRetry(
  operation: () => Promise<APIResponse>,
): Promise<APIResponse> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await operation();
      if (response.status() !== 429 || attempt === 3) return response;

      const retryAfterSeconds = Number(response.headers()['retry-after']);
      const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : (attempt + 1) * 1_000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1_000));
    }
  }

  throw new Error('Integration cleanup retry loop ended unexpectedly');
}

async function deactivateConfig(request: APIRequestContext, id: number): Promise<void> {
  const base = apiOrigin();
  const readResponse = await withCleanupRetry(() =>
    request.get(`${base}/api/v1/integration-configs/${id}`),
  );
  if (!readResponse.ok()) {
    throw new Error(`Integration ${id} cleanup read failed: HTTP ${readResponse.status()}`);
  }

  const body = await readResponse.json();
  if (body?.data?.is_active === false) return;

  const response = await withCleanupRetry(() =>
    request.patch(`${base}/api/v1/integration-configs/${id}/deactivate`),
  );
  if (!response.ok()) {
    throw new Error(
      `Integration ${id} cleanup failed: ${response.status()} ${await response.text()}`,
    );
  }
}

export const test = authenticatedTest.extend<{
  integrationCleanup: IntegrationCleanup;
}>({
  integrationCleanup: async ({ page }, use) => {
    const leadIds: number[] = [];
    const configIds: number[] = [];

    await use({
      registerLead: (id) => leadIds.push(id),
      registerConfig: (id) => configIds.push(id),
    });

    const failures: unknown[] = [];
    for (const id of leadIds.reverse()) {
      try {
        await archiveLead(page.request, id);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const id of configIds.reverse()) {
      try {
        await deactivateConfig(page.request, id);
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Integration cleanup failed');
    }
  },
});

export { expect };
