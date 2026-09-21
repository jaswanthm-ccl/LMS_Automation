import { expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { LeadsPage } from '../pages/main_menu/leads.page';
import { PendingLeadQueuePage } from '../pages/main_menu/pending_lead_queue.page';
import { ProjectMasterPage } from '../pages/master_menu/project_master.page';
import { getRandomLetters, getRandomNumber } from './common';
import { TEST_AGENT } from './test_agent';
import { archiveLead } from '../fixtures/lead-flow.fixture';

type SessionState = { origin: string; values: Record<string, string> };

const adminAuthFile = path.resolve(__dirname, '../playwright/.auth/user.json');
const adminSessionFile = path.resolve(__dirname, '../playwright/.auth/session.json');

export type AssignedLead = {
  lead_id: number;
  name: string;
  ownedByTest: boolean;
  project_id?: number;
};

export async function getFirstAssignedLead(page: Page): Promise<AssignedLead | null> {
  const apiBase = process.env.API_BASE_URL!;
  const res = await page.context().request.get(
    `${apiBase}/api/v1/agent/leads?page=1&limit=5&sort_by=assigned_at&sort_order=desc`,
  );
  if (!res.ok()) return null;
  const body = await res.json();
  const lead = body?.data?.[0];
  if (!lead) return null;
  return {
    lead_id: Number(lead.lead_id),
    name: String(lead.name),
    ownedByTest: false,
  };
}

async function findAgentByLabel(
  page: Page,
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
  const agent = agents.find((a: { label?: string; name?: string; email?: string }) => {
    const blob = `${a.label || ''} ${a.name || ''} ${a.email || ''}`.toLowerCase();
    return (
      blob.includes(labelPart.toLowerCase()) ||
      blob.includes(TEST_AGENT.email.toLowerCase()) ||
      blob.includes(TEST_AGENT.name.toLowerCase())
    );
  });
  expect(agent, `Agent matching "${labelPart}" / ${TEST_AGENT.email} should exist`).toBeTruthy();
  return { id: Number(agent.id), label: String(agent.label || agent.name) };
}

async function openAdminPage(browser: Browser): Promise<{
  page: Page;
  close: () => Promise<void>;
}> {
  const sessionState = JSON.parse(readFileSync(adminSessionFile, 'utf-8')) as SessionState;
  const adminContext = await browser.newContext({
    baseURL: process.env.BASE_URL,
    storageState: adminAuthFile,
  });
  await adminContext.addInitScript(({ origin, values }: SessionState) => {
    if (window.location.origin === origin) {
      for (const [key, value] of Object.entries(values)) {
        window.sessionStorage.setItem(key, value);
      }
    }
  }, sessionState);
  const page = await adminContext.newPage();
  return {
    page,
    close: async () => adminContext.close(),
  };
}

/** Find an existing lead by phone via admin leads API/search. */
async function findLeadByPhone(
  page: Page,
  phone: string,
): Promise<{ id: number; name: string; status: string } | null> {
  const apiBase = process.env.API_BASE_URL!;
  const res = await page.context().request.get(
    `${apiBase}/api/v1/leads?search=${encodeURIComponent(phone)}&page=1&limit=20`,
  );
  if (res.ok()) {
    const body = await res.json();
    const rows = Array.isArray(body?.data) ? body.data : [];
    // Prefer non-duplicate statuses
    const preferred = rows.find(
      (r: { status?: string; primary_phone?: string }) =>
        !/duplicate/i.test(String(r.status || '')) &&
        String(r.primary_phone || '').includes(phone.slice(-4)),
    );
    const row = preferred || rows[0];
    if (row) {
      return {
        id: Number(row.id),
        name: String(row.name),
        status: String(row.status || ''),
      };
    }
  }

  // Leads list hides DUPLICATE_PENDING_REVIEW by default — resolve primary via pending duplicates.
  const dupRes = await page.context().request.get(
    `${apiBase}/api/v1/duplicate-leads?duplicate_status=pending&page=1&limit=200`,
  );
  if (!dupRes.ok()) return null;
  const dupBody = await dupRes.json();
  const dups = Array.isArray(dupBody?.data) ? dupBody.data : [];
  const match = dups.find((r: {
    lead?: { primary_phone?: string };
    duplicate_lead?: { primary_phone?: string; id?: number; name?: string; status?: string };
    duplicate_lead_id?: number;
  }) => {
    const phones = [
      String(r?.lead?.primary_phone || ''),
      String(r?.duplicate_lead?.primary_phone || ''),
    ];
    return phones.some((p) => p.includes(phone) || phone.includes(p.slice(-4)));
  });
  if (!match) return null;

  const primaryId = Number(match.duplicate_lead_id || match.duplicate_lead?.id);
  if (!primaryId) return null;
  const detailRes = await page.context().request.get(`${apiBase}/api/v1/leads/${primaryId}`);
  if (!detailRes.ok()) return null;
  const detail = await detailRes.json();
  const d = detail?.data;
  if (!d) return null;
  return {
    id: Number(d.id),
    name: String(d.name),
    status: String(d.status || ''),
  };
}

async function assignLeadToTestAgent(
  page: Page,
  leadId: number,
  leadName: string,
  projectId?: number,
): Promise<boolean> {
  const apiBase = process.env.API_BASE_URL!;
  const agent = await findAgentByLabel(page, TEST_AGENT.labelMatch);
  const projectMasterPage = new ProjectMasterPage(page);
  const pendingLeadQueuePage = new PendingLeadQueuePage(page);
  const leadsPage = new LeadsPage(page);

  if (projectId) {
    await projectMasterPage.mapAgents(projectId, [agent.id]).catch((e) => {
      console.log('mapAgents note:', String(e));
    });
  }

  let assigned = false;
  const assignResponse = await page.context().request.post(
    `${apiBase}/api/v1/leads/${leadId}/assign`,
    { data: { agent_id: agent.id, override_daily_cap: false } },
  );
  const assignBody = await assignResponse.text();
  assigned =
    assignResponse.ok() ||
    /already assigned/i.test(assignBody) ||
    /already assigned to/i.test(assignBody);
  console.log('assign attempt', assignResponse.status(), assignBody.slice(0, 250));

  // If already assigned to someone else, try reassign to Automate_user.
  if (!assigned && /already assigned/i.test(assignBody) === false) {
    // keep going to UI fallbacks
  } else if (!assignResponse.ok() && /already assigned/i.test(assignBody)) {
    // Confirm whether it's ours via agent leads is agent-side; treat as success for seed reuse.
    assigned = true;
  }
  if (!assigned) {
    await pendingLeadQueuePage.gotoPendingLeadQueuePage();
    await pendingLeadQueuePage.searchPendingLead(leadName);
    const inQueue = await pendingLeadQueuePage
      .queueRow(leadName)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (inQueue) {
      try {
        await pendingLeadQueuePage.assignLead(leadName, agent.label);
        assigned = true;
      } catch (uiError) {
        console.log('UI assign blocked:', String(uiError));
      }
    }
  }

  if (!assigned) {
    await leadsPage.gotoLeadsPage();
    await leadsPage.searchLead(leadName);
    const reassign = page.getByTitle('Reassign', { exact: true }).first();
    if (await reassign.isVisible().catch(() => false)) {
      try {
        await leadsPage.reassignLead(leadName, agent.label);
        assigned = true;
      } catch (e) {
        console.log('reassign failed', String(e));
      }
    }
  }

  return assigned;
}

/**
 * Admin seeds a project+lead and assigns it to Automate_user.
 * If phone already exists (duplicate), reuses/assigns the existing primary lead.
 */
export async function seedLeadForTestAgent(
  browser: Browser,
  options: { phone?: string; leadName?: string } = {},
): Promise<AssignedLead> {
  const apiBase = process.env.API_BASE_URL!;
  expect(apiBase, 'API_BASE_URL must be set').toBeTruthy();

  const { page, close } = await openAdminPage(browser);
  const projectMasterPage = new ProjectMasterPage(page);
  const leadsPage = new LeadsPage(page);

  const unique = getRandomLetters(5);
  const projectName = `Demo Proj ${unique}`;
  const leadName = options.leadName ?? `DemoLead${unique}`;
  const phone = options.phone ?? `9${getRandomNumber(9)}`;
  let createdProjectId: number | undefined;
  let createdLeadId: number | undefined;
  let ownershipHandedOff = false;

  try {
    // If a specific demo phone is requested, prefer an existing eligible lead
    // (including the primary resolved from the duplicate-leads queue).
    if (options.phone) {
      const existing = await findLeadByPhone(page, options.phone);
      console.log('existing lead for phone', options.phone, existing);
      if (existing && !/duplicate/i.test(existing.status)) {
        const leadDetail = await page.context().request.get(
          `${apiBase}/api/v1/leads/${existing.id}`,
        );
        const detail = leadDetail.ok() ? await leadDetail.json() : null;
        const projectId = Number(detail?.data?.project_id) || undefined;
        const assignedAgentId = Number(
          detail?.data?.current_assignment?.assigned_agent?.id,
        );
        const agent = await findAgentByLabel(page, TEST_AGENT.labelMatch);

        // Already on Automate_user — reuse as-is (status may block re-assign).
        if (assignedAgentId && assignedAgentId === agent.id) {
          console.log('lead already assigned to test agent', existing.id);
          return { lead_id: existing.id, name: existing.name, ownedByTest: false };
        }

        const ok = await assignLeadToTestAgent(page, existing.id, existing.name, projectId);
        if (ok) {
          return { lead_id: existing.id, name: existing.name, ownedByTest: false };
        }
        // Cap / eligibility blocks are common on shared envs — surface clearly.
        throw new Error(
          `Found primary lead ${existing.id} (${existing.name}) for phone ${options.phone} ` +
            `but could not assign to ${TEST_AGENT.name} (daily cap or eligibility).`,
        );
      }
    }

    await projectMasterPage.gotoProjectMasterPage();
    const project = await projectMasterPage.addProject(projectName);
    createdProjectId = project.id;
    await expect(page.getByText('Project created successfully')).toBeVisible();

    await leadsPage.gotoLeadsPage();
    const createdLead = await leadsPage.addLead({
      name: leadName,
      phone,
      projectName,
      remarks: 'Demo call automation lead',
    });
    createdLeadId = createdLead.id;

    const leadRes = await page.context().request.get(`${apiBase}/api/v1/leads/${createdLead.id}`);
    const leadJson = leadRes.ok() ? await leadRes.json() : null;
    const status = String(leadJson?.data?.status || '');
    console.log('seed lead status', createdLead.id, status);

    // Duplicate phone → resolve to existing primary by phone search
    if (/duplicate/i.test(status) && options.phone) {
      const existing = await findLeadByPhone(page, options.phone);
      if (existing && !/duplicate/i.test(existing.status)) {
        const detailRes = await page.context().request.get(
          `${apiBase}/api/v1/leads/${existing.id}`,
        );
        const detail = detailRes.ok() ? await detailRes.json() : null;
        const projectId = Number(detail?.data?.project_id) || project.id;
        const ok = await assignLeadToTestAgent(page, existing.id, existing.name, projectId);
        if (ok) {
          return { lead_id: existing.id, name: existing.name, ownedByTest: false };
        }
      }
      throw new Error(
        `Phone ${options.phone} is stuck in duplicate review (lead ${createdLead.id}). Resolve duplicate in LMS or use a unique phone.`,
      );
    }

    if (/pending/i.test(status) || !status) {
      await leadsPage.approveLead(createdLead.id);
    }

    const agent = await findAgentByLabel(page, TEST_AGENT.labelMatch);
    await projectMasterPage.mapAgents(project.id, [agent.id]);
    const assignResponse = await page.context().request.post(
      `${apiBase}/api/v1/leads/${createdLead.id}/assign`,
      { data: { agent_id: agent.id, override_daily_cap: false } },
    );
    expect(
      assignResponse.ok(),
      `Could not assign test lead ${createdLead.id} to ${TEST_AGENT.name}: ` +
        `${assignResponse.status()} ${await assignResponse.text()}`,
    ).toBeTruthy();

    ownershipHandedOff = true;
    return {
      lead_id: createdLead.id,
      name: leadName,
      ownedByTest: true,
      project_id: project.id,
    };
  } finally {
    try {
      if (!ownershipHandedOff) {
        if (createdLeadId) {
          await archiveLead(page.request, createdLeadId);
        }
        if (createdProjectId) {
          const cleanupResponse = await page.context().request.patch(
            `${apiBase}/api/v1/projects/${createdProjectId}/deactivate`,
          );
          expect(
            cleanupResponse.ok(),
            `Project ${createdProjectId} seed-failure cleanup failed: ` +
              `${cleanupResponse.status()} ${await cleanupResponse.text()}`,
          ).toBeTruthy();
        }
      }
    } finally {
      await close();
    }
  }
}

/** Prefer an existing assigned lead; otherwise admin-seed one for Automate_user. */
export async function ensureAssignedLead(
  page: Page,
  browser: Browser,
): Promise<AssignedLead> {
  const existing = await getFirstAssignedLead(page);
  if (existing) return existing;
  console.log(`No leads for ${TEST_AGENT.name} — seeding via admin…`);
  const seeded = await seedLeadForTestAgent(browser);
  await page.goto('/my-leads');
  await page.locator('.page-loader-overlay').waitFor({ state: 'hidden' }).catch(() => {});
  return seeded;
}

/** Remove only lead/project data created by seedLeadForTestAgent. */
export async function cleanupSeededAgentLead(
  browser: Browser,
  lead: AssignedLead,
): Promise<void> {
  if (!lead.ownedByTest) return;

  const apiBase = process.env.API_BASE_URL!;
  const { page, close } = await openAdminPage(browser);
  try {
    await archiveLead(page.request, lead.lead_id);
    if (lead.project_id) {
      const response = await page.context().request.patch(
        `${apiBase}/api/v1/projects/${lead.project_id}/deactivate`,
      );
      expect(
        response.ok(),
        `Project ${lead.project_id} cleanup failed: ${response.status()} ${await response.text()}`,
      ).toBeTruthy();
    }
  } finally {
    await close();
  }
}
