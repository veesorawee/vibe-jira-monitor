import { adfToHtml, formatDate } from '../utils/helpers';

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
            let startAt = 0;
            const maxResults = 100;
            let total = 0;
            do {
                const response = await fetch(
                    `${this.proxyURL}/search?jql=${encodeURIComponent(jql)}&fields=${fields}&expand=${expand}&startAt=${startAt}&maxResults=${maxResults}`
                );
                if (!response.ok) {
                    let errorBody;
                    try { errorBody = await response.json(); }
                    catch (e) { errorBody = await response.text(); }
                    const errorMessage = errorBody?.errorMessages?.join(', ') || JSON.stringify(errorBody);
                    throw new Error(`Jira API Error (${response.status}): ${errorMessage}`);
                }
                const data = await response.json();
                allIssues = allIssues.concat(data.issues);
                total = data.total;
                startAt += maxResults;
            } while (allIssues.length < total);
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
                status: fields.status.name,
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