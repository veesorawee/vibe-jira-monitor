import { adfToHtml, formatDate } from '../utils/helpers';

function markdownToAdf(markdown) {
    const lines = (markdown || '').split('\n');
    const content = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Code fence
        if (line.trimStart().startsWith('```')) {
            const lang = line.trim().slice(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (codeLines.length > 0) {
                content.push({
                    type: 'codeBlock',
                    attrs: lang ? { language: lang } : {},
                    content: [{ type: 'text', text: codeLines.join('\n') }],
                });
            }
            i++;
            continue;
        }

        // Heading
        const hm = line.match(/^(#{1,6})\s+(.*)/);
        if (hm) {
            content.push({
                type: 'heading',
                attrs: { level: hm[1].length },
                content: [{ type: 'text', text: hm[2] }],
            });
            i++;
            continue;
        }

        // Horizontal rule
        if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/)) {
            content.push({ type: 'rule' });
            i++;
            continue;
        }

        // Bullet list (collect consecutive items)
        if (line.match(/^[-*]\s/)) {
            const items = [];
            while (i < lines.length && lines[i].match(/^[-*]\s/)) {
                items.push({
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: lines[i].replace(/^[-*]\s+/, '') }] }],
                });
                i++;
            }
            content.push({ type: 'bulletList', content: items });
            continue;
        }

        // Ordered list
        if (line.match(/^\d+\.\s/)) {
            const items = [];
            while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
                items.push({
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: lines[i].replace(/^\d+\.\s+/, '') }] }],
                });
                i++;
            }
            content.push({ type: 'orderedList', content: items });
            continue;
        }

        // Empty line – skip
        if (!line.trim()) { i++; continue; }

        // Paragraph – collect until blank/structural line
        const paraLines = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !lines[i].startsWith('#') &&
            !lines[i].trimStart().startsWith('```') &&
            !lines[i].match(/^[-*]\s/) &&
            !lines[i].match(/^\d+\.\s/) &&
            !lines[i].match(/^-{3,}$/)
        ) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            content.push({
                type: 'paragraph',
                content: [{ type: 'text', text: paraLines.join(' ') }],
            });
        }
    }

    if (content.length === 0) {
        content.push({ type: 'paragraph', content: [{ type: 'text', text: '' }] });
    }

    return { type: 'doc', version: 1, content };
}

class JiraAPI {
    constructor() {
        this.proxyURL = 'http://localhost:4000/api/jira';
        this.projectKey = '';
    }

    async getProjectIssues(assigneeEmails = []) {
        if (!this.projectKey) {
            throw new Error('Jira Project Key is required');
        }
        try {
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 3);
            const startDateStr = startDate.toISOString().split('T')[0];
            let jql = `project = ${this.projectKey} AND created >= "${startDateStr}"`;
            if (assigneeEmails && assigneeEmails.length > 0) {
                const emailConditions = assigneeEmails.map(email => `assignee = "${email.trim()}"`).join(' OR ');
                jql += ` AND (${emailConditions})`;
            }
            jql += ' ORDER BY created DESC';
            
            const fields = 'summary,assignee,status,created,updated,duedate,priority,description,comment,customfield_10016,resolutiondate,labels,customfield_10306,customfield_10307,changelog';
            const expand = 'changelog';

            let allIssues = [];
            let nextPageToken = null; 
            const maxResults = 100;
            
            do {
        
                const payload = {
                    jql: jql,
                    fields: [
                        'summary', 'assignee', 'status', 'created', 'updated', 
                        'duedate', 'priority', 'description', 'comment', 
                        'customfield_10016', 'resolutiondate', 'labels', 
                        'customfield_10306', 'customfield_10307'
                    ],
                    expand: 'changelog',
                    maxResults: maxResults
                };

          
                if (nextPageToken) {
                    payload.nextPageToken = nextPageToken;
                }

                const response = await fetch(`${this.proxyURL}/search/jql`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    let errorBody;
                    try { errorBody = await response.json(); }
                    catch (e) { errorBody = await response.text(); }
                    const errorMessage = errorBody?.errorMessages?.join(', ') || JSON.stringify(errorBody);
                    throw new Error(`Jira API Error (${response.status}): ${errorMessage}`);
                }
                
                const data = await response.json();
                allIssues = allIssues.concat(data.issues || []);
                
   
                nextPageToken = data.nextPageToken;

            } while (nextPageToken);
            return this.transformJiraIssues(allIssues);
        } catch (error) {
            console.error('Error fetching Jira issues via proxy:', error);
            throw error;
        }
    }

    async getTransitions(issueId) {
        const response = await fetch(`${this.proxyURL}/issue/${issueId}/transitions`);
        if (!response.ok) {
            throw new Error(`Failed to get transitions: ${response.statusText}`);
        }
        return await response.json();
    }

    async transitionIssue(issueId, transitionId) {
        const body = { transition: { id: transitionId } };
        const response = await fetch(`${this.proxyURL}/issue/${issueId}/transitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok && response.status !== 204) {
            const errorText = await response.text();
            throw new Error(`Failed to transition issue via proxy: ${errorText}`);
        }
    }

    async updateIssue(issueId, updatePayload) {
        // updatePayload will be a full Jira update object, e.g.,
        // {
        //   "fields": { "priority": { "name": "High" } },
        //   "update": { "comment": [ { "add": { "body": "..." } } ] }
        // }
        const response = await fetch(`${this.proxyURL}/issue/${issueId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });

        if (!response.ok && response.status !== 204) {
            const errorText = await response.text();
            throw new Error(`Failed to update issue via proxy: ${errorText}`);
        }
    }

    async createIssue(issueData) {
        const response = await fetch(`${this.proxyURL}/issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(issueData),
        });

        const responseData = await response.json();
        if (!response.ok) {
            const errorMessages = responseData.errors ? JSON.stringify(responseData.errors) : 'Unknown error';
            throw new Error(`Failed to create issue: ${errorMessages}`);
        }
        return responseData;
    }

    async updateIssue(issueId, updatePayload) {
        const response = await fetch(`${this.proxyURL}/issue/${issueId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        });

        if (!response.ok && response.status !== 204) {
            const errorText = await response.text();
            throw new Error(`Failed to update issue: ${errorText}`);
        }
        // No body on successful PUT, so we don't return anything
    }

     async getAssignableUsers(projectKey) {
        try {
            // 🚀 แก้ไขบรรทัดนี้ เติม &maxResults=1000 เข้าไปข้างหลังสุด
            const response = await fetch(`${this.proxyURL}/user/assignable/search?project=${projectKey}&maxResults=1000`);
            
            if (!response.ok) {
                throw new Error(`Failed to get assignable users: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching assignable users:', error);
            throw error;
        }
    }

    async getMe() {
        try {
            const response = await fetch(`${this.proxyURL}/myself`);
            if (!response.ok) {
                throw new Error(`Failed to get current user: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching current user:', error);
            throw error;
        }
    }

    async addComment(issueId, comment) {
        const body = { body: markdownToAdf(comment) };

        const response = await fetch(`${this.proxyURL}/issue/${issueId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to add comment: ${errorText}`);
        }
        return await response.json();
    }




       transformJiraIssues(jiraIssues) {
        return jiraIssues.map(issue => {
            const fields = issue.fields;
            const createdDate = new Date(fields.created);

            const originalLabels = fields.labels || [];
            const filteredLabels = originalLabels.filter(label => (label || '').endsWith('@lmwn.com'));
            
            let lastUpdateDetail = null;
            let fullChangeHistory = [];
            
            const issueUpdatedTimestamp = new Date(fields.updated).getTime();

            // EDITED: New, more robust logic for determining the last update detail
            if (issue.changelog && issue.changelog.histories) {
                // Check for last comment first, as it's a very common action
                const comments = issue.fields.comment.comments;
                if (comments && comments.length > 0) {
                    const lastComment = comments[comments.length - 1];
                    const lastCommentTimestamp = new Date(lastComment.created).getTime();
                    // If the last update was within 5 seconds of the last comment, assume it was the comment.
                    if (Math.abs(issueUpdatedTimestamp - lastCommentTimestamp) < 5000) {
                        lastUpdateDetail = { type: 'twoLine', line1: 'add', line2: 'Comment' };
                    }
                }

                // If the last update wasn't a comment, check the field change history
                if (!lastUpdateDetail) {
                    const humanChanges = issue.changelog.histories.filter(
                        history => history.author.displayName !== 'Automation for Jira'
                    );

                    fullChangeHistory = humanChanges.map(history => ({
                        author: history.author.displayName,
                        created: history.created,
                        changes: history.items.map(item => ({
                            field: item.field,
                            from: item.fromString,
                            to: item.toString
                        }))
                    }));

                    if (fullChangeHistory.length > 0) {
                        const lastChangeSet = fullChangeHistory[0];
                        const lastChangeTimestamp = new Date(lastChangeSet.created).getTime();
                        
                        // Check if this changelog entry corresponds to the last update
                        if (Math.abs(issueUpdatedTimestamp - lastChangeTimestamp) < 5000) {
                            const statusChange = lastChangeSet.changes.find(c => c.field.toLowerCase() === 'status');
                            const priorityChange = lastChangeSet.changes.find(c => c.field.toLowerCase() === 'priority');
                            const firstChange = lastChangeSet.changes[0];

                            if (statusChange) {
                                const newValueLower = (statusChange.to || '').toLowerCase();
                                if (newValueLower.includes('done') || newValueLower.includes('cancel')) {
                                    lastUpdateDetail = { type: 'simple', text: 'Close Task' };
                                } else {
                                    lastUpdateDetail = { type: 'fromTo', from: statusChange.from, to: statusChange.to };
                                }
                            } else if (priorityChange) {
                                lastUpdateDetail = { type: 'fromTo', from: priorityChange.from, to: priorityChange.to };
                            } else if (firstChange) {
                                const fieldName = firstChange.field.charAt(0).toUpperCase() + firstChange.field.slice(1);
                                lastUpdateDetail = { type: 'twoLine', line1: 'change', line2: fieldName };
                            }
                        }
                    }
                }
            }

            return {
                id: issue.key,
                title: fields.summary,
                assignee: fields.assignee ? fields.assignee.displayName : 'Unassigned',
                assigneeEmail: fields.assignee ? fields.assignee.emailAddress : null,
                status: fields.status ? fields.status.name : 'Unknown',
                startDate: formatDate(createdDate), 
                startTimestamp: fields.created,
                lastUpdated: fields.updated,
                endDate: fields.resolutiondate ? formatDate(new Date(fields.resolutiondate)) : (fields.duedate ? formatDate(new Date(fields.duedate)) : null),
                dueDate: fields.duedate ? formatDate(new Date(fields.duedate)) : null,
                resolutiondate: fields.resolutiondate ? formatDate(new Date(fields.resolutiondate)) : null,
                priority: fields.priority ? fields.priority.name : 'Medium',
                description: adfToHtml(fields.description).html,
                slackLink: adfToHtml(fields.description).slackLink,
                figmaLinks: adfToHtml(fields.description).figmaLinks,
                storyPoints: fields.customfield_10016 || 0,
                department: fields.customfield_10306 ? (fields.customfield_10306.value || fields.customfield_10306) : 'N/A',
                biCategory: fields.customfield_10307 ? (fields.customfield_10307.value || fields.customfield_10307) : 'N/A',
                labels: filteredLabels,
                comments: fields.comment ? this.transformComments(fields.comment.comments) : [],
                lastUpdateDetail: lastUpdateDetail,
                fullChangeHistory: fullChangeHistory,
                created: issue.fields.created,
        updated: issue.fields.updated,
        resolutiondate: issue.fields.resolutiondate,
            };
        });
    }

    transformComments(commentsData) {
        if (!commentsData) return [];
        return commentsData.map(comment => {
            const { html: commentHtml } = adfToHtml(comment.body);
            return {
                author: comment.author ? comment.author.displayName : 'Unknown',
                created: new Date(comment.created).toLocaleString('th-TH'),
                createdTimestamp: comment.created,
                body: commentHtml || 'No content'
            };
        });
    }
}

export default JiraAPI;