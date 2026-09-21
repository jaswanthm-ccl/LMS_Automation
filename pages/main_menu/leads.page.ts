import { Locator, Page, Response, expect } from "@playwright/test";
import { EXISTING_CITY, EXISTING_COUNTRY, EXISTING_STATE } from "../../utils/common";

export class LeadsPage {
    readonly page: Page;
    readonly addLeadButton: Locator;
    readonly nameInput: Locator;
    readonly phoneInput: Locator;
    readonly emailInput: Locator;
    readonly remarksInput: Locator;
    readonly saveButton: Locator;
    readonly searchInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.addLeadButton = page.getByRole('button', { name: '+ Add', exact: true });
        this.nameInput = page.locator('ccl-input[formcontrolname="name"] input');
        this.phoneInput = page.locator('ccl-input[formcontrolname="primary_phone"] input');
        this.emailInput = page.locator('ccl-input[formcontrolname="email"] input');
        this.remarksInput = page.getByRole('textbox', { name: 'Enter remarks', exact: true });
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    private waitForLeadList(search?: string): Promise<Response> {
        return this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            const actualSearch = url.searchParams.get('search');
            return response.request().resourceType() === 'xhr' &&
                response.request().method() === 'GET' &&
                /^\/api\/v1\/leads\/?$/.test(url.pathname) &&
                (search === undefined || actualSearch?.toLowerCase() === search.toLowerCase());
        });
    }

    private async successful(responsePromise: Promise<Response>, operation: string): Promise<Response> {
        const response = await responsePromise;
        expect(response.ok(), `${operation} API request should succeed`).toBeTruthy();
        return response;
    }

    // 1. Navigation
    async gotoLeadsPage() {
        const response = this.waitForLeadList();
        await this.page.goto('/lead');
        await this.successful(response, 'Load Leads');
        await expect(this.addLeadButton).toBeVisible();
    }

    // 2. Search
    async searchLead(term: string) {
        if ((await this.searchInput.inputValue()) === term) {
            return;
        }
        const response = this.waitForLeadList(term);
        await this.searchInput.fill(term);
        await this.searchInput.press('Enter');
        await this.successful(response, 'Search Leads');
    }

    // 3. Helper to locate a specific lead's row
    leadRow(identifier: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name: identifier, exact: true }),
        });
    }

    private dropdownTrigger(modal: Locator, placeholder: string): Locator {
        return modal
            .locator(`ccl-dropdown[placeholder="${placeholder}"]`)
            .locator('.ccl-dropdown__trigger');
    }

    private async selectDropdownOption(
        trigger: Locator,
        optionName: string,
        fieldName: string,
        dependentRequest?: RegExp,
    ) {
        await expect(trigger, `${fieldName} dropdown should be visible`).toBeVisible();
        await expect(
            trigger,
            `${fieldName} dropdown should be enabled`,
        ).not.toHaveClass(/ccl-dropdown__trigger--disabled/, { timeout: 10_000 });

        if ((await trigger.innerText()).trim().includes(optionName)) {
            return;
        }

        await trigger.click();
        const option = this.page
            .locator('.ccl-dropdown__option:not(.disabled)')
            .filter({ hasText: optionName });

        await expect(option, `${fieldName} option "${optionName}" should be unique`).toHaveCount(1);
        await expect(option, `${fieldName} option "${optionName}" should be available`).toBeVisible();

        const dependentResponse = dependentRequest
            ? this.page.waitForResponse(
                (response) => response.request().resourceType() === 'xhr' &&
                    response.request().method() === 'GET' &&
                    dependentRequest.test(new URL(response.url()).pathname),
                { timeout: 10_000 },
            )
            : undefined;

        await option.click();

        if (dependentResponse) {
            const response = await dependentResponse;
            expect(
                response.ok(),
                `${fieldName} dependent options request failed: ${response.status()} ${await response.text()}`,
            ).toBeTruthy();
        }

        await expect(trigger).toContainText(optionName);
    }

    // 4. Create Lead
    async addLead(options: {
        name: string;
        phone: string;
        sourceName?: string;
        projectName?: string;
        countryName?: string;
        stateName?: string;
        cityName?: string;
        email?: string;
        remarks?: string;
    }): Promise<{ id: number }> {
        await this.addLeadButton.click();
        await this.nameInput.fill(options.name);
        await this.phoneInput.fill(options.phone);

        if (options.email) {
            await this.emailInput.fill(options.email);
        }

        if (options.remarks && (await this.remarksInput.isVisible())) {
            await this.remarksInput.fill(options.remarks);
        }

        const modal = this.page.locator('app-custom-model');

        // 1. Lead Source (if not already selected)
        const sourceWrapper = modal.locator('ccl-form-field-wrapper').filter({ hasText: /Lead Source/i });
        const sourceTrigger = sourceWrapper.locator('.ccl-dropdown__trigger');
        if (await sourceTrigger.isVisible()) {
            const sourceText = await sourceTrigger.innerText();
            if (sourceText.includes('Select') || !sourceText.trim()) {
                await sourceTrigger.click();
                if (!options.sourceName) {
                    throw new Error('Lead Source has no default selection; pass sourceName explicitly');
                }
                const sourceOption = this.page
                    .locator('.ccl-dropdown__option:not(.disabled)')
                    .filter({ hasText: options.sourceName });
                await expect(sourceOption).toHaveCount(1);
                await sourceOption.click();
            }
        }

        // 2. Project (Lead Source is dropdown 0, Project is dropdown 1)
        if (options.projectName) {
            const projectTrigger = this.dropdownTrigger(modal, 'Select project');
            await this.selectDropdownOption(projectTrigger, options.projectName, 'Project');
        }

        // 3. Select the complete dependent location chain. Changing a parent
        // clears and reloads its child dropdown, so the order is important.
        const countryTrigger = this.dropdownTrigger(modal, 'Select country');
        const stateTrigger = this.dropdownTrigger(modal, 'Select state');
        const cityTrigger = this.dropdownTrigger(modal, 'Select city');

        // The form applies default masters asynchronously after opening. Wait
        // for that initialization so it cannot overwrite our selections.
        await expect(countryTrigger).not.toContainText('Select country', { timeout: 15_000 });

        await this.selectDropdownOption(
            countryTrigger,
            options.countryName ?? EXISTING_COUNTRY,
            'Country',
            /\/states\/?$/,
        );
        await this.selectDropdownOption(
            stateTrigger,
            options.stateName ?? EXISTING_STATE,
            'State',
            /\/cities\/?$/,
        );
        await this.selectDropdownOption(
            cityTrigger,
            options.cityName ?? EXISTING_CITY,
            'City',
        );
        await expect(stateTrigger).toContainText(options.stateName ?? EXISTING_STATE);

        // 4. Area Value (required if a default Area is pre-selected)
        const areaValueInput = modal.getByPlaceholder('Enter Value', { exact: true });
        if ((await areaValueInput.count()) === 1 && await areaValueInput.isVisible()) {
            await areaValueInput.fill('1000');
        }

        const createResponsePromise = this.page.waitForResponse(
            (response) =>
                response.request().resourceType() === 'xhr' &&
                response.request().method() === 'POST' &&
                /^\/api\/v1\/leads\/?$/.test(new URL(response.url()).pathname),
        );
        await this.saveButton.click();
        const createResponse = await createResponsePromise;
        expect(createResponse.ok(), 'Lead create request should succeed').toBeTruthy();
        const body = await createResponse.json();
        const id = Number(body?.data?.id);
        expect(id, 'Created lead should return an id').toBeGreaterThan(0);
        return { id };
    }

    /** Approve a pending lead so auto-assignment (or pending queue) can run. */
    async approveLead(leadId: number): Promise<void> {
        const apiBase = process.env.API_BASE_URL;
        expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();
        const apiOrigin = new URL(apiBase!).origin;

        const response = await this.page.context().request.patch(
            `${apiOrigin}/api/v1/leads/${leadId}/approval-status`,
            { data: { status: 'APPROVED' } },
        );
        expect(
            response.ok(),
            `Lead approval failed: ${response.status()} ${await response.text()}`,
        ).toBeTruthy();
    }

    // 5. View Lead
    async viewLead(name: string) {
        await this.leadRow(name).getByTitle('View', { exact: true }).click();
        const viewDialog = this.page.getByRole('dialog', { name: 'View Lead' });
        await expect(viewDialog).toBeVisible();
        await expect(viewDialog).toContainText(name);
        await viewDialog.getByRole('button', { name: 'Close modal' }).click();
    }

    // 6. Edit Lead
    async editLead(name: string, updatedName: string) {
        await this.leadRow(name).getByTitle('Edit', { exact: true }).click();
        const editDialog = this.page.getByRole('dialog', { name: 'Edit Lead' });
        await expect(editDialog).toBeVisible();
        await expect(this.nameInput).not.toHaveValue('');
        await this.nameInput.fill(updatedName);

        const areaValueInput = editDialog.getByPlaceholder('Enter Value', { exact: true });
        if ((await areaValueInput.count()) === 1 && await areaValueInput.isVisible()) {
            const currentVal = await areaValueInput.inputValue();
            if (!currentVal) {
                await areaValueInput.fill('1000');
            }
        }

        const response = this.page.waitForResponse((candidate) => {
            const url = new URL(candidate.url());
            return candidate.request().resourceType() === 'xhr' &&
                candidate.request().method() === 'PUT' &&
                /^\/api\/v1\/leads\/\d+\/?$/.test(url.pathname);
        });
        await this.saveButton.click();
        await this.successful(response, 'Update Lead');
    }

    // 7. Reassign Lead (only shown when lead already has an agent)
    async reassignLead(name: string, agentLabel: string): Promise<void> {
        const row = this.leadRow(name);
        const reassign = row.getByTitle('Reassign', { exact: true });
        await expect(reassign).toBeVisible();
        await reassign.click();

        const dialog = this.page.getByRole('dialog', { name: /Reassign/i });
        await expect(dialog).toBeVisible();

        const agentTrigger = dialog.getByText('Select new agent', { exact: true });
        await expect(agentTrigger).toBeVisible();
        await agentTrigger.click();

        const agentSearch = this.page
            .getByRole('textbox', { name: 'Search', exact: true })
            .last();
        await expect(agentSearch).toBeVisible();
        await agentSearch.fill(agentLabel);

        // The option includes the agent's surname and role, for example
        // "AgentABC QA (Agent)", while callers provide the unique first name.
        const agentOption = this.page.getByText(agentLabel, { exact: false });
        await expect(agentOption).toHaveCount(1);
        await expect(agentOption).toBeVisible();
        await agentOption.click();

        await dialog
            .getByRole('textbox', { name: 'Enter reassignment reason', exact: true })
            .fill('Automation reassignment verification');

        await dialog.getByRole('button', { name: 'Reassign', exact: true }).click();
        const confirm = this.page.getByRole('dialog', { name: /Confirm/i });
        await expect(confirm).toBeVisible();
        const response = this.page.waitForResponse((candidate) => {
            const url = new URL(candidate.url());
            return candidate.request().resourceType() === 'xhr' &&
                candidate.request().method() === 'POST' &&
                /^\/api\/v1\/leads\/\d+\/reassign\/?$/.test(url.pathname);
        });
        await confirm.getByRole('button', { name: /^Yes$|^Confirm$/i }).click();
        await this.successful(response, 'Reassign Lead');
    }
}
