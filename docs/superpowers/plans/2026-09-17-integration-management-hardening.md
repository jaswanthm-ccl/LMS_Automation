# Integration Management Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Integration Config, public lead intake, Sync Logs, Sync Alerts, Distribution Settings, and agent permission coverage deterministic and cleanup-safe.

**Architecture:** Admin page objects synchronize with their exact list APIs. A dedicated integration fixture owns created leads and configurations and tears them down in dependency order. Agent coverage verifies the backend authorization contract directly instead of treating an error-rendered shell as success.

**Tech Stack:** TypeScript, Playwright Test, LMS REST API, dotenv.

**Spec:** Review findings in the active Codex task dated 17 September 2026.

## Global Constraints

- Never mutate shared Distribution Settings.
- Register test-owned resources immediately after successful creation.
- Archive owned leads before deactivating their integration configuration.
- Do not treat static shell rendering as proof that a protected API loaded.
- Use exact API response predicates instead of fixed waits or swallowed errors.

---

### Task 1: Correct agent integration permission coverage

**Files:**
- Modify: `tests/main_menu/agent_integrations.spec.ts`

**Interfaces:**
- Consumes: saved agent authentication state.
- Produces: explicit HTTP 403 assertions for Integration Config, Sync Logs, and Distribution Settings.

- [x] **Step 1: Replace shell assertions with expected access-control assertions**
- [x] **Step 2: Run the agent spec and verify the old expectations fail / the contract is reproduced**
- [x] **Step 3: Keep only direct, named 403 assertions**
- [x] **Step 4: Run the agent spec and verify GREEN**

---

### Task 2: Add owned Integration cleanup

**Files:**
- Create: `fixtures/integration.fixture.ts`
- Modify: `tests/main_menu/integrations.spec.ts`

**Interfaces:**
- Consumes: admin request context and `archiveLead(request, id)`.
- Produces: `integrationCleanup.registerLead(id)` and `integrationCleanup.registerConfig(id)`.

- [x] **Step 1: Make the public-intake test assert post-test lead archival**
- [x] **Step 2: Run and verify RED because no integration cleanup registry exists**
- [x] **Step 3: Implement lead-first, config-second teardown with asserted API results**
- [x] **Step 4: Run and verify GREEN**

---

### Task 3: Make admin navigation and Sync Log matching deterministic

**Files:**
- Modify: `pages/main_menu/integration.page.ts`
- Modify: `pages/main_menu/distribution_settings.page.ts`
- Modify: `tests/main_menu/integrations.spec.ts`

**Interfaces:**
- Consumes: exact Integration Config, Sync Log, and Distribution Settings list responses.
- Produces: navigation that fails on 403/500 and exact `integration_config_id` log matching.

- [x] **Step 1: Add API-success expectations to the existing admin shell tests**
- [x] **Step 2: Verify RED against the swallowed-response implementation**
- [x] **Step 3: Synchronize page objects and filter Sync Logs by exact config ID**
- [x] **Step 4: Run and verify GREEN**

---

### Task 4: Implement Integration Sync Alerts coverage

**Files:**
- Create content: `pages/main_menu/integration_sync_alert.page.ts`
- Create content: `tests/main_menu/integration_sync_alert.spec.ts`

**Interfaces:**
- Consumes: `GET /api/v1/integration-sync-alerts` and `/integration-sync-alert`.
- Produces: admin shell/list API coverage without shared-data mutation.

- [x] **Step 1: Write the failing Alerts page test against the empty page object**
- [x] **Step 2: Run and verify RED**
- [x] **Step 3: Implement exact API-synchronized navigation and shell assertions**
- [x] **Step 4: Run and verify GREEN**

---

### Task 5: Final Integration regression

**Files:**
- Verify all files above.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: a zero-skip, cleanup-safe Integration regression result.

- [x] **Step 1: Run admin Integration and Alerts specs together**
- [x] **Step 2: Run agent authorization spec**
- [x] **Step 3: Run `git diff --check` and inspect test collection**
- [x] **Step 4: Record exact pass counts and any remaining backend limitation**
