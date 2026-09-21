import { test, expect } from '../../fixtures/integration.fixture';
import type { Page } from '@playwright/test';
import { DuplicateLeadsPage } from '../../pages/main_menu/duplicate_leads.page';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

type IntegrationCleanup = {
    registerLead(id: number): void;
    registerConfig(id: number): void;
};

async function readLead(page: Page, id: number) {
    const apiOrigin = new URL(process.env.API_BASE_URL!).origin;
    const response = await page.request.get(`${apiOrigin}/api/v1/leads/${id}`, {
        // Reading a lead is idempotent, so retry transient connection resets.
        maxRetries: 2,
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    return body.data;
}

async function lookupFirstId(page: Page, path: string): Promise<number> {
    const response = await page.request.get(`${process.env.API_BASE_URL!}${path}`, {
        // Lookup reads are idempotent. Retry only transport-level resets such as
        // ECONNRESET; HTTP failures still fail the assertion below immediately.
        maxRetries: 2,
    });
    expect(response.ok(), `${path} lookup should succeed`).toBeTruthy();
    const body = await response.json();
    const rows = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.data?.data)
            ? body.data.data
            : [];
    expect(rows.length, `${path} should contain at least one option`).toBeGreaterThan(0);
    return Number(rows[0].id);
}

async function seedDuplicatePair(
    page: Page,
    cleanup: IntegrationCleanup,
    options: {
        primaryName: string;
        sourceName: string;
        phone: string;
        primaryRemarks: string;
        sourceEmail?: string;
    },
): Promise<{ primaryId: number; sourceId: number }> {
    const apiBase = process.env.API_BASE_URL!;
    const unique = getRandomLetters(6);
    const apiKey = `qa_duplicate_${unique}_${getRandomNumber(6)}`;
    const leads = new LeadsPage(page);
    await leads.gotoLeadsPage();
    const primary = await leads.addLead({
        name: options.primaryName,
        phone: options.phone,
        remarks: options.primaryRemarks,
    });
    cleanup.registerLead(primary.id);

    const [projectId, leadSourceId] = await Promise.all([
        lookupFirstId(page, '/api/v1/lookups/projects'),
        lookupFirstId(page, '/api/v1/lookups/lead-sources'),
    ]);

    const configResponse = await page.request.post(`${apiBase}/api/v1/integration-configs`, {
        data: {
            name: `QA Duplicate ${unique}`,
            source_type: 'WEBSITE_API',
            provider_name: 'QA Automation',
            auth_type: 'API_KEY',
            credentials: { api_key: apiKey },
            default_project_id: projectId,
            default_lead_source_id: leadSourceId,
            sync_mode: 'MANUAL',
            is_active: true,
            payload_field_mapping: {
                fields: {
                    name: { external_key: 'name' },
                    primary_phone: { external_key: 'primary_phone' },
                    email: { external_key: 'email' },
                },
            },
        },
    });
    const configBody = await configResponse.json();
    expect(configResponse.ok(), `Integration seed failed: ${configResponse.status()}`).toBeTruthy();
    const configId = Number(configBody?.data?.id);
    expect(configId).toBeGreaterThan(0);
    cleanup.registerConfig(configId);

    const response = await page.request.post(`${apiBase}/api/v1/public/leads`, {
        headers: { 'x-api-key': apiKey },
        data: {
            name: options.sourceName,
            primary_phone: options.phone,
            email: options.sourceEmail,
        },
    });
    const body = await response.json();
    expect(response.ok(), `Public duplicate seed failed: ${response.status()}`).toBeTruthy();
    const sourceId = Number(body?.data?.lead_id);
    expect(sourceId).toBeGreaterThan(0);
    cleanup.registerLead(sourceId);
    expect(body.data).toMatchObject({ status: 'DUPLICATE_PENDING_REVIEW', duplicate: true });

    return { primaryId: primary.id, sourceId };
}

test.describe('Duplicate Leads Module - Detection & Resolution', () => {
    test('should ignore a duplicate without changing either lead', async ({ page, integrationCleanup }) => {
        test.setTimeout(90_000);
        const duplicates = new DuplicateLeadsPage(page);
        const phone = `9${getRandomNumber(9)}`;
        const primaryName = `Primary${getRandomLetters(4)}`;
        const sourceName = `Ignored${getRandomLetters(4)}`;

        const seeded = await seedDuplicatePair(page, integrationCleanup, {
            primaryName,
            sourceName,
            phone,
            primaryRemarks: 'Primary data',
        });

        await duplicates.gotoDuplicateLeadsPage();
        await duplicates.searchDuplicate(phone);
        const result = await duplicates.resolveDuplicate(
            sourceName,
            'ignore',
            'Verified as separate customer',
        );

        expect(result).toMatchObject({
            action: 'ignore',
            status: 'ignored',
            source_lead_id: seeded.sourceId,
            target_lead_id: seeded.primaryId,
            copied_fields: [],
            source_archived: false,
        });
        expect((await readLead(page, seeded.primaryId)).deleted_at).toBeNull();
        expect((await readLead(page, seeded.sourceId)).deleted_at).toBeNull();

        await duplicates.filterByStatus('ignored');
        await duplicates.searchDuplicate(phone);
        await expect(duplicates.duplicateRow(sourceName)).toBeVisible();
    });

    test('should merge only missing data into the primary and archive the source', async ({
        page,
        integrationCleanup,
    }) => {
        test.setTimeout(90_000);
        const duplicates = new DuplicateLeadsPage(page);
        const unique = getRandomLetters(4);
        const phone = `9${getRandomNumber(9)}`;
        const primaryName = `Primary${unique}`;
        const sourceName = `Merged${unique}`;
        const sourceEmail = `merge.${unique.toLowerCase()}@example.com`;

        const seeded = await seedDuplicatePair(page, integrationCleanup, {
            primaryName,
            sourceName,
            phone,
            primaryRemarks: 'Keep primary',
            sourceEmail,
        });

        const primaryBefore = await readLead(page, seeded.primaryId);
        await duplicates.gotoDuplicateLeadsPage();
        await duplicates.searchDuplicate(phone);
        const result = await duplicates.resolveDuplicate(sourceName, 'merge', 'Same verified customer');

        expect(result).toMatchObject({
            action: 'merge',
            status: 'merged',
            source_lead_id: seeded.sourceId,
            target_lead_id: seeded.primaryId,
            source_archived: true,
        });
        expect(result.copied_fields).toContain('email');

        const primaryAfter = await readLead(page, seeded.primaryId);
        expect(primaryAfter.name).toBe(primaryBefore.name);
        expect(primaryAfter.primary_phone).toBe(primaryBefore.primary_phone);
        expect(primaryAfter.remarks).toBe('Keep primary');
        expect(primaryAfter.status).toBe(primaryBefore.status);
        expect(primaryAfter.email).toBe(sourceEmail);
        expect((await readLead(page, seeded.sourceId)).deleted_at).not.toBeNull();

        await duplicates.filterByStatus('merged');
        await duplicates.searchDuplicate(phone);
        await expect(duplicates.duplicateRow(sourceName)).toBeVisible();
    });
});
