// src/utils/mockData.js

export const getDynamicMockTasks = () => {
    const today = new Date();
    const MOCK_TASKS_CONFIG = [
        { 
            id: 'BUSINT-7629', 
            title: 'New Feature with Figma and Redash links', 
            assignee: 'Sorawee Panichprasert', 
            assigneeEmail: 'sorawee.p@lmwn.com',
            status: '[BI] IN PROGRESS', priority: 'Highest', storyPoints: 8, 
            department: 'Engineering', biCategory: 'Feature Request', 
            labels: ['frontend', 'refactor', 'sorawee.p@lmwn.com'], 
            daysFromNow: { start: -2, end: 10, due: 12 }, 
            description: '<p>This is the main description.</p><p>Check the dashboard: <a href="https://lmwn-redash.linecorp.com/queries/59969/source" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">redash #59969</a>.</p><p><a href="https://docs.google.com/document/d/1WAk6AJJPDHEtOPJuVNrHeAplerrxgQ3_nl1EhAO_iaU/edit" class="text-blue-600 hover:underline inline-flex items-center gap-1">📄 Google Doc</a></p>',
            slackLink: "https://lmwn.slack.com/archives/C12345",
            figmaLinks: [{ href: "https://www.figma.com/design/YD8PTiUDN8bWqydNPpvMES/Self-Pickup-2024", text: "Self Pickup 2024" }, { href: "https://www.figma.com/proto/some-proto-id", text: "Interactive Prototype" }],
            comments: [{author: 'Karanit', created: new Date().toLocaleString(), body: '<p>Please see this related query as well: <a href="https://lmwn-redash.linecorp.com/queries/12345" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">redash #12345</a></p>' }] 
        },
        { id: 'BUSINT-7621', title: 'ชื่อ Task ที่ยาวมากๆๆๆๆ เพื่อทดสอบการตัดคำและให้ข้อความขึ้นบรรทัดใหม่ได้เองโดยอัตโนมัติ', assignee: 'Sorawee Panichprasert', assigneeEmail: 'sorawee.p@lmwn.com', status: '[BI] IN PROGRESS', priority: 'High', storyPoints: 8, department: 'Engineering', biCategory: 'Feature Request', labels: ['frontend', 'refactor', 'sorawee.p@lmwn.com'], daysFromNow: { start: -20, end: 10, due: 12 }, comments: [{author: 'Karanit', created: new Date().toLocaleString(), body: '<p>ช่วยตรวจสอบ requirement เพิ่มเติมด้วยครับ</p>' }] },
        { id: 'BUSINT-7622', title: 'Database Migration', assignee: 'Sarah Jones', assigneeEmail: 'sarah.j@example.com', status: '[BI] DONE', priority: 'Medium', storyPoints: 5, department: 'Data', biCategory: 'Maintenance', labels: ['backend', 'migration'], daysFromNow: { start: -40, end: -15, due: -15, resolution: -15 }, comments: [] },
        { id: 'BUSINT-7623', title: 'Setup CI/CD Pipeline', assignee: 'John Doe', assigneeEmail: 'john.d@lmwn.com', status: '[BI] IN PROGRESS', priority: 'High', storyPoints: 5, department: 'DevOps', biCategory: 'Infrastructure', labels: ['ci-cd', 'infra', 'john.d@lmwn.com'], daysFromNow: { start: -5, end: 15, due: 15 }, comments: [{author: 'Management', created: new Date().toLocaleString(), body: '<p>Need this done by EOD Friday.</p>' }] },
        { id: 'BUSINT-7624', title: 'API Documentation', assignee: 'Sarah Jones', assigneeEmail: 'sarah.j@example.com', status: '[BI] PENDING USER REVIEW', priority: 'Low', storyPoints: 3, department: 'Engineering', biCategory: 'Documentation', labels: ['docs', 'sorawee.p@lmwn.com'], daysFromNow: { start: -30, end: -2, due: 0 }, comments: [] },
    ];
    const formatDateString = (date) => date ? date.toISOString().split('T')[0] : null;
    return MOCK_TASKS_CONFIG.map(task => {
        if(task.daysFromNow) {
            const base = task.daysFromNow;
            const setDate = (days) => { const newDate = new Date(); newDate.setDate(today.getDate() + days); return newDate; };
            task.startDate = formatDateString(setDate(base.start));
            task.endDate = formatDateString(setDate(base.end));
            task.dueDate = formatDateString(setDate(base.due));
            if (base.resolution) {
                task.resolutiondate = formatDateString(setDate(base.resolution));
            } else if (task.status.toLowerCase().includes('done')) {
              task.resolutiondate = task.endDate; // Default resolution to end date if done
            }
            task.lastUpdated = new Date().toLocaleString();
            delete task.daysFromNow;
        }
        return task;
    });
};