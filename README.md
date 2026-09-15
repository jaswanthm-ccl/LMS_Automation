# LMS Automation

End-to-end test suite for the LMS, a real-estate CRM covering lead capture,
telecalling and reporting. Built with Playwright and TypeScript.

Everything runs through a real browser against a live environment. No API
calls, no database reads. Each check is something a person could confirm by
looking at the screen.

## Coverage

28 tests across 18 spec files.

| Area | Modules | Tests |
| --- | --- | --- |
| Authentication | login, session reuse | 4 |
| Leads | leads, duplicate leads, users | 3 |
| Masters | countries, states, cities, area, project, possession, floor details, furnishing status, property configurations, property purpose, lead sources, disposition categories, roles | 21 |

Twelve modules have a spec file and a page object in place but no tests
written yet: dashboard, the four reports (daily call, call disposition, agent
performance, conversion), the three integrations, recordings, settings, pending
lead queue and follow-ups pending. Empty files are noted in the layout below so
nobody mistakes them for coverage.

## Authentication

Worth reading before changing anything, because it is not obvious.

Logging in before every test made a full run slow, so the suite logs in once.
The `setup` project runs `tests/auth.setup.ts` ahead of the browser projects and
saves the resulting session to disk in two formats:

| File | Holds | Restored by |
| --- | --- | --- |
| `playwright/.auth/user.json` | cookies and localStorage | `storageState` in `playwright.config.ts` |
| `playwright/.auth/session.json` | sessionStorage | the custom `page` fixture |

Both are required. Playwright's `storageState` cannot capture sessionStorage, and
the app keeps its token there. `fixtures/auth.fixture.ts` injects it using
`addInitScript`, which runs before the app's own JavaScript, so the token is in
place by the time the app checks whether you are logged in.

`tests/auth/login.spec.ts` opts out of all of it with an empty `storageState`,
since a login test has to start logged out.

## Layout

| Path | Contents |
| --- | --- |
| `playwright.config.ts` | Projects, browsers, base URL, reporters |
| `tests/auth.setup.ts` | Logs in once, writes the two session files |
| `fixtures/auth.fixture.ts` | Hands every test a logged-in page |
| `tests/` | Specs, mirroring the app's menu structure |
| `pages/` | Page objects, one per module. Specs never touch a selector |
| `utils/common.ts` | Random data generators, shared master names |
| `Issues.txt` | Defect log |
| `whopperads-lms-*` | App source kept locally for reference. Gitignored |

## Running it

```
npm install
npx playwright install chromium
npm test
```

`npm test` runs the chromium project. A `.env` file is required alongside
`package.json` and is not committed:

```
BASE_URL=
EMAIL=
PASSWORD=
INVALID_EMAIL=
INVALID_PASSWORD=
```

Useful variations:

```
npx playwright test --project=chromium --ui     # watch mode
npx playwright test --grep "states"             # single module
npx playwright show-report                      # open the last HTML report
```

Firefox and webkit are configured but not run by default. `npx playwright test`
without `--project` runs all three.

## Test data

Tests build their own data with `getRandomLetters` and `getRandomNumber`, so runs
do not collide with each other. A few tests share master records through constants
in `utils/common.ts` (a test country, Tamil Nadu, Chennai). `ensureCountryExists`
in the countries page object creates or restores those if they are missing, so a
clean environment still works.

Records created during a test are deactivated at the end of it. If a test fails
partway through, that cleanup does not run and the record is left behind.

## Not done yet

- Twelve modules have no tests.
- No CI pipeline. The suite only runs locally.
- Nine hard-coded waits (`waitForTimeout`) remain in the page objects. These are
  flake risks and should be replaced with waits on real UI signals.
- No `afterEach` cleanup, so a failed test leaves data behind.
- No regression test for any item in `Issues.txt`.
