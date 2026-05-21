# Do Jira Task

Execute a Jira task end-to-end: understand requirements, fetch context, do the work, and record what you learned.

**This skill runs in two ways:**
- CLI: `/do-task BUSINT-1234` — fetches the task from Jira then follows this workflow
- UI: clicking "Run Analysis" on any task in the dashboard — task data is already injected below the `## Current Task` heading; skip Step 1 and start from Step 2

## Input

`$ARGUMENTS` — a Jira issue key (e.g. `BUSINT-1234`) or a full task description pasted inline.

---

## Step 1 — Fetch the task

If a Jira issue key was given, read it from the proxy:

```bash
curl -s "http://localhost:4000/api/jira/issue/$ARGUMENTS?fields=summary,description,status,assignee,priority,labels,customfield_10307,customfield_10306,customfield_10016,duedate,comment" | jq .
```

Parse out:
- `fields.summary` → title
- `fields.description` → ADF body (convert to plain text by recursively extracting all `text` leaf nodes)
- `fields.comment.comments` → existing comments (read for context, never post without user approval)
- Custom fields: `customfield_10307` = BI Category, `customfield_10306` = Department, `customfield_10016` = Story Points

---

## Step 2 — Understand requirements (read carefully before acting)

Re-read the full description. Answer these before moving on:

1. **What is the deliverable?** (SQL query, written analysis, report spec, process, investigation)
2. **What data sources are mentioned?** (Trino tables, Redash links, product names, date ranges)
3. **What is the acceptance criteria?** (numbers expected, format, stakeholder)
4. **Are there related links?** Extract Slack thread links and Figma links from the description for context.

Do NOT start writing code or SQL until you have clear answers to all four questions.

---

## Step 3 — Fetch Confluence context (read-only)

If the task mentions a spec, documentation page, team space, or references a Confluence link:

```bash
# Search Confluence for related pages
curl -s "http://localhost:4000/api/jira/..." 
# Use the Atlassian MCP tool if available: mcp__claude_ai_Atlassian__searchConfluenceUsingCql
# CQL example: title ~ "keyword" AND space.key = "LMWN"
```

Rules for Confluence:
- **Read only.** Fetch pages for context and requirements.
- **Never create, edit, or update** a Confluence page without explicit user approval in this conversation.
- Extract relevant data, specs, or schemas from the page content.

---

## Step 4 — Decide the execution path

Based on the requirements:

| Task type | Path |
|---|---|
| Data extraction / KPI / cohort / metric / ad-hoc query | Write SQL → run via Trino |
| Written analysis / investigation / spec review | Write a structured analysis document |
| Report specification | Document the spec, identify data sources, note gaps |
| Process / planning | Outline the steps, identify blockers |

**Never connect to Google Drive.** If a result needs to be shared via Google Sheets or Docs, output a CSV file locally and tell the user to upload it themselves.

---

## Step 5 — Execute

### Path A — Trino SQL

Always start with a **syntax-validation test run** using 1 day of data and `LIMIT 100`. What happens after that depends on the deliverable:

#### Step A1 — Test run (always required)

Add a 1-day window and `LIMIT 100` to the query. Write it to `issue_key_test.sql`:

```sql
-- restrict to yesterday to keep the scan small
WHERE DATE(event_time) = CURRENT_DATE - INTERVAL '1' DAY
LIMIT 100
```

```bash
python3 query_trino.py issue_key_test.sql
```

Inspect the output: verify column names, data types, and that rows look sensible. Fix any syntax or logic errors before continuing. Do NOT proceed with a failing test.

#### Step A2 — Decide what comes next

| Deliverable | After the test passes… |
|---|---|
| **Query only** (task asks for a working SQL file) | Write the final production query (no date restriction, no LIMIT) to `ISSUE_KEY.sql`. Do **not** run it — the user will run it themselves with their own date range. |
| **Analysis / findings** (task asks for numbers, insights, KPIs) | Remove the restriction and LIMIT, run the full query, then analyse the results. |

#### Step A3 — Full run (analysis deliverables only)

```bash
python3 query_trino.py ISSUE_KEY.sql
```

Examine the CSV output row by row. Draw your findings from this data, then write the summary.

Other rules:
- Use `{{token}}` in the query wherever a decrypt key is needed (the script substitutes it automatically).
- Multiple queries: name them `issue_key_1.sql`, `issue_key_2.sql`, etc. Each gets its own test run before proceeding.
- If a query returns 0 rows or an unexpected shape after the full run, investigate before writing conclusions.

### Path B — Written analysis

Write the analysis directly. Structure it as:
1. **Summary** — one paragraph answer to the task
2. **Findings** — bullet points with evidence
3. **Gaps / assumptions** — what you couldn't verify
4. **Recommended next steps**

---

## Step 6 — Verify and summarize

Before reporting done:
- If SQL: confirm row counts look reasonable, spot-check 3-5 rows for correctness.
- If analysis: re-read the original requirement and confirm every point is addressed.
- State explicitly what was **not** done and why (e.g., "skipped X because the description didn't request it").

**Present the result in clean Markdown.** The UI renders the final result text as formatted markdown — use headings (`##`), bullet lists (`-`), bold (`**text**`), and code blocks (` ``` `) appropriately. The result should be readable without needing to see the raw text.

After the result is shown in the UI, the user can:
- **Post to Jira** — adds the result as a comment on the ticket (with an optional extra note they type in). The ADF conversion happens automatically.
- **Deny** — dismisses the result without posting.

Write your final summary with this review step in mind: structure it so it reads well as a Jira comment (concise, clear sections, actionable findings first).

---

## Step 7 — Record learnings (background)

**The full requirements and result are saved automatically** to `.claude/task-history/TASKID-timestamp.md` and indexed in `.claude/agent-history.jsonl` every time an agent completes. You do not need to write those yourself.

What you **do** need to update is the reusable knowledge — things that would help a future run of this skill go faster or avoid known pitfalls. After the result is confirmed, update the **## Learned Patterns** section below with:

- Trino table names, catalog/schema patterns, or column naming conventions discovered.
- Confluence space keys or page structures useful for BI tasks.
- Date/field formatting quirks (e.g. "event_date is a varchar in `YYYY-MM-DD`, not a DATE type").
- Patterns that avoided a costly full-scan (e.g. "always partition-filter on `dt` first").
- Anything that was surprising or would save time next run.

Do NOT duplicate what's in the task history file — only write what generalises across tasks.

To look up past results before starting, search the index:
```bash
grep "BUSINT-" .claude/agent-history.jsonl | tail -20
cat ".claude/task-history/BUSINT-XXXX-*.md"
```

---

## Constraints

- **No Google Drive.** Output files locally; tell the user to upload if needed.
- **No Confluence writes** without explicit user approval.
- **No Jira comment posting** without explicit user approval.
- **No destructive Bash commands** (`rm -rf`, `DROP TABLE`, etc.).
- Keep `.env` files unread — credentials come from OS environment variables.

---

## Learned Patterns

<!-- Entries below are written by Claude after completing tasks. Newest first. -->

