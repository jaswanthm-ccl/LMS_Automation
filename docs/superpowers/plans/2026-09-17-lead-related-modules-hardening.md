# Lead-Related Modules Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lead Upload, Lead Reassign, My Leads, Callback Queue, and agent follow-up coverage deterministic, self-cleaning, and suitable for the default regression suite.

**Architecture:** Reuse the existing API-aware page objects and `lead-flow.fixture.ts` cleanup registry. Admin-owned setup creates unique projects, agents, and leads; agent tests consume explicitly seeded assignments. Vendor-dependent Doocti demonstrations and diagnostic probes remain available but are excluded from default regression execution.

**Tech Stack:** TypeScript, Playwright Test, LMS REST API, dotenv.

**Spec:** `docs/superpowers/plans/2026-09-16-lead-flow-hardening.md` and the 17 September 2026 lead-module audit.

## Global Constraints

- Preserve existing user and Cursor changes outside the listed files.
- Use exact API method/path waits instead of fixed delays.
- Register every created lead, project, and user immediately after creation.
- Never archive or deactivate pre-existing shared data.
- Keep the shared dev environment at one Playwright worker.
- Do not let unavailable vendor telephony silently pass the default regression suite.

---

### Task 1: Isolate probes and vendor demonstrations

**Files:**
- Modify: `playwright.config.ts`
- Test: Playwright test discovery output

**Interfaces:**
- Consumes: Existing `chromium` and `chromium-agent` project patterns.
- Produces: Default project discovery without `_probe_*`, `agent_probe_*`, or `agent_doocti_call_demo.spec.ts`.

- [x] **Step 1: Capture the failing discovery behavior**

Run:

```powershell
npx playwright test --list --project=chromium
npx playwright test --list --project=chromium-agent
```

Expected before the fix: output includes `_probe_*.spec.ts`, `agent_probe_*.spec.ts`, or `agent_doocti_call_demo.spec.ts`.

- [x] **Step 2: Add explicit diagnostic exclusions**

Define and apply these patterns in `playwright.config.ts`:

```ts
const diagnosticSpecs = /(?:^|[\\/])(?:_probe_|agent_probe_|agent_doocti_call_demo).*\.spec\.ts$/;
```

Keep the existing admin/agent routing and add `diagnosticSpecs` to each executable browser project's `testIgnore` collection.

- [x] **Step 3: Verify discovery behavior**

Run the two list commands again.

Expected: diagnostic and vendor-demo specs are absent; ordinary admin and agent specs remain listed.

---

### Task 2: Make Lead Upload self-cleaning

**Files:**
- Modify: `tests/main_menu/lead_upload.spec.ts`
- Modify: `pages/main_menu/lead_upload.page.ts`
- Reuse: `fixtures/lead-flow.fixture.ts`

**Interfaces:**
- Consumes: `leadFlowCleanup.registerLead(id)` and `GET /api/v1/leads?search=...`.
- Produces: `processBatch(batchId): Promise<{ leadIds: number[] }>`.

- [x] **Step 1: Write the failing cleanup verification**

Make the upload describe serial, store the exact uploaded lead ID, and add:

```ts
test('should archive the lead created by the upload during cleanup', async ({ page }) => {
  const response = await page.request.get(`${new URL(process.env.API_BASE_URL!).origin}/api/v1/leads/${uploadedLeadId}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data.status).toBe('ARCHIVED');
});
```

- [x] **Step 2: Run the spec and verify RED**

Run:

```powershell
npx playwright test tests/main_menu/lead_upload.spec.ts --project=chromium
```

Expected: cleanup verification fails because the uploaded lead remains active.

- [x] **Step 3: Return and register created lead IDs**

After processing, query the lead list by the unique uploaded name, require exactly one exact-name match, return its numeric ID, and call:

```ts
leadFlowCleanup.registerLead(uploadedLeadId);
```

Also replace the import dialog fallback chain with its accessible dialog and require an explicit upload submit button when `uploadFile()` is used.

- [x] **Step 4: Run the spec and verify GREEN**

Expected: upload/history test and cleanup verification both pass.

---

### Task 3: Replace conditional Lead Reassign coverage with an owned lifecycle

**Files:**
- Replace: `tests/main_menu/lead_reassign.spec.ts`
- Reuse: `fixtures/lead-flow.fixture.ts`
- Reuse: `pages/main_menu/leads.page.ts`
- Reuse: `pages/main_menu/pending_lead_queue.page.ts`
- Reuse: `pages/main_menu/users.page.ts`
- Reuse: `pages/master_menu/project_master.page.ts`

**Interfaces:**
- Consumes: project/user/lead creation, project-agent mapping, initial assignment API, and `LeadsPage.reassignLead(name, agentLabel)`.
- Produces: deterministic assertion that `current_assignment.assigned_agent.id` changes from agent A to agent B.

- [x] **Step 1: Write the owned reassign test**

Create a unique project with no mapped agents, create and approve a lead into the pending queue, create two fresh Agent users, map both, assign agent A, reassign through the UI to agent B, and assert the lead-detail API reports agent B.

Register resources immediately:

```ts
leadFlowCleanup.registerProject(project.id);
leadFlowCleanup.registerLead(lead.id);
leadFlowCleanup.registerUser(agentA.id);
leadFlowCleanup.registerUser(agentB.id);
```

- [x] **Step 2: Run and verify RED**

Expected before page-object correction: the previous implementation either skips, selects an arbitrary row/option, or fails to prove the assignment changed.

- [x] **Step 3: Make the minimal page-object correction**

Use the exact lead row, exact Reassign dialog, unique agent option, exact confirmation, and the `POST /api/v1/leads/:id/reassign` response already exposed by `LeadsPage.reassignLead`.

- [x] **Step 4: Run and verify GREEN**

Expected: one deterministic reassign lifecycle passes with no skip and teardown removes all owned data.

---

### Task 4: Harden My Leads and Callback Queue synchronization

**Files:**
- Modify: `pages/main_menu/my_leads.page.ts`
- Modify: `pages/main_menu/callback_queue.page.ts`
- Modify: `tests/main_menu/my_leads.spec.ts`

**Interfaces:**
- Consumes: agent storage state and `GET /api/v1/agent/leads` / follow-up queue APIs.
- Produces: API-synchronized navigation, search, row, and queue-filter behavior without fixed waits or swallowed errors.

- [x] **Step 1: Add failing behavior assertions**

Assert that My Leads search returns the exact API-provided assigned lead and that Callback Queue filtering preserves the requested queue type. The test must fail if navigation returns 403 or the list request is unsuccessful.

- [x] **Step 2: Verify RED**

Run:

```powershell
npx playwright test tests/main_menu/my_leads.spec.ts --project=chromium-agent
```

Expected: the existing smoke-only implementation does not prove search/filter results and may time out through swallowed loader waits.

- [x] **Step 3: Replace timing fallbacks**

Persistently hide the CTI overlay with injected CSS:

```ts
await page.addStyleTag({
  content: '#doocti-cti-iframe, app-doocti-container { display:none !important; pointer-events:none !important; visibility:hidden !important; }',
});
```

Synchronize navigation, search, and filters with exact successful API responses, and use exact row cell matching.

- [x] **Step 4: Verify GREEN**

Expected: My Leads and Callback Queue tests pass without fixed waits, broad fallbacks, or conditional success.

---

### Task 5: Separate safe callback coverage from mutation and vendor telephony

**Files:**
- Modify: `tests/main_menu/agent_followup_disposition.spec.ts`
- Modify: `utils/seed_agent_lead.ts`
- Reuse: `fixtures/lead-flow.fixture.ts` patterns

**Interfaces:**
- Consumes: agent lead and callback-queue list APIs.
- Produces: read-only default callback regression; mutation/telephony dependencies are reported outside default regression.

- [x] **Step 1: Audit the follow-up lifecycle and cleanup contract**

The source review and live RED run proved that follow-up creation changes the lead to
`FOLLOW_UP_SCHEDULED`, while the admin status API validates only Milestone 2 source
statuses. It therefore cannot archive the resulting lead through a supported API.

- [x] **Step 2: Verify RED**

The owned lifecycle completed its functional assertions, then cleanup failed with HTTP 422
`Invalid lead status`, confirming the backend contract gap.

- [x] **Step 3: Keep default regression read-only and deterministic**

Default regression verifies My Leads plus Today, Overdue, and Upcoming queue filters against
successful API responses. It does not create persistent follow-ups until the backend exposes a
supported completion/deletion/archive path.

- [x] **Step 4: Remove telephony skip from default regression**

Keep vendor call/disposition behavior in the excluded Doocti demonstration spec. The default `agent_followup_disposition.spec.ts` must not silently skip because of calling hours, CTI login state, or vendor queue state.

- [x] **Step 5: Verify the lead-related suites**

Run:

```powershell
npx playwright test tests/main_menu/leads.spec.ts tests/main_menu/duplicate_leads.spec.ts tests/main_menu/pending_lead_queue.spec.ts tests/main_menu/lead_upload.spec.ts tests/main_menu/lead_reassign.spec.ts --project=chromium
npx playwright test tests/main_menu/my_leads.spec.ts tests/main_menu/agent_followup_disposition.spec.ts --project=chromium-agent
```

Expected: all default lead-related tests pass with zero skips; diagnostic/vendor demos are not discovered by default projects.
