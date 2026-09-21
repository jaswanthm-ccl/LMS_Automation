import { Locator, Page, Response, expect } from '@playwright/test';

export type DuplicateResolution = {
    id: number;
    status: 'ignored' | 'merged';
    action: 'ignore' | 'merge';
    reason: string;
    source_lead_id: number;
    target_lead_id: number;
    copied_fields: string[];
    source_archived: boolean;
};

const listPath = /^\/api\/v1\/duplicate-leads\/?$/;
const actionPath = /^\/api\/v1\/duplicate-leads\/\d+\/action\/?$/;

export class DuplicateLeadsPage {
    constructor(readonly page: Page) {}

    private waitForApi(
        method: string,
        path: RegExp,
        query: Record<string, string> = {},
    ): Promise<Response> {
        return this.page.waitForResponse((response) => {
            const request = response.request();
            const url = new URL(response.url());
            return request.resourceType() === 'xhr' &&
                request.method() === method &&
                path.test(url.pathname) &&
                Object.entries(query).every(([key, value]) => url.searchParams.get(key) === value);
        });
    }

    private async successful(responsePromise: Promise<Response>, operation: string): Promise<Response> {
        const response = await responsePromise;
        expect(response.ok(), `${operation} API request should succeed`).toBeTruthy();
        return response;
    }

    async gotoDuplicateLeadsPage(): Promise<void> {
        const response = this.waitForApi('GET', listPath);
        await this.page.goto('/duplicate-leads');
        await this.successful(response, 'Load Duplicate Leads');
        await expect(this.page.getByRole('searchbox', { name: 'Search' })).toBeVisible();
    }

    async searchDuplicate(term: string): Promise<void> {
        const search = this.page.getByRole('searchbox', { name: 'Search' });
        if ((await search.inputValue()) === term) {
            return;
        }

        const response = this.waitForApi('GET', listPath, { search: term.toLowerCase() });
        await search.fill(term);
        await search.press('Enter');
        await this.successful(response, 'Search Duplicate Leads');
    }

    duplicateRow(identifier: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name: identifier, exact: true }),
        });
    }

    async resolveDuplicate(
        identifier: string,
        action: 'ignore' | 'merge',
        reason: string,
    ): Promise<DuplicateResolution> {
        const row = this.duplicateRow(identifier);
        await expect(row).toBeVisible();
        const actionButton = row.getByRole('button');
        await expect(actionButton).toHaveCount(1);
        await actionButton.click();

        const dialog = this.page.getByRole('dialog', { name: 'Duplicate Lead Review' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('textbox', { name: /reason/i }).fill(reason);

        await dialog.getByRole('button', { name: new RegExp(`^${action}$`, 'i') }).click();
        const confirm = this.page.getByRole('dialog', {
            name: new RegExp(`Confirm ${action}`, 'i'),
        });
        await expect(confirm).toBeVisible();

        const responsePromise = this.waitForApi('PATCH', actionPath);
        await confirm.getByRole('button', { name: /^Yes$|^Confirm$/i }).click();
        const response = await this.successful(responsePromise, `${action} Duplicate Lead`);
        await expect(confirm).toBeHidden();

        const body = await response.json();
        return (body.data ?? body) as DuplicateResolution;
    }

    async filterByStatus(status: 'pending' | 'merged' | 'ignored'): Promise<void> {
        const statusField = this.page
            .locator('ccl-form-field-wrapper')
            .filter({ hasText: /status/i });
        if (!(await statusField.isVisible())) {
            await this.page.getByRole('button', { name: /filters/i }).click();
            await expect(statusField).toBeVisible();
        }

        await statusField.locator('.ccl-dropdown__trigger').click();
        const response = this.waitForApi('GET', listPath, { duplicate_status: status });
        await this.page
            .locator('.ccl-dropdown__option-label')
            .filter({ hasText: new RegExp(`^${status}$`, 'i') })
            .click();
        await this.successful(response, `Filter ${status} Duplicate Leads`);
    }
}
