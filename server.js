// server.js (Final Production-Ready Version)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

const PORT = 4000; // หรือ Port ที่คุณใช้อยู่
app.listen(PORT, (err) => {
  if (err) {
    console.error("Error starting server:", err);
    return;
  }
  console.log(`Proxy server (Production Mode) running on http://localhost:${PORT}`);
});