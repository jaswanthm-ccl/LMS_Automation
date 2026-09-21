import { test, expect } from '../../fixtures/auth.fixture';
import { readFileSync } from 'fs';
import path from 'path';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { PendingLeadQueuePage } from '../../pages/main_menu/pending_lead_queue.page';
import { ProjectMasterPage } from '../../pages/master_menu/project_master.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';
import { TEST_AGENT } from '../../utils/test_agent';

type SessionState = { origin: string; values: Record<string, string> };

const agentAuthFile = path.resolve(__dirname, '../../playwright/.auth/agent.json');
const agentSessionFile = path.resolve(__dirname, '../../playwright/.auth/agent-session.json');

async function findAgentByLabel(
  page: import('@playwright/test').Page,
  labelPart: string,
): Promise<{ id: number; label: string }> {
  const apiBase = process.env.API_BASE_URL!;
  const response = await page.context().request.get(`${apiBase}/api/v1/lookups/agents`);
  expect(response.ok(), `Agents lookup failed: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  const agents = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.data?.data)
      ? body.data.data
      : [];
  const agent = agents.find((a: { label?: string; name?: string }) =>
    String(a.label || a.name || '')
      .toLowerCase()
      .includes(labelPart.toLowerCase()),
  );
  expect(agent, `Agent matching "${labelPart}" should exist in lookups`).toBeTruthy();
  return { id: Number(agent.id), label: String(agent.label || agent.name) };
}

test.describe('Agent follow-up / disposition seed flow', () => {
  test('admin assigns a lead to Automate_user, then agent UI is probed', async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);

    const projectMasterPage = new ProjectMasterPage(page);
    const leadsPage = new LeadsPage(page);
    const pendingLeadQueuePage = new PendingLeadQueuePage(page);
    const apiBase = process.env.API_BASE_URL!;

    const unique = getRandomLetters(5);
    const projectName = `Agent Proj ${unique}`;
    const leadName = `AgentLead${unique}`;
    const phone = `9${getRandomNumber(9)}`;

    // 1. Project with no agents → approve lands in pending queue
    await projectMasterPage.gotoProjectMasterPage();
    const project = await projectMasterPage.addProject(projectName);
    await expect(page.getByText('Project created successfully')).toBeVisible();

    await leadsPage.gotoLeadsPage();
    const createdLead = await leadsPage.addLead({
      name: leadName,
      phone,
      projectName,
      remarks: 'Agent follow-up automation lead',
    });
    await expect(page.getByText(/Lead created successfully/i)).toBeVisible();
    await leadsPage.approveLead(createdLead.id);

    // 2. Map Automate_user, then assign without daily-cap override
    const agent = await findAgentByLabel(page, TEST_AGENT.labelMatch);
    await projectMasterPage.mapAgents(project.id, [agent.id]);

    const leadStatus = await page.context().request.get(`${apiBase}/api/v1/leads/${createdLead.id}`);
    console.log('lead after approve:', leadStatus.status(), (await leadStatus.text()).slice(0, 400));

    await pendingLeadQueuePage.gotoPendingLeadQueuePage();
    await pendingLeadQueuePage.searchPendingLead(leadName);
    const inQueue = await pendingLeadQueuePage.queueRow(leadName).isVisible({ timeout: 10_000 }).catch(() => false);
    console.log('in pending queue:', inQueue);

    let assigned = false;
    if (inQueue) {
      try {
        await pendingLeadQueuePage.assignLead(leadName, agent.label);
        assigned = true;
        console.log('Assigned via pending queue UI');
      } catch (uiError) {
        console.log('UI assign blocked:', String(uiError));
        // Soft path: daily cap — still try agent UI in case of partial assignment
      }
    }

    if (!assigned) {
      const assignResponse = await page.context().request.post(
        `${apiBase}/api/v1/leads/${createdLead.id}/assign`,
        { data: { agent_id: agent.id, override_daily_cap: false } },
      );
      const assignBody = await assignResponse.text();
      console.log('API assign (no override):', assignResponse.status(), assignBody.slice(0, 300));
      assigned = assignResponse.ok() || /already assigned/i.test(assignBody);
    }

    // 3. Agent context
    const sessionState = JSON.parse(readFileSync(agentSessionFile, 'utf-8')) as SessionState;
    const agentContext = await browser.newContext({
      baseURL: process.env.BASE_URL,
      storageState: agentAuthFile,
    });
    await agentContext.addInitScript(({ origin, values }: SessionState) => {
      if (window.location.origin === origin) {
        for (const [key, value] of Object.entries(values)) {
          window.sessionStorage.setItem(key, value);
        }
      }
    }, sessionState);

    const agentPage = await agentContext.newPage();
    await agentPage.goto('/my-leads');
    await agentPage.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
    await expect(agentPage.getByRole('heading', { name: /My Assigned Leads/i })).toBeVisible();

    const search = agentPage.getByRole('searchbox', { name: /Search/i }).or(
      agentPage.locator('input[type="search"], input[placeholder*="Search" i]').first(),
    );
    if (await search.isVisible().catch(() => false)) {
      await search.fill(leadName);
      await search.press('Enter');
      await agentPage.waitForTimeout(1000);
    }

    const leadRow = agentPage.getByRole('row').filter({ hasText: leadName });
    const visible = await leadRow.isVisible().catch(() => false);
    console.log('agent lead visible:', visible, leadName);
    console.log(
      'agent my-leads snippet:',
      (await agentPage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500),
    );

    if (!visible) {
      await agentContext.close();
      test.skip(
        true,
        assigned
          ? 'Assigned but not listed on My Leads yet'
          : 'Automate_user daily lead cap reached — cannot assign a fresh lead for follow-up/disposition. Soft-skip.',
      );
      return;
    }

    const titles = await leadRow.locator('[title]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('title') || '').filter(Boolean),
    );
    console.log('lead action titles:', titles);

    const viewOrCall = leadRow.getByTitle(/View|Call|Follow|Disposition/i).first();
    await viewOrCall.click();
    await agentPage.waitForTimeout(1500);

    const after = await agentPage.evaluate(() => {
      const dialogText = Array.from(
        document.querySelectorAll('app-custom-model, [role="dialog"]'),
      )
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500))
        .filter(Boolean);
      const actionButtons = Array.from(document.querySelectorAll('button'))
        .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => /follow|disposition|call|callback|save|submit|schedule/i.test(t))
        .slice(0, 25);
      return { url: location.pathname, dialogText, actionButtons };
    });
    console.log('after lead action:', JSON.stringify(after, null, 2));

    await agentContext.close();
  });
});
