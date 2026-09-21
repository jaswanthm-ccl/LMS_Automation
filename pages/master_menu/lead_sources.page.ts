import { Locator, Page, Response, expect } from '@playwright/test';

export type CreatedLeadSource = {
    id: number;
    detailsUrl: string;
    deactivateUrl: string;
};

const leadSourcesPath = /^\/api\/v1\/lead-sources\/?$/;
const leadSourcePath = /^\/api\/v1\/lead-sources\/\d+\/?$/;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class LeadSourcesPage {
    constructor(readonly page: Page) {}

    private get modal(): Locator {
        return this.page.locator('app-custom-model').filter({
            has: this.page.getByRole('textbox', { name: 'Enter lead source name' }),
        });
    }

    private get nameInput(): Locator {
        return this.modal.getByRole('textbox', { name: 'Enter lead source name' });
    }

    private get typeDropdown(): Locator {
        return this.modal.locator(
            'ccl-dropdown[placeholder="Select lead source type"] .ccl-dropdown__trigger',
        );
    }

    private get searchInput(): Locator {
        return this.page.getByRole('searchbox', { name: 'Search' });
    }

    private option(label: string): Locator {
        return this.page
            .locator('.ccl-dropdown__option:not(.ccl-dropdown__option--disabled)')
            .filter({
                has: this.page.locator('.ccl-dropdown__option-label', {
                    hasText: new RegExp(`^${escapeRegExp(label)}$`),
                }),
            });
    }

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
                Object.entries(query).every(
                    ([key, value]) => url.searchParams.get(key) === value,
                );
        });
    }

    private async expectSuccessful(
        responsePromise: Promise<Response>,
        operation: string,
    ): Promise<Response> {
        const response = await responsePromise;
        expect(response.ok(), `${operation} API request should succeed`).toBeTruthy();
        return response;
    }

    private async openRowAction(
        name: string,
        action: 'View' | 'Edit' | 'Deactivate' | 'Restore',
    ): Promise<void> {
        const row = this.leadSourceRow(name);
        await expect(row).toBeVisible();
        await row.getByTitle(action, { exact: true }).click();
    }

    leadSourceRow(name: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name, exact: true }),
        });
    }

    async gotoLeadSourcesPage(): Promise<void> {
        const response = this.waitForApi('GET', leadSourcesPath);
        await this.page.goto('/lead-sources');
        await this.expectSuccessful(response, 'Load Lead Sources');
        await expect(this.searchInput).toBeVisible();
    }

    async searchLeadSource(name: string): Promise<void> {
        const response = this.waitForApi('GET', leadSourcesPath, {
            search: name.toLowerCase(),
        });
        await this.searchInput.fill(name);
        await this.searchInput.press('Enter');
        await this.expectSuccessful(response, 'Search Lead Sources');
    }

    async filterByStatus(status: 'Active' | 'Inactive'): Promise<void> {
        const statusField = this.page
            .locator('ccl-form-field-wrapper')
            .filter({ hasText: /Status/ });

        if (!(await statusField.isVisible())) {
            await this.page.getByRole('button', { name: /Filters/ }).click();
            await expect(statusField).toBeVisible();
        }

        await statusField.locator('.ccl-dropdown__trigger').click();
        const response = this.waitForApi('GET', leadSourcesPath, {
            status: status.toLowerCase(),
        });
        await this.option(status).click();
        await this.expectSuccessful(response, `Filter ${status} Lead Sources`);
    }

    async addLeadSource(
        name: string,
        type = 'Upload',
        isDefault = false,
    ): Promise<CreatedLeadSource> {
        await this.page
            .locator('app-custom-list-table')
            .getByRole('button', { name: /\+\s*Add/ })
            .click();
        await expect(this.nameInput).toBeVisible();

        await this.nameInput.fill(name);
        await this.typeDropdown.click();
        await this.option(type).click();
        await this.modal.getByRole('checkbox', { name: /is default/i }).setChecked(isDefault);

        const responsePromise = this.waitForApi('POST', leadSourcesPath);
        await this.modal.getByRole('button', { name: 'Save', exact: true }).click();
        const response = await this.expectSuccessful(responsePromise, 'Create Lead Source');

        const body = await response.json();
        const id = Number(body?.data?.id ?? body?.id);
        expect(Number.isInteger(id), 'Create response should include an ID').toBeTruthy();

        const createUrl = new URL(response.url());
        const detailsUrl = `${createUrl.origin}${createUrl.pathname.replace(/\/$/, '')}/${id}`;
        return { id, detailsUrl, deactivateUrl: `${detailsUrl}/deactivate` };
    }

    async viewLeadSource(name: string): Promise<void> {
        const response = this.waitForApi('GET', leadSourcePath);
        await this.openRowAction(name, 'View');
        await this.expectSuccessful(response, 'View Lead Source');
    }

    async editLeadSource(name: string, updatedName: string, isDefault = false): Promise<void> {
        await this.openRowAction(name, 'Edit');
        await expect(this.nameInput).toHaveValue(name);
        await this.nameInput.fill(updatedName);
        await this.modal.getByRole('checkbox', { name: /is default/i }).setChecked(isDefault);

        const response = this.waitForApi('PUT', leadSourcePath);
        await this.modal.getByRole('button', { name: 'Save', exact: true }).click();
        await this.expectSuccessful(response, 'Update Lead Source');
    }

    async deactivateLeadSource(name: string): Promise<void> {
        await this.openRowAction(name, 'Deactivate');
        const response = this.waitForApi(
            'PATCH',
            /^\/api\/v1\/lead-sources\/\d+\/deactivate\/?$/,
        );
        await this.page.locator('.delete-modal')
            .getByRole('button', { name: 'Yes', exact: true })
            .click();
        await this.expectSuccessful(response, 'Deactivate Lead Source');
    }

    async restoreLeadSource(name: string): Promise<void> {
        await this.openRowAction(name, 'Restore');
        const response = this.waitForApi(
            'PATCH',
            /^\/api\/v1\/lead-sources\/\d+\/activate\/?$/,
        );
        await this.page.locator('.delete-modal')
            .getByRole('button', { name: 'Yes', exact: true })
            .click();
        await this.expectSuccessful(response, 'Restore Lead Source');
    }
}
