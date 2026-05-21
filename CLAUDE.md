# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard Rules

- **Never read `.env` files.** Do not open, display, or reference the contents of any `.env` file in this project.

## Running the App

Two processes must run simultaneously:

```bash
# Terminal 1 — Express proxy (port 4000)
node server.js

# Terminal 2 — React dev server (port 3000)
npm start
```

Build for production: `npm run build`  
Run tests: `npm test`

The app requires a `.env` file in the root with `JIRA_EMAIL` and `JIRA_TOKEN` for the proxy to authenticate against Jira Cloud. Trino queries use `TRINO_HOST`, `TRINO_PORT`, `TRINO_USERNAME`, `TRINO_PASSWORD`, `TRINO_DECRYPT_KEY` (read from OS env directly — no dotenv in `query_trino.py`).

## Architecture

### Two-Process Design
- **`server.js`** — Express 5 proxy on port 4000. All Jira API calls go through it to keep credentials server-side. Also hosts the `POST /api/claude/run-task` SSE endpoint that spawns a `claude` CLI child process.
- **React app** — CRA on port 3000. Never calls Jira directly; always hits `http://localhost:4000/api/jira/*`.

### Data Flow
1. `useJira` hook (`src/hooks/useJira.js`) owns all remote state — fetches, auto-refresh interval (every 10 min during 08:00–19:00 BKK), and connection status.
2. `JiraAPI` service (`src/services/JiraAPI.js`) wraps the proxy. Its `transformJiraIssues()` method converts raw Jira REST responses into the internal task shape used everywhere. Custom fields: `customfield_10307` = BI Category, `customfield_10306` = Department, `customfield_10016` = Story Points.
3. `App.js` receives `allTasks` from the hook, applies filters/date range to produce `tasks`, and passes both down to views.

### Internal Task Shape
Every component consumes this object:
```
{ id, title, assignee, assigneeEmail, status, startDate, startTimestamp,
  lastUpdated, dueDate, resolutiondate, priority, description (HTML),
  slackLink, figmaLinks, storyPoints, department, biCategory, labels,
  comments, fullChangeHistory, lastUpdateDetail, created }
```
`description` is already HTML (converted from Atlassian Document Format by `adfToHtml` in helpers). `labels` only contains entries ending with `@lmwn.com` — others are filtered during transform.

### View Routing
`App.js` owns a `viewMode` string. Each mode renders a separate component:
- `manager` → `ManagerDashboard`
- `timeline` → `TimelineView`
- `workload` → inline `RechartsLineChart` in App.js
- `flow` → `TaskFlowView`
- `board` → `BoardView`
- `table` → `TableView`
- `team` → `TeamView`

### Theming
CSS custom properties (`--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--muted`, `--accent`, `--accent2`, `--accent3`, `--accent4`) are defined inline in `App.js` under `.theme-dark` and `.theme-light`. Theme choice persists in `localStorage` as `jira_theme`. All components use `var(--*)` exclusively — no hardcoded color values.

### Key Shared Components
- **`TaskDetailDrawer`** — slide-in panel with three tabs: Details (read-only), Actions (Jira write operations), and Run (Claude Code runner with live SSE terminal output).
- **`Badge`** — reusable status/priority/timeliness pill.
- **`MultiSelectDropdown`** — used for all filter dropdowns.

### Claude Code Runner (SSE)
`POST /api/claude/run-task` in `server.js` spawns:
```
claude --dangerously-skip-permissions --output-format stream-json -p "<prompt>"
```
The CWD is the project root so Claude can write `.sql` files and call `python3 query_trino.py <file>.sql`. Events stream back as `data: <JSON>\n\n` SSE lines. The frontend reads these via `fetch` + `ReadableStream` (not `EventSource`, since it's a POST). Event types from the claude CLI in `stream-json` mode: `system`, `assistant` (contains `text` and `tool_use` content blocks), `user` (contains `tool_result` blocks), and `result`.

### `adfToHtml` Extraction Rules
Special-cased in helpers.js during ADF→HTML conversion:
- Links to `lmwn.slack.com` → extracted as `slackLink`, removed from HTML
- Links to `figma.com` → extracted into `figmaLinks[]`, removed from HTML
- Links to `lmwn-redash.linecorp.com/queries/` → rendered as `redash #<id>`

### Config Persistence
Stored in `localStorage`: `jira_project` (project key), `jira_assignees` (comma-separated emails), `jira_theme`. The `ConfigModal` component writes these via `saveJiraConfig` in the `useJira` hook.
