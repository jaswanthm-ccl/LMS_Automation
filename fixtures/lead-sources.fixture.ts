import type { APIRequestContext } from '@playwright/test';
import { test as authenticatedTest, expect } from './auth.fixture';
import type { CreatedLeadSource } from '../pages/master_menu/lead_sources.page';

type LeadSourceCleanup = {
    register(leadSource: CreatedLeadSource): void;
};

export async function deactivateLeadSourceIfActive(
    request: APIRequestContext,
    leadSource: CreatedLeadSource,
): Promise<void> {
    const current = await request.get(leadSource.detailsUrl);
    if (!current.ok()) {
        throw new Error(
            `Lead source cleanup could not read ID ${leadSource.id}: HTTP ${current.status()}`,
        );
    }

    const body = await current.json();
    const data = body?.data;
    if (!data || !Object.prototype.hasOwnProperty.call(data, 'deleted_at')) {
        throw new Error(
            `Lead source cleanup response for ID ${leadSource.id} is missing data.deleted_at`,
        );
    }

    if (data.deleted_at !== null) {
        return;
    }

    const deactivated = await request.patch(leadSource.deactivateUrl);
    if (!deactivated.ok()) {
        throw new Error(
            `Lead source cleanup failed for ID ${leadSource.id}: HTTP ${deactivated.status()}`,
        );
    }
}

export const test = authenticatedTest.extend<{ leadSourceCleanup: LeadSourceCleanup }>({
    leadSourceCleanup: async ({ page }, use) => {
        const createdLeadSources: CreatedLeadSource[] = [];

        await use({
            register: (leadSource) => createdLeadSources.push(leadSource),
        });

        for (const leadSource of createdLeadSources.reverse()) {
            await deactivateLeadSourceIfActive(page.request, leadSource);
        }
    },
});

export { expect };
