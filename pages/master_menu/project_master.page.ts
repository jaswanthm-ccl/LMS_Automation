import { expect, type Locator, type Page } from '@playwright/test';
import { EXISTING_CITY, EXISTING_COUNTRY, EXISTING_STATE } from '../../utils/common';

export class ProjectMasterPage {
  readonly page: Page;
  readonly addButton: Locator;
  readonly nameInput: Locator;
  readonly isDefaultCheckbox: Locator;
  readonly saveButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: '+ Add' });
    this.nameInput = page.getByRole('textbox', { name: 'Enter project name' });
    this.isDefaultCheckbox = page.getByRole('checkbox', { name: /Is Default/i });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.searchInput = page.getByRole('searchbox', { name: 'Search' });
  }

  async gotoProjectMasterPage(): Promise<void> {
    await this.page.goto('/project-master');
  }

  projectRow(name: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    });
  }

  private get modal(): Locator {
    return this.page.locator('app-custom-model');
  }

  private async selectDropdownOption(triggerIndex: number, optionText: string): Promise<void> {
    await this.modal.locator('ccl-dropdown .ccl-dropdown__trigger').nth(triggerIndex).click();
    const searchInput = this.page.locator('.ccl-dropdown__search-input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(optionText);
    }
    await this.page
      .locator('.ccl-dropdown__option')
      .filter({ hasText: optionText })
      .first()
      .click();
  }

  async addProject(
    name: string,
    country = EXISTING_COUNTRY,
    state = EXISTING_STATE,
    city = EXISTING_CITY,
    isDefault = false,
  ): Promise<{ id: number }> {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.selectDropdownOption(0, country);
    await this.selectDropdownOption(1, state);
    await this.selectDropdownOption(2, city);
    await this.isDefaultCheckbox.setChecked(isDefault);

    const createResponsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/v1\/projects(?:\?|$)/.test(response.url()),
    );
    await this.saveButton.click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok(), 'Project create request should succeed').toBeTruthy();
    const body = await createResponse.json();
    const id = Number(body?.data?.id);
    expect(id, 'Created project should return an id').toBeGreaterThan(0);
    return { id };
  }

  /** Map assignable agents onto a project (required before manual assign from queue). */
  async mapAgents(projectId: number, agentIds: number[]): Promise<void> {
    const apiBase = process.env.API_BASE_URL ?? '';
    expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();

    const response = await this.page.context().request.post(
      `${apiBase}/api/v1/projects/${projectId}/agents`,
      {
        data: { agent_ids: agentIds },
        // Mapping is transactional, and a retry after a lost response returns
        // the already-mapped result handled below.
        maxRetries: 2,
      },
    );
    const body = await response.text();
    if (response.ok() || /already mapped/i.test(body)) {
      return;
    }
    expect(
      response.ok(),
      `Project agent mapping failed: ${response.status()} ${body}`,
    ).toBeTruthy();
  }

  async getFirstAssignableAgent(): Promise<{ id: number; label: string }> {
    const apiBase = process.env.API_BASE_URL ?? '';
    expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();

    const response = await this.page.context().request.get(
      `${apiBase}/api/v1/lookups/agents`,
    );
    expect(
      response.ok(),
      `Agents lookup failed: ${response.status()} ${await response.text()}`,
    ).toBeTruthy();

    const body = await response.json();
    const agents = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.data?.data)
        ? body.data.data
        : [];
    expect(
      agents.length,
      `At least one assignable agent should exist. Response: ${JSON.stringify(body).slice(0, 300)}`,
    ).toBeGreaterThan(0);

    const agent = agents[0];
    return { id: Number(agent.id), label: String(agent.label) };
  }

  async searchProject(name: string): Promise<void> {
    const searchResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/v1\/projects\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('search') === name.toLowerCase(),
    );
    await this.searchInput.fill(name);
    await this.searchInput.press('Enter');
    expect((await searchResponse).ok(), 'Project search should succeed').toBeTruthy();
  }

  async viewProject(name: string): Promise<void> {
    await this.projectRow(name).getByTitle('View', { exact: true }).click();
  }

  async editProject(name: string, updatedName: string): Promise<void> {
    await this.projectRow(name).getByTitle('Edit', { exact: true }).click();
    await expect(this.nameInput).toHaveValue(name);
    await this.nameInput.fill(updatedName);
    await this.saveButton.click();
  }

  async deactivateProject(name: string): Promise<void> {
    await this.projectRow(name).getByTitle('Deactivate', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
  }

  async restoreProject(name: string): Promise<void> {
    await this.projectRow(name).getByTitle('Restore', { exact: true }).click();
    await this.page.getByRole('button', { name: 'Yes', exact: true }).click();
  }

  async filterByStatus(status: 'Active' | 'Inactive'): Promise<void> {
    const filtersButton = this.page.getByRole('button', { name: /Filters/ });
    const statusWrapper = this.page.locator('ccl-form-field-wrapper').filter({ hasText: 'Status' });
    if (!(await statusWrapper.isVisible())) {
      await filtersButton.click();
      await statusWrapper.waitFor({ state: 'visible' });
    }
    await statusWrapper.locator('.ccl-dropdown__trigger').click();
    await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`) }).click();
    await this.page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
  }
}
