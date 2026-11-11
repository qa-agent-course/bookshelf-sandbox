# Bookshelf: team conventions

## Tickets

One Markdown file per ticket in `tickets/`, named `BS-1NN-short-title.md`:

```
# BS-1NN <Title>
- Type: Story | Bug | Task
- Status: Ready for test
- Priority: High | Medium | Low
- Reporter: Product Owner (fictional)
## Description
<user story>
## Acceptance criteria
1. ...
## Notes
...
```

The same tickets are in `tickets/jira-import.csv` for an optional import into a Jira test site.

## Test cases

- ID format: `BS-TC-###` (three digits, numbered across the project: BS-TC-001, BS-TC-002, ...).
- Every test case links to one ticket and, where possible, one acceptance criterion (for example `BS-103 AC2`).
- Columns, in this order:

| ID | Title | Ticket | Preconditions | Steps | Expected result | Priority | Technique |
|---|---|---|---|---|---|---|---|
| BS-TC-001 | Search ignores upper and lower case | BS-101 AC2 | Server running, catalogue open | 1. Type "DRACULA" in "Search books" | Only "Dracula" is listed | High | Equivalence partitioning |

- Expected result: something you can see or measure (a text, a value, a status code). Never "works correctly".
- Technique: the test design technique the case comes from (equivalence partitioning, boundary value analysis, decision table, state transition, error guessing, exploratory).
- Priority: High, Medium or Low.

## Bug reports

Title: `[Area] What is wrong, where` (for example `[Cart] Delivery fee charged at 30.00 EUR`).

Sections: Environment, Steps to reproduce (numbered, minimal), Expected result (from the ticket, with the AC number), Actual result, Evidence (screenshots, log lines with `req=` IDs, console lines, request and response), Severity (Critical, Major, Minor, Trivial) with a reason, Ticket, Hypothesis (optional, clearly marked).

No real personal data, no tokens and no passwords in bug reports. Replace emails and `Bearer` values with `[redacted]`.

## Environments

| Name | URL | Notes |
|---|---|---|
| Local | http://localhost:3000 | `npm start`. Data resets on every restart. |
| Local, fixed build | http://localhost:3000 | `SANDBOX_FIXED=1 npm start`. Used to confirm that a reported problem is fixed. |
| CI | GitHub Actions | `.github/workflows/playwright.yml` runs the Playwright tests on every push. |

## Automated tests

- UI and API tests use Playwright Test (`tests/e2e/`, `tests/api/`).
- Locators: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. No long CSS or XPath chains.
- Assertions: web-first `await expect(locator)...` assertions. No fixed waits (`waitForTimeout`), no added retries.
- A new test counts as done after 5 green local runs (`--repeat-each=5`) and 1 green CI run.
- Secrets come from the environment (`process.env.DEMO_PASSWORD`), never from the test file.

## Definition of Done (for a story)

1. Every acceptance criterion has at least one passed test case.
2. No open bug of severity Critical or Major for the story.
3. Automated tests for the critical flow pass 5 local runs and 1 CI run.
4. The ticket is updated with the test result and links to the test cases.

## Release rhythm

One small release per week (fictional). Smoke checklist on the cart and checkout before every release.
