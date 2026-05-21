// server.js (Final Production-Ready Version)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Resolve claude CLI path at startup so it works regardless of the server's PATH
let CLAUDE_BIN = 'claude';
try {
  CLAUDE_BIN = execSync('which claude', { encoding: 'utf8' }).trim();
} catch {
  const candidates = [
    `${process.env.HOME}/.local/bin/claude`,
    '/usr/local/bin/claude',
    `${process.env.HOME}/.npm-global/bin/claude`,
  ];
  for (const c of candidates) {
    if (require('fs').existsSync(c)) { CLAUDE_BIN = c; break; }
  }
}
console.log(`[Claude Runner] Using claude at: ${CLAUDE_BIN}`);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/jira', async (req, res) => {
  try {
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_TOKEN;

    if (!email || !token) {
      return res.status(500).json({ error: 'Jira credentials not configured on server.' });
    }

    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    const jiraHeaders = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    const jiraPath = '/rest/api/3' + req.url;
    const jiraUrl = `https://linemanwongnai.atlassian.net${jiraPath}`;
    
    console.log(`[Proxy] Forwarding ${req.method} request to: ${jiraUrl}`);

    const jiraResponse = await fetch(jiraUrl, {
      method: req.method,
      headers: jiraHeaders,
      body: (req.method !== 'GET' && req.method !== 'HEAD' && req.body) ? JSON.stringify(req.body) : undefined,
    });

    // --- NEW LOGIC TO HANDLE 204 No Content ---
    // ถ้า Status เป็น 204 (No Content) ซึ่งคือ Success สำหรับการ Update
    if (jiraResponse.status === 204) {
      // ให้ส่ง Status 204 กลับไปที่ Client เลย ซึ่งหมายถึงสำเร็จ
      return res.status(204).send();
    }
    
    const contentType = jiraResponse.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // กรณีปกติ: ถ้าเป็น JSON ให้ส่งกลับไปที่ Client
      res.writeHead(jiraResponse.status, jiraResponse.headers);
      jiraResponse.body.pipe(res);
    } else {
      // กรณีอื่นๆ ที่ไม่ใช่ JSON และไม่ใช่ 204 (เช่น หน้า Login HTML)
      const responseBody = await jiraResponse.text();
      console.error(`[Proxy] Jira responded with non-JSON content. Status: ${jiraResponse.status}`);
      console.error(responseBody);
      res.status(502).json({ error: 'Bad Gateway: Received non-JSON response from Jira.'});
    }

  } catch (error) {
    console.error('[Proxy] Critical Error:', error);
    res.status(500).json({ error: 'Proxy internal error.' });
  }
});

app.put('/api/jira/issue/:issueId', async (req, res) => {
  const { issueId } = req.params;
  const fieldsToUpdate = req.body; // รับ payload ที่ต้องการอัปเดตจาก frontend

  // เช็คว่ามีข้อมูลส่งมาหรือไม่
  if (!fieldsToUpdate || Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ error: 'Request body is empty.' });
  }

  console.log(`[Proxy] Forwarding PUT request to update issue ${issueId}`);

  try {
    const apiResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_API_USER}:${JIRA_API_TOKEN}`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fieldsToUpdate) // ส่ง payload ที่ได้รับมาต่อไปยัง Jira
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[Proxy] Jira API Error (${apiResponse.status}):`, errorText);
      // ส่งต่อ Error status และ message จาก Jira กลับไปให้ frontend
      return res.status(apiResponse.status).send(errorText);
    }
    
    // Jira จะตอบกลับด้วย status 204 No Content เมื่ออัปเดตสำเร็จ
    res.status(204).send();

  } catch (error) {
    console.error('[Proxy] Internal Server Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to get assignable users for a project
app.get('/api/jira/user/assignable/search', async (req, res) => {
  try {
    const { project } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Project key is required' });
    }

    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_TOKEN;
    const auth = Buffer.from(`${email}:${token}`).toString('base64');

    const jiraUrl = `https://linemanwongnai.atlassian.net/rest/api/3/user/assignable/search?project=${project}`;
    
    const response = await fetch(jiraUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy] Failed to get assignable users:`, errorText);
      return res.status(response.status).send(errorText);
    }

    const users = await response.json();
    res.json(users);
  } catch (error) {
    console.error('[Proxy] Error getting assignable users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to get current user (myself)
app.get('/api/jira/myself', async (req, res) => {
  try {
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_TOKEN;
    const auth = Buffer.from(`${email}:${token}`).toString('base64');

    const jiraUrl = `https://linemanwongnai.atlassian.net/rest/api/3/myself`;
    
    const response = await fetch(jiraUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy] Failed to get current user:`, errorText);
      return res.status(response.status).send(errorText);
    }

    const user = await response.json();
    res.json(user);
  } catch (error) {
    console.error('[Proxy] Error getting current user:', error);
    res.status(500).json({ error: error.message });
  }
});

// EDITED: The route for creating an issue now only adds the default label
app.post('/api/jira/issue', async (req, res) => {
  const issuePayload = req.body; // Take the payload from frontend as is
  console.log(`[Proxy] Forwarding request to create issue`);

  try {
    const apiResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_API_USER}:${JIRA_API_TOKEN}`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issuePayload)
    });

    const responseData = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error(`[Proxy] Jira API Error:`, responseData);
      return res.status(apiResponse.status).json(responseData);
    }
    res.status(apiResponse.status).json(responseData);

  } catch (error) {
    console.error('[Proxy] Internal Server Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent-history', (req, res) => {
  const { task, result } = req.body;
  if (!task?.id || !result?.text) {
    return res.status(400).json({ error: 'Missing task or result' });
  }

  try {
    const dir = path.join(__dirname, '.claude', 'task-history');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `${task.id}-${timestamp}.md`;

    const descText = (task.description || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    const bkkTime = now.toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });

    const lines = [
      `# ${task.id} — ${task.title || 'Untitled'}`,
      ``,
      `**Date:** ${bkkTime} (BKK)`,
      `**Assignee:** ${task.assignee || 'N/A'}`,
      `**BI Category:** ${task.biCategory || 'N/A'}`,
      `**Status:** ${task.status || 'N/A'}`,
      result.cost     != null ? `**Cost:** $${result.cost.toFixed(4)}` : null,
      result.duration != null ? `**Duration:** ${(result.duration / 1000).toFixed(1)}s` : null,
      ``,
      `## Requirements`,
      ``,
      descText || '_No description provided._',
      ``,
      `## Result`,
      ``,
      result.text,
    ].filter(l => l !== null).join('\n');

    fs.writeFileSync(path.join(dir, filename), lines, 'utf8');

    // Append one-line entry to the index for fast lookup
    const indexPath = path.join(__dirname, '.claude', 'agent-history.jsonl');
    fs.appendFileSync(indexPath, JSON.stringify({
      id: task.id,
      title: task.title,
      timestamp: now.toISOString(),
      file: `task-history/${filename}`,
      biCategory: task.biCategory,
      assignee: task.assignee,
    }) + '\n', 'utf8');

    console.log(`[History] Saved ${filename}`);
    res.json({ ok: true, file: filename });
  } catch (err) {
    console.error('[History] Failed to save:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/claude/run-task', (req, res) => {
  const { task } = req.body;

  if (!task) {
    return res.status(400).json({ error: 'Task data is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendEvent = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const descriptionText = (task.description || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  const sqlFileName = `${task.id.toLowerCase()}.sql`;

  const extraLinks = [
    task.slackLink ? `Slack: ${task.slackLink}` : null,
    ...(task.figmaLinks || []).map(f => `Figma: ${f.href}`),
  ].filter(Boolean).join('\n');

  // Load the skill file so the UI runner follows the same workflow as /do-task
  const skillPath = path.join(__dirname, '.claude/commands/do-task.md');
  let skillContent = '';
  try {
    skillContent = require('fs').readFileSync(skillPath, 'utf8');
  } catch {
    // skill file missing — fall back to inline instructions
  }

  const taskContext = `Task ID: ${task.id}
Title: ${task.title}
BI Category: ${task.biCategory || 'N/A'}
Status: ${task.status || 'N/A'}
Assignee: ${task.assignee || 'N/A'}
Department: ${task.department || 'N/A'}
Labels: ${(task.labels || []).join(', ') || 'None'}
Due Date: ${task.dueDate || 'N/A'}${extraLinks ? `\n\nRelated Links:\n${extraLinks}` : ''}

Description:
${descriptionText}`;

  const prompt = skillContent
    ? `${skillContent}

---
## Current Task

Follow the workflow above for this task. SQL test files should be named "${sqlFileName}" (or "${task.id.toLowerCase()}_1.sql", etc. for multiple queries).

${taskContext}`
    : `You are a data analyst. Analyze the following Jira task and decide how best to fulfill the requirements.

${taskContext}

Instructions:
1. Read and understand the requirements from the description above.
2. Decide whether the task requires querying a database:
   - Query needed: write SQL to "${sqlFileName}" then run: python3 query_trino.py ${sqlFileName}
   - Query NOT needed: provide a thorough written analysis.
3. First test any SQL with a 1-day data window and LIMIT 100. Only run the full query after the test passes.
4. Summarize your findings clearly at the end.`;

  sendEvent({ type: 'start', message: `Starting Claude Code analysis for ${task.id}...` });

  const claudeProcess = spawn(CLAUDE_BIN, [
    '--dangerously-skip-permissions',
    '--verbose',
    '--output-format', 'stream-json',
    '-p', prompt,
  ], {
    cwd: path.join(__dirname),
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Close stdin immediately so claude doesn't wait for input
  claudeProcess.stdin.end();

  let stdoutBuffer = '';

  claudeProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        sendEvent({ type: 'claude_event', event });
      } catch {
        sendEvent({ type: 'raw', text: trimmed });
      }
    }
  });

  claudeProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) sendEvent({ type: 'stderr', text });
  });

  claudeProcess.on('close', (code, signal) => {
    if (stdoutBuffer.trim()) {
      try {
        const event = JSON.parse(stdoutBuffer.trim());
        sendEvent({ type: 'claude_event', event });
      } catch {
        sendEvent({ type: 'raw', text: stdoutBuffer.trim() });
      }
    }
    sendEvent({ type: 'done', exitCode: code, signal });
    if (!res.writableEnded) res.end();
  });

  claudeProcess.on('error', (err) => {
    sendEvent({ type: 'error', text: `Failed to start Claude Code: ${err.message}. Make sure the claude CLI is installed.` });
    if (!res.writableEnded) res.end();
  });

  res.on('close', () => {
    if (!claudeProcess.killed) claudeProcess.kill('SIGTERM');
  });
});

const PORT = 4000; // หรือ Port ที่คุณใช้อยู่
app.listen(PORT, (err) => {
  if (err) {
    console.error("Error starting server:", err);
    return;
  }
  console.log(`Proxy server (Production Mode) running on http://localhost:${PORT}`);
});