import { test, expect } from '../../fixtures/lead-flow.fixture';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { PendingLeadQueuePage } from '../../pages/main_menu/pending_lead_queue.page';
import { ProjectMasterPage } from '../../pages/master_menu/project_master.page';
import { UsersPage } from '../../pages/main_menu/users.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

test.describe('Pending Lead Queue Module', () => {
  test('should open the pending lead queue list', async ({ page }) => {
    const pendingLeadQueuePage = new PendingLeadQueuePage(page);

    await pendingLeadQueuePage.gotoPendingLeadQueuePage();

    await expect(page.getByRole('heading', { name: /Pending Lead Queue/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Filters/i })).toBeVisible();
  });

  test('should show an approved lead in the queue when its project has no mapped agents', async ({
    page,
    leadFlowCleanup,
  }) => {
    test.setTimeout(120_000);

    const projectMasterPage = new ProjectMasterPage(page);
    const leadsPage = new LeadsPage(page);
    const pendingLeadQueuePage = new PendingLeadQueuePage(page);

    const unique = getRandomLetters(5);
    const projectName = `Pend Proj ${unique}`;
    const leadName = `PendLead${unique}`;
    const phone = `9${getRandomNumber(9)}`;

    // 1. Create a project with no agents mapped
    await projectMasterPage.gotoProjectMasterPage();
    const project = await projectMasterPage.addProject(projectName);
    leadFlowCleanup.registerProject(project.id);
    await expect(page.getByText('Project created successfully')).toBeVisible();

    // 2. Create a lead under that project (starts as Pending)
    await leadsPage.gotoLeadsPage();
    const createdLead = await leadsPage.addLead({
      name: leadName,
      phone,
      projectName,
      remarks: 'Pending queue automation lead',
    });
    leadFlowCleanup.registerLead(createdLead.id);
    await expect(page.getByText(/Lead created successfully/i)).toBeVisible();

    // 3. Approve so auto-assignment runs and fails into the pending queue
    await leadsPage.approveLead(createdLead.id);

    // 4. Verify the lead is listed with the expected pending reason
    await pendingLeadQueuePage.gotoPendingLeadQueuePage();
    await pendingLeadQueuePage.searchPendingLead(leadName);

    const row = pendingLeadQueuePage.queueRow(leadName);
    await expect(row).toBeVisible();
    await expect(row).toContainText(projectName);
    await expect(row).toContainText('No agents mapped to project');

    // 5. Assign dialog should explain why assignment cannot proceed yet
    const assignDialog = await pendingLeadQueuePage.openAssign(leadName);
    await expect(assignDialog).toContainText(leadName);
    await expect(assignDialog).toContainText(/No agents are mapped to this project/i);
    await assignDialog.getByRole('button', { name: 'Close modal' }).click();

    // Resolve the queue item with a fresh agent so teardown can archive the lead.
    const usersPage = new UsersPage(page);
    const agentFirstName = `Agent${unique}`;
    await usersPage.gotoUsersPage();
    const agent = await usersPage.addUser({
      firstName: agentFirstName,
      lastName: 'QA',
      email: `agent.${unique.toLowerCase()}@example.com`,
      phone: `8${getRandomNumber(9)}`,
      gender: 'Male',
      roleName: 'Agent',
    });
    leadFlowCleanup.registerUser(agent.id);
    await projectMasterPage.mapAgents(project.id, [agent.id]);
    await pendingLeadQueuePage.assignLeadViaApi(createdLead.id, agent.id);
  });

  test('should manually assign a queued lead after mapping an agent to its project', async ({
    page,
    leadFlowCleanup,
  }) => {
    test.setTimeout(120_000);

    const projectMasterPage = new ProjectMasterPage(page);
    const leadsPage = new LeadsPage(page);
    const pendingLeadQueuePage = new PendingLeadQueuePage(page);

    const unique = getRandomLetters(5);
    const projectName = `Assign Proj ${unique}`;
    const leadName = `AssignLead${unique}`;
    const phone = `9${getRandomNumber(9)}`;

    // 1. Create project + lead, approve into pending queue (no agents yet)
    await projectMasterPage.gotoProjectMasterPage();
    const project = await projectMasterPage.addProject(projectName);
    leadFlowCleanup.registerProject(project.id);
    await expect(page.getByText('Project created successfully')).toBeVisible();

    await leadsPage.gotoLeadsPage();
    const createdLead = await leadsPage.addLead({
      name: leadName,
      phone,
      projectName,
      remarks: 'Pending queue assign automation lead',
    });
    leadFlowCleanup.registerLead(createdLead.id);
    await expect(page.getByText(/Lead created successfully/i)).toBeVisible();
    await leadsPage.approveLead(createdLead.id);

    await pendingLeadQueuePage.gotoPendingLeadQueuePage();
    await pendingLeadQueuePage.searchPendingLead(leadName);
    await expect(pendingLeadQueuePage.queueRow(leadName)).toBeVisible();

    // 2. Create a fresh agent so shared-environment daily caps cannot make this test ambiguous.
    const usersPage = new UsersPage(page);
    const agentFirstName = `Agent${unique}`;
    await usersPage.gotoUsersPage();
    const agent = await usersPage.addUser({
      firstName: agentFirstName,
      lastName: 'QA',
      email: `agent.${unique.toLowerCase()}@example.com`,
      phone: `8${getRandomNumber(9)}`,
      gender: 'Male',
      roleName: 'Agent',
    });
    leadFlowCleanup.registerUser(agent.id);
    await projectMasterPage.mapAgents(project.id, [agent.id]);

    await pendingLeadQueuePage.gotoPendingLeadQueuePage();
    await pendingLeadQueuePage.searchPendingLead(leadName);
    await expect(pendingLeadQueuePage.queueRow(leadName)).toBeVisible();

    const assignDialog = await pendingLeadQueuePage.openAssign(leadName);
    const agentTrigger = assignDialog.locator('.ccl-dropdown__trigger');
    await expect(agentTrigger).toBeVisible({ timeout: 10_000 });
    await assignDialog.getByRole('button', { name: 'Close modal' }).click();
    await pendingLeadQueuePage.assignLead(leadName, agentFirstName);
    await expect(
      page.getByText(/assigned successfully|Lead assigned|Assignment (completed|successful)/i),
    ).toBeVisible();

    // 3. Lead should leave the pending queue
    await pendingLeadQueuePage.gotoPendingLeadQueuePage();
    await pendingLeadQueuePage.searchPendingLead(leadName);
    await expect(pendingLeadQueuePage.queueRow(leadName)).toBeHidden();
  });
});
