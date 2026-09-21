import type { APIRequestContext, APIResponse } from '@playwright/test';
import { test as authenticatedTest, expect } from './auth.fixture';

type LeadFlowCleanup = {
    registerLead(id: number): void;
    registerProject(id: number): void;
    registerUser(id: number): void;
};

function apiOrigin(): string {
    const configured = process.env.API_BASE_URL;
    if (!configured) {
        throw new Error('API_BASE_URL must be set for lead-flow cleanup');
    }
    return new URL(configured).origin;
}

async function withRateLimitRetry(
    operation: () => Promise<APIResponse>,
): Promise<APIResponse> {
    let lastTransportError: unknown;

    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            const response = await operation();
            if (response.status() !== 429 || attempt === 3) {
                return response;
            }

            const retryAfterSeconds = Number(response.headers()['retry-after']);
            const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                ? retryAfterSeconds * 1_000
                : (attempt + 1) * 1_000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        } catch (error) {
            lastTransportError = error;
            if (attempt === 3) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1_000));
        }
    }

    throw lastTransportError ?? new Error('Cleanup retry loop ended unexpectedly');
}

async function readRecord(request: APIRequestContext, url: string, label: string) {
    const response = await withRateLimitRetry(() => request.get(url));
    if (!response.ok()) {
        throw new Error(`${label} cleanup read failed: HTTP ${response.status()}`);
    }
    const body = await response.json();
    if (!body?.data || !Object.prototype.hasOwnProperty.call(body.data, 'deleted_at')) {
        throw new Error(`${label} cleanup response is missing data.deleted_at`);
    }
    return body.data;
}

export async function archiveLead(request: APIRequestContext, id: number): Promise<void> {
    const base = apiOrigin();
    const data = await readRecord(request, `${base}/api/v1/leads/${id}`, `Lead ${id}`);
    if (data.deleted_at !== null || data.status === 'ARCHIVED') {
        return;
    }

    const response = await withRateLimitRetry(() => request.patch(
        `${base}/api/v1/leads/${id}/status`,
        { data: { status: 'ARCHIVED', remarks: 'Automation cleanup' } },
    ));
    if (!response.ok()) {
        throw new Error(`Lead ${id} cleanup failed: ${response.status()} ${await response.text()}`);
    }
}

async function deactivateProject(request: APIRequestContext, id: number): Promise<void> {
    const base = apiOrigin();
    const data = await readRecord(request, `${base}/api/v1/projects/${id}`, `Project ${id}`);
    if (data.deleted_at !== null) {
        return;
    }

    const response = await withRateLimitRetry(
        () => request.patch(`${base}/api/v1/projects/${id}/deactivate`),
    );
    if (!response.ok()) {
        throw new Error(`Project ${id} cleanup failed: ${response.status()} ${await response.text()}`);
    }
}

async function deactivateUser(request: APIRequestContext, id: number): Promise<void> {
    const base = apiOrigin();
    const data = await readRecord(request, `${base}/api/v1/users/${id}`, `User ${id}`);
    if (data.deleted_at !== null) {
        return;
    }

    const response = await withRateLimitRetry(
        () => request.delete(`${base}/api/v1/users/${id}`),
    );
    if (!response.ok()) {
        throw new Error(`User ${id} cleanup failed: ${response.status()} ${await response.text()}`);
    }
}

export const test = authenticatedTest.extend<{ leadFlowCleanup: LeadFlowCleanup }>({
    leadFlowCleanup: async ({ page }, use) => {
        const leadIds: number[] = [];
        const projectIds: number[] = [];
        const userIds: number[] = [];

        await use({
            registerLead: (id) => leadIds.push(id),
            registerProject: (id) => projectIds.push(id),
            registerUser: (id) => userIds.push(id),
        });

        for (const id of leadIds.reverse()) {
            await archiveLead(page.request, id);
        }
        for (const id of projectIds.reverse()) {
            await deactivateProject(page.request, id);
        }
        for (const id of userIds.reverse()) {
            await deactivateUser(page.request, id);
        }
    },
});

export { expect };
