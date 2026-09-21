# Lead Flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Leads, Duplicate Leads, and Pending Lead Queue deterministic, understandable, source-aligned, and self-cleaning.

**Architecture:** Keep browser interactions in the three page objects and put API-only teardown in a dedicated authenticated fixture. Use exact XHR method/path/query waits, row- and dialog-scoped locators, and assertions on persisted API/UI outcomes. Preserve all current uncommitted Cursor changes outside the named files.

**Tech Stack:** TypeScript, Playwright Test, LMS REST API, authenticated browser/API request context.

**Spec:** `whopperads-lms-node-development/docs/M2-US-014-duplicate-lead-resolution.md`

## Global Constraints

- Primary/target lead values are never overwritten by merge.
- Merge copies missing-only supported fields and archives only the source lead.
- Ignore preserves both leads.
- No `waitForTimeout`, broad action fallbacks, swallowed errors, or unscoped `.first()` actions in the changed lead-flow files.
- Every created lead and project is registered immediately for teardown.
- Existing unrelated working-tree changes must remain untouched.

---

### Task 1: Lead-flow teardown fixture

**Files:**
- Create: `fixtures/lead-flow.fixture.ts`
- Create: `tests/regression/lead-flow-cleanup.spec.ts`
- Modify: `pages/main_menu/leads.page.ts`

**Interfaces:**
- Produces `CreatedLead { id, detailsUrl, statusUrl }` from `LeadsPage.addLead()`.
- Produces `leadFlowCleanup.registerLead()` and `leadFlowCleanup.registerProject()`.
- Lead cleanup reads the current lead and sends `PATCH /api/v1/leads/:id/status` with `{ status: "ARCHIVED", remarks: "Automation cleanup" }` only when required.
- Project cleanup sends `PATCH /api/v1/projects/:id/deactivate` and accepts an explicitly already-inactive project.

- [ ] Add a regression test proving malformed lead state responses fail cleanup loudly.
- [ ] Run the regression test and confirm RED against the missing fixture contract.
- [ ] Return exact resource URLs from the lead create response.
- [ ] Implement fixture teardown in reverse creation order.
- [ ] Run the regression test and confirm GREEN.

### Task 2: Deterministic Leads page object and lifecycle test

**Files:**
- Modify: `pages/main_menu/leads.page.ts`
- Modify: `tests/main_menu/leads.spec.ts`

**Interfaces:**
- `waitForLeadApi(method, pathname, query?)` matches XHR, exact method, exact pathname, and required query values.
- `searchLead(name)` waits for `GET /api/v1/leads` with the normalized search value.
- `editLead(name, updatedName)` waits for the exact lead detail and update endpoints.
- `leadRow(name)` uses an exact cell inside one table row.

- [ ] Update the lifecycle test to request `leadFlowCleanup` and register immediately after create.
- [ ] Run the focused lifecycle test to identify the first unsupported old behavior.
- [ ] Replace fixed waits, broad source selection, swallowed visibility errors, and unscoped actions with exact signals.
- [ ] Assert create, search, view, edit, and persisted updated name.
- [ ] Run the focused lifecycle test to GREEN.

### Task 3: Source-aligned Ignore scenario

**Files:**
- Modify: `pages/main_menu/duplicate_leads.page.ts`
- Modify: `tests/main_menu/duplicate_leads.spec.ts`

**Interfaces:**
- `resolveDuplicate(name, action, reason)` waits for and returns the real `PATCH /api/v1/duplicate-leads/:id/action` response summary.
- `filterByStatus(status)` waits for `GET /api/v1/duplicate-leads?duplicate_status=<status>`.

- [ ] Write the Ignore test assertions first: action/status `ignored`, `source_archived: false`, Pending row removed, Ignored row visible, both source and target API records remain unarchived.
- [ ] Run and confirm RED because the current page method returns no resolution result and uses fixed waits.
- [ ] Implement exact row/dialog actions and API response parsing.
- [ ] Run and confirm the Ignore scenario GREEN.

### Task 4: Primary-safe Merge scenario

**Files:**
- Modify: `tests/main_menu/duplicate_leads.spec.ts`

**Interfaces:**
- Primary is created without email but with a populated name, phone, and remarks.
- Source duplicate has a unique email and different populated name/remarks.
- Merge response supplies `source_lead_id`, `target_lead_id`, `copied_fields`, and `source_archived`.

- [ ] Write a Merge test that expects the primary name, phone, remarks, and status to remain unchanged; expects missing primary email to be copied; expects source archived; expects the row under Merged and absent under Pending.
- [ ] Run and confirm RED before merge assertions are supported.
- [ ] Add only the minimal helper/API reads necessary for those assertions.
- [ ] Run and confirm Merge GREEN.

### Task 5: Deterministic Pending Lead Queue

**Files:**
- Modify: `pages/main_menu/pending_lead_queue.page.ts`
- Modify: `tests/main_menu/pending_lead_queue.spec.ts`
- Modify only where necessary: `pages/master_menu/project_master.page.ts`

**Interfaces:**
- Navigation/search/filter methods wait on exact pending-queue requests.
- Project and lead records register with `leadFlowCleanup` immediately.
- Assignment tests never return early and pass without assignment.

- [ ] Register every project and lead created by the queue scenarios.
- [ ] Write an assertion that the assignment scenario must end with the lead absent from the queue.
- [ ] Run and confirm RED or expose the daily-cap nondeterminism.
- [ ] Replace `.first()`, swallowed catches, loader waits, and conditional early success with exact outcomes.
- [ ] Use an eligible agent when available; if the shared environment enforces a cap, perform the documented API override assignment and still verify the lead leaves the queue.
- [ ] Run all Pending Queue scenarios to GREEN.

### Task 6: Final verification

**Files:**
- Review all files changed in Tasks 1–5.

- [ ] Run `npx tsc --noEmit` using the locally installed compiler if available.
- [ ] Run the Leads, Duplicate Leads, Pending Lead Queue, and cleanup regression specs together on Chromium.
- [ ] Run `git diff --check`.
- [ ] Confirm the changed lead-flow files contain no `waitForTimeout`, swallowed `.catch(() => {})`, or unscoped action `.first()` usage.
- [ ] Report exact pass/fail counts and any environment-only blocker without claiming the full project suite passed.
