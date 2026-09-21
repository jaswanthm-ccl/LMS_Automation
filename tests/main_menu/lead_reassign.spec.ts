import { test, expect } from '../../fixtures/lead-flow.fixture';
import type { Page } from '@playwright/test';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { PendingLeadQueuePage } from '../../pages/main_menu/pending_lead_queue.page';
import { UsersPage } from '../../pages/main_menu/users.page';
import { ProjectMasterPage } from '../../pages/master_menu/project_master.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

async function assignedAgentId(page: Page, leadId: number): Promise<number> {
  const apiOrigin = new URL(process.env.API_BASE_URL!).origin;
  const response = await page.request.get(`${apiOrigin}/api/v1/leads/${leadId}`, {
    maxRetries: 2,
  });
  expect(response.ok(), `Lead ${leadId} detail request should succeed`).toBeTruthy();
  const body = await response.json();
  return Number(body?.data?.current_assignment?.assigned_agent?.id);
}

test.describe('Lead Reassign', () => {
  test('should reassign an owned lead from one fresh agent to another', async ({
    page,
    leadFlowCleanup,
  }) => {
    test.setTimeout(120_000);

    const projects = new ProjectMasterPage(page);
    const leads = new LeadsPage(page);
    const pendingQueue = new PendingLeadQueuePage(page);
    const users = new UsersPage(page);
    const unique = getRandomLetters(5);
    const projectName = `Reassign Proj ${unique}`;
    const leadName = `ReassignLead${unique}`;

    await projects.gotoProjectMasterPage();
    const project = await projects.addProject(projectName);
    leadFlowCleanup.registerProject(project.id);

    await leads.gotoLeadsPage();
    const lead = await leads.addLead({
      name: leadName,
      phone: `9${getRandomNumber(9)}`,
      projectName,
      remarks: 'Owned reassign automation lead',
    });
    leadFlowCleanup.registerLead(lead.id);
    await leads.approveLead(lead.id);

    await users.gotoUsersPage();
    const agentAName = `AgentA${unique}`;
    const agentA = await users.addUser({
      firstName: agentAName,
      lastName: 'QA',
      email: `agent.a.${unique.toLowerCase()}@example.com`,
      phone: `8${getRandomNumber(9)}`,
      gender: 'Male',
      roleName: 'Agent',
    });
    leadFlowCleanup.registerUser(agentA.id);

    await users.gotoUsersPage();
    const agentBName = `AgentB${unique}`;
    const agentB = await users.addUser({
      firstName: agentBName,
      lastName: 'QA',
      email: `agent.b.${unique.toLowerCase()}@example.com`,
      phone: `7${getRandomNumber(9)}`,
      gender: 'Male',
      roleName: 'Agent',
    });
    leadFlowCleanup.registerUser(agentB.id);

    await projects.mapAgents(project.id, [agentA.id, agentB.id]);
    await pendingQueue.assignLeadViaApi(lead.id, agentA.id);
    expect(await assignedAgentId(page, lead.id)).toBe(agentA.id);

    await leads.gotoLeadsPage();
    await leads.searchLead(leadName);
    await expect(leads.leadRow(leadName)).toBeVisible();
    await leads.reassignLead(leadName, agentBName);

    expect(await assignedAgentId(page, lead.id)).toBe(agentB.id);
  });
});
