import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Filter, Search, RefreshCw, Settings, TrendingUp, LayoutDashboard, Table as TableIcon, ChevronDown, ChevronUp, PlusCircle, Zap, Moon, Sun, Kanban, Activity, Users, LineChart as LineChartIcon } from 'lucide-react';
import { LineChart as RechartsLineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

import useJira from './hooks/useJira';
import { parseDate, formatDateForInput, formatAssigneeName } from './utils/helpers';

import MultiSelectDropdown from './components/MultiSelectDropdown';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import TaskListDrawer from './components/TaskListDrawer';
import AssigneeChartDrawer from './components/AssigneeChartDrawer';
import LabelChartDrawer from './components/LabelChartDrawer';
import ConfigModal from './components/ConfigModal';
import CreateTaskModal from './components/CreateTaskModal';
import Badge from './components/Badge';

import ManagerDashboard from './components/ManagerDashboard';
import TableView from './components/TableView';
import BoardView from './components/BoardView';
import TimelineView from './components/TimelineView';
import TeamView from './components/TeamView'; // 🚀 Import TeamView เข้ามาใหม่

export default function App() {
    const { allTasks, setAllTasks, loading, error, isConnected, lastRefreshTime, jiraConfig, saveJiraConfig, loadJiraData, jiraAPI } = useJira();
    
    const [tasks, setTasks] = useState([]);
    const [filters, setFilters] = useState({ taskName: '', assignee: [], status: [], department: [], labels: [], biCategory: [] });
    const [dateRange, setDateRange] = useState(() => {
        const endDate = new Date(); const startDate = new Date(); startDate.setMonth(startDate.getMonth() - 3); return { start: startDate, end: endDate };
    });

    const [viewMode, setViewMode] = useState('manager'); 
    const [showFilters, setShowFilters] = useState(false); 
    const [workloadView, setWorkloadView] = useState('assignee');
    
    const [theme, setTheme] = useState(() => localStorage.getItem('jira_theme') || 'dark');
    const isDark = theme === 'dark';

    const toggleTheme = () => {
        const nextTheme = isDark ? 'light' : 'dark';
        setTheme(nextTheme);
        localStorage.setItem('jira_theme', nextTheme);
    };

    const [selectedTask, setSelectedTask] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [drawerState, setDrawerState] = useState({ isOpen: false, title: '', tasks: [] });
    const [assigneeChartDrawer, setAssigneeChartDrawer] = useState({ isOpen: false, assigneeName: '', tasks: [] });
    const [labelChartDrawer, setLabelChartDrawer] = useState({ isOpen: false, labelName: '', tasks: [] });
    const [isWorkingHours, setIsWorkingHours] = useState(false);

    const [projectUsers, setProjectUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    const handleTaskClick = useCallback((task) => { setSelectedTask(task); }, []);

    useEffect(() => {
        if (isConnected && jiraConfig.projectKey) {
            const fetchUsers = async () => {
                try {
                    const [users, me] = await Promise.all([jiraAPI.getAssignableUsers(jiraConfig.projectKey), jiraAPI.getMe()]);
                    let filteredUsers = users || [];
                    const configEmails = jiraConfig.assigneeEmails ? jiraConfig.assigneeEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) : [];

                    if (configEmails.length > 0) {
                        filteredUsers = filteredUsers.filter(user => {
                            if (user.emailAddress && configEmails.includes(user.emailAddress.toLowerCase())) return true;
                            const displayName = (user.displayName || '').toLowerCase();
                            const nameParts = displayName.split(' ').filter(Boolean);

                            const isMatch = configEmails.some(email => {
                                const localPart = email.split('@')[0]; 
                                const emailNameParts = localPart.split('.');
                                const emailFirstName = emailNameParts[0]; 
                                const emailLastNameInitial = emailNameParts.length > 1 ? emailNameParts[1][0] : ''; 

                                if (nameParts.length === 0) return false;
                                const userFirstName = nameParts[0];
                                const userLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

                                const isFirstMatch = userFirstName.includes(emailFirstName) || emailFirstName.includes(userFirstName);
                                let isLastMatch = true; 
                                if (emailLastNameInitial && userLastName) {
                                    isLastMatch = userLastName.startsWith(emailLastNameInitial);
                                }
                                return isFirstMatch && isLastMatch;
                            });
                            return isMatch;
                        });
                    }

                    if (me && !filteredUsers.some(u => u.accountId === me.accountId)) filteredUsers.push(me);

                    const uniqueUsers = Array.from(new Map(filteredUsers.map(u => [u.accountId, u])).values());
                    uniqueUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
                    setProjectUsers(uniqueUsers); 
                    setCurrentUser(me);
                } catch (e) { console.error("Fetch user data failed", e); }
            };
            fetchUsers();
        }
    }, [isConnected, jiraConfig.projectKey, jiraConfig.assigneeEmails, jiraAPI, allTasks.length]);

    useEffect(() => {
        const checkWorkingHours = () => setIsWorkingHours(new Date().getHours() >= 8 && new Date().getHours() < 19);
        checkWorkingHours(); const intervalId = setInterval(checkWorkingHours, 60 * 1000);
        return () => clearInterval(intervalId);
    }, []);

    const handleUpdateTask = async (taskId, updates) => {
        if (!isConnected) return;
        try {
            const { statusId, comment, priority, biCategory, assigneeId } = updates;
            const fieldsPayload = {};
            if (priority) fieldsPayload.priority = { name: priority };
            if (biCategory) fieldsPayload.customfield_10307 = { value: biCategory };
            if (assigneeId) fieldsPayload.assignee = { accountId: assigneeId }; 

            if (Object.keys(fieldsPayload).length > 0) await jiraAPI.updateIssue(taskId, { fields: fieldsPayload });
            if (statusId) await jiraAPI.transitionIssue(taskId, statusId);
            if (comment) await jiraAPI.addComment(taskId, comment);
            await loadJiraData();
            setSelectedTask(null);
        } catch (err) { console.error("Failed to update task:", err); throw err; }
    };

    const handleCreateTask = async (issueData) => {
        if (!isConnected) throw new Error("Disconnected");
        try {
            const createdTaskResponse = await jiraAPI.createIssue(issueData);
            const originalDescription = issueData.fields.description;
            await loadJiraData();
            setIsCreateModalOpen(false);
            setTimeout(() => {
                const newTask = allTasks.find(task => task.id === createdTaskResponse.key);
                setSelectedTask(newTask || { id: createdTaskResponse.key, title: issueData.fields.summary, description: '', status: '[BI] OPEN', assignee: 'Loading...' });
            }, 500); 
            if (originalDescription?.content?.[0]?.content?.[0]?.text) {
                setTimeout(async () => {
                    try { await jiraAPI.updateIssue(createdTaskResponse.key, { fields: { description: originalDescription } }); await loadJiraData(); } 
                    catch (updateError) { console.error("Failed to update description:", updateError); }
                }, 10000); 
            }
        } catch (err) { throw err; }
    };

    const staticBiCategoriesForCreate = ['Product Spec. Tracking [D]', 'Product Analysis [D]', 'Product Report/Ad-Hoc [D]', 'Product Investigation [D]', 'Initiation/Idea [D]', 'Others [CO]'];

    const openDrawer = useCallback((title, tasks) => setDrawerState({ isOpen: true, title, tasks }), []);
    const closeDrawer = useCallback(() => setDrawerState({ isOpen: false, title: '', tasks: [] }), []);
    const closeAssigneeChartDrawer = useCallback(() => setAssigneeChartDrawer({ isOpen: false, assigneeName: '', tasks: [] }), []);
    const closeLabelChartDrawer = useCallback(() => setLabelChartDrawer({ isOpen: false, labelName: '', tasks: [] }), []);

    const openAssigneeDrawer = useCallback((assigneeName) => {
        const personTasks = allTasks.filter(t => t.assignee === assigneeName);
        setAssigneeChartDrawer({ isOpen: true, assigneeName, tasks: personTasks });
    }, [allTasks]);

    useEffect(() => {
        const isAnyOpen = drawerState.isOpen || !!selectedTask || assigneeChartDrawer.isOpen || labelChartDrawer.isOpen || isCreateModalOpen || showConfig;
        document.body.style.overflow = isAnyOpen ? 'hidden' : 'auto';
        document.body.style.paddingRight = isAnyOpen ? `${window.innerWidth - document.documentElement.clientWidth}px` : '0';
        return () => { document.body.style.overflow = 'auto'; document.body.style.paddingRight = '0'; };
    }, [drawerState.isOpen, selectedTask, assigneeChartDrawer.isOpen, labelChartDrawer.isOpen, isCreateModalOpen, showConfig]);

    useEffect(() => {
        let filtered = [...allTasks];
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start); start.setHours(0,0,0,0);
            const end = new Date(dateRange.end); end.setHours(23,59,59,999);
            filtered = filtered.filter(t => { const d = parseDate(t.startDate); return d ? (d >= start && d <= end) : false; });
        }
        if (filters.taskName) filtered = filtered.filter(t => t.title.toLowerCase().includes(filters.taskName.toLowerCase()) || t.id.toLowerCase().includes(filters.taskName.toLowerCase()));
        if (filters.assignee.length > 0) filtered = filtered.filter(t => filters.assignee.includes(t.assignee));
        if (filters.status.length > 0) filtered = filtered.filter(t => filters.status.includes(t.status));
        if (filters.department.length > 0) filtered = filtered.filter(t => filters.department.includes(t.department));
        if (filters.labels.length > 0) filtered = filtered.filter(t => filters.labels.every(l => (t.labels || []).includes(l)));
        if (filters.biCategory.length > 0) filtered = filtered.filter(t => filters.biCategory.includes(t.biCategory));
        setTasks(filtered);
    }, [filters, allTasks, dateRange]);
    
    const { assigneeColors, uniqueAssignees, allStatuses, allDepartments, allLabels, allBiCategories, departmentColors, biCategoryColors } = useMemo(() => {
        const uniqueAssignees = [...new Set(allTasks.map(t => t.assignee).filter(Boolean))].sort();
        const allStatuses = [...new Set(allTasks.map(t => t.status))].sort();
        const allDepartments = [...new Set(allTasks.map(t => t.department).filter(Boolean))].sort();
        const allLabels = [...new Set(allTasks.flatMap(t => t.labels || []))].filter(Boolean).sort();
        const allBiCategories = [...new Set(allTasks.map(t => t.biCategory).filter(Boolean))].sort();
        
        const darkPalette = ['#c8ff57', '#6bbfff', '#ffb347', '#c084fc', '#fb7185', '#34d399', '#f472b6', '#a78bfa'];
        const lightPalette = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#6366f1'];
        const palette = isDark ? darkPalette : lightPalette;

        const colorGen = (keys, offset = 0) => { 
            const map = {}; 
            keys.forEach((k, i) => map[k] = palette[(i + offset) % palette.length]); 
            map['N/A'] = isDark ? '#6b6b85' : '#9ca3af'; 
            map['Unassigned'] = isDark ? '#ff6b6b' : '#ef4444'; 
            return map; 
        };

        return { 
            assigneeColors: colorGen(uniqueAssignees, 0),
            departmentColors: colorGen(allDepartments, 2),
            biCategoryColors: colorGen(allBiCategories, 4),
            uniqueAssignees, allStatuses, allDepartments, allLabels, allBiCategories
        };
    }, [allTasks, isDark]);

    const handleClearAllFilters = useCallback(() => {
        setFilters({ taskName: '', assignee: [], status: [], department:[], labels:[], biCategory:[] });
        const endDate = new Date(); const startDate = new Date(); startDate.setMonth(startDate.getMonth() - 3); setDateRange({ start: startDate, end: endDate });
    }, []);

    const TabButton = ({ mode, icon: Icon, label, activeClass }) => (
        <button onClick={() => setViewMode(mode)} className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all text-sm font-bold whitespace-nowrap ${viewMode === mode ? activeClass : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface)]'}`}>
            <Icon size={18} /> <span className="hidden sm:inline">{label}</span>
        </button>
    );

    const dailyWorkloadData = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const chartStartDate = new Date(); chartStartDate.setMonth(chartStartDate.getMonth() - 3);
        const data = [];
        const keys = workloadView === 'assignee' ? uniqueAssignees : (workloadView === 'department' ? allDepartments : allBiCategories);
        const colors = workloadView === 'assignee' ? assigneeColors : (workloadView === 'department' ? departmentColors : biCategoryColors);
        
        for (let d = new Date(chartStartDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
            const currentIterStart = new Date(d); currentIterStart.setHours(0,0,0,0);
            const currentIterEnd = new Date(d); currentIterEnd.setHours(23,59,59,999);

            const dayData = { date: currentIterStart.toISOString().split('T')[0], displayDate: currentIterStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
            
            keys.forEach(key => {
                dayData[key] = allTasks.filter(task => {
                    if (filters.assignee.length > 0 && !filters.assignee.includes(task.assignee)) return false;
                    const groupKey = workloadView === 'assignee' ? task.assignee : (workloadView === 'department' ? task.department : task.biCategory);
                    if (groupKey !== key) return false;
                    
                    const sd = task.created ? new Date(task.created) : parseDate(task.startDate);
                    if (!sd || sd > currentIterEnd) return false; 
                    
                    const isDone = task.status.toLowerCase().includes('done') || task.status.toLowerCase().includes('cancel');
                    if (isDone) { 
                        const rd = task.resolutiondate ? new Date(task.resolutiondate) : parseDate(task.lastUpdated); 
                        if (rd && rd <= currentIterEnd) return false; 
                    }
                    return true;
                }).length;
            });
            data.push(dayData);
        }
        return { chartData: data, activeChartKeys: keys.filter(k => data.some(d => d[k] > 0)), chartColors: colors, todayFormatted: today.toISOString().split('T')[0] };
    }, [allTasks, workloadView, filters.assignee, uniqueAssignees, allDepartments, allBiCategories, assigneeColors, departmentColors, biCategoryColors]);

    const groupedByTeam = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            const a = task.assignee || 'Unassigned';
            if (!acc[a]) acc[a] = {tasks: [], email: task.assigneeEmail };
            acc[a].tasks.push(task); return acc;
        }, {});
        return Object.entries(grouped).sort(([, a], [, b]) => b.tasks.length - a.tasks.length);
    }, [tasks]);

    return (
        <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${isDark ? 'theme-dark' : 'theme-light'} bg-[color:var(--bg)] text-[color:var(--text)]`}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&family=Noto+Sans+Thai:wght@300;400;500;700&display=swap');
                body { font-family: 'DM Sans', 'Noto Sans Thai', sans-serif; }
                h1, h2, h3, h4, h5, h6, .font-syne { font-family: 'Syne', sans-serif; }

                .theme-dark {
                    --bg: #0d0d12; --surface: #14141e; --surface2: #1c1c2a;
                    --border: rgba(255, 255, 255, 0.08); --text: #f0eff8; --muted: #6b6b85;
                    --accent: #c8ff57; --accent2: #ff6b6b; --accent3: #6bbfff; --accent4: #ffb347;
                    --alert-bg: rgba(255, 107, 107, 0.1); --alert-border: rgba(255, 107, 107, 0.32);
                    color-scheme: dark;
                }
                .theme-light {
                    --bg: #f4f4f5; --surface: #ffffff; --surface2: #f8fafc;
                    --border: rgba(0, 0, 0, 0.08); --text: #111827; --muted: #6b7280;
                    --accent: #3b82f6; --accent2: #ef4444; --accent3: #8b5cf6; --accent4: #f59e0b;
                    --alert-bg: rgba(239, 68, 68, 0.08); --alert-border: rgba(239, 68, 68, 0.3);
                    color-scheme: light;
                }
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: var(--bg); }
                ::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 4px; border: 1px solid var(--border); }
                ::-webkit-scrollbar-thumb:hover { background: var(--muted); }
            `}</style>

            <header className="bg-[color:var(--surface)] border-b border-[color:var(--border)] px-4 sm:px-6 py-3 flex flex-wrap lg:flex-nowrap justify-between items-center gap-4 sticky top-0 z-30 shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-4 min-w-max">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-[color:var(--text)] font-syne">
                        <span className="text-[color:var(--accent)]">Jira</span> Monitor
                    </h1>
                    <div className="flex items-center space-x-2 font-sans">
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${isConnected ? 'bg-[color:var(--accent)]/10 text-[color:var(--accent)] border border-[color:var(--accent)]/30' : 'bg-[color:var(--alert-bg)] text-[color:var(--accent2)] border border-[color:var(--alert-border)]'}`}>
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </div>
                        {isConnected && isWorkingHours && (
                            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white flex items-center gap-1 uppercase tracking-wide animate-pulse">
                                <Zap size={10} /> LIVE
                            </div>
                        )}
                    </div>
                </div>

                <div className="hidden xl:flex bg-[color:var(--surface2)] p-1 rounded-2xl shadow-inner border border-[color:var(--border)] items-center gap-1 flex-1 max-w-4xl justify-center transition-colors duration-300">
                    <TabButton mode="manager" icon={LayoutDashboard} label="Overview" activeClass="bg-[color:var(--accent)] text-[color:var(--bg)] shadow-md" />
                    <TabButton mode="timeline" icon={Activity} label="Timeline" activeClass="bg-[color:var(--accent3)] text-[color:var(--bg)] shadow-md" />
                    <TabButton mode="workload" icon={LineChartIcon} label="Workload" activeClass="bg-[#c084fc] text-white shadow-md" />
                    <TabButton mode="board" icon={Kanban} label="Board" activeClass="bg-[color:var(--accent4)] text-[color:var(--bg)] shadow-md" />
                    <TabButton mode="table" icon={TableIcon} label="Table List" activeClass="bg-[#ffb347] text-gray-900 shadow-md" />
                    <TabButton mode="team" icon={Users} label="Team" activeClass="bg-blue-500 text-white shadow-md" />
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3 min-w-max">
                    <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${showFilters || Object.values(filters).some(f => f.length > 0) ? 'bg-[color:var(--accent)]/10 border-[color:var(--accent)]/40 text-[color:var(--accent)]' : 'bg-[color:var(--surface2)] border-[color:var(--border)] text-[color:var(--text)] hover:bg-[color:var(--border)]'}`}>
                        <Filter size={16} /> <span className="hidden sm:inline">Filters</span> {Object.values(filters).some(f => f.length > 0) && <span className="w-2 h-2 rounded-full bg-[color:var(--accent)]"></span>}
                        {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={toggleTheme} className="bg-[color:var(--surface2)] border border-[color:var(--border)] text-[color:var(--text)] p-2.5 rounded-xl transition-colors hover:bg-[color:var(--border)]" title="Toggle Theme">
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button onClick={() => loadJiraData(false)} disabled={loading} className="bg-[color:var(--surface2)] border border-[color:var(--border)] text-[color:var(--text)] p-2.5 rounded-xl disabled:opacity-50 transition-colors hover:bg-[color:var(--border)]" title="Refresh Data">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setShowConfig(true)} className="bg-[color:var(--surface2)] border border-[color:var(--border)] text-[color:var(--text)] p-2.5 rounded-xl transition-colors hover:bg-[color:var(--border)]" title="Settings">
                        <Settings size={18} />
                    </button>
                    <button onClick={() => setIsCreateModalOpen(true)} className="bg-[color:var(--accent)] text-[color:var(--bg)] px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all hover:opacity-80 shadow-md">
                        <PlusCircle size={18} /> <span className="hidden sm:inline font-sans">Create Task</span>
                    </button>
                </div>
            </header>

            <div className="xl:hidden px-4 sm:px-6 pt-4 w-full">
                <div className="bg-[color:var(--surface)] p-1 rounded-2xl shadow-sm border border-[color:var(--border)] flex items-center gap-1 overflow-x-auto w-full">
                    <TabButton mode="manager" icon={LayoutDashboard} label="Overview" activeClass="bg-[color:var(--accent)] text-[color:var(--bg)] shadow-md" />
                    <TabButton mode="timeline" icon={Activity} label="Timeline" activeClass="bg-[color:var(--accent3)] text-[color:var(--bg)] shadow-md" />
                    <TabButton mode="workload" icon={LineChartIcon} label="Workload" activeClass="bg-[#c084fc] text-white shadow-md" />
                    <TabButton mode="board" icon={Kanban} label="Board" activeClass="bg-[color:var(--accent4)] text-[color:var(--bg)] shadow-md" />
                    <TabButton mode="table" icon={TableIcon} label="Table" activeClass="bg-[#ffb347] text-gray-900 shadow-md" />
                    <TabButton mode="team" icon={Users} label="Team" activeClass="bg-blue-500 text-white shadow-md" />
                </div>
            </div>

            {showFilters && (
                <div className="px-4 sm:px-6 pt-4 w-full font-sans">
                    <div className="p-6 rounded-3xl shadow-sm border animate-in fade-in slide-in-from-top-2 bg-[color:var(--surface)] border-[color:var(--border)] transition-colors">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-[color:var(--text)] font-syne">Filter Tasks</h3>
                            {(filters.taskName || filters.assignee.length > 0 || filters.status.length > 0 || filters.department.length > 0 || filters.labels.length > 0 || filters.biCategory.length > 0) && 
                                <button onClick={handleClearAllFilters} className="text-xs font-bold px-4 py-1.5 rounded-lg transition-colors bg-[color:var(--alert-bg)] text-[color:var(--accent2)] hover:opacity-80">Clear All</button>
                            }
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div>
                                <label className="text-xs font-bold uppercase text-[color:var(--muted)]">Search</label>
                                <div className="relative mt-1.5">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--muted)]" size={16} />
                                    <input type="text" placeholder="Name or ID..." className="pl-10 w-full p-2.5 border rounded-xl text-sm outline-none transition-all bg-[color:var(--surface)] border-[color:var(--border)] text-[color:var(--text)] focus:border-[color:var(--accent)]" value={filters.taskName} onChange={(e) => setFilters(prev => ({ ...prev, taskName: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-[color:var(--muted)]">Date Range</label>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <input type="date" className="w-full p-2.5 border rounded-xl text-sm outline-none bg-[color:var(--surface)] border-[color:var(--border)] text-[color:var(--text)] focus:border-[color:var(--accent)] [color-scheme:dark]" value={formatDateForInput(dateRange.start)} onChange={e => setDateRange(prev => ({...prev, start: new Date(e.target.value)}))} />
                                    <span className="text-[color:var(--muted)]">-</span>
                                    <input type="date" className="w-full p-2.5 border rounded-xl text-sm outline-none bg-[color:var(--surface)] border-[color:var(--border)] text-[color:var(--text)] focus:border-[color:var(--accent)] [color-scheme:dark]" value={formatDateForInput(dateRange.end)} onChange={e => setDateRange(prev => ({...prev, end: new Date(e.target.value)}))} />
                                </div>
                            </div>
                            <div><label className="text-xs font-bold uppercase text-[color:var(--muted)]">Assignee</label><div className="mt-1.5"><MultiSelectDropdown options={uniqueAssignees} selected={filters.assignee} onChange={(selected) => setFilters(prev => ({ ...prev, assignee: selected }))} placeholder="All Assignees" colors={assigneeColors} tasks={allTasks}/></div></div>
                            <div><label className="text-xs font-bold uppercase text-[color:var(--muted)]">Status</label><div className="mt-1.5"><MultiSelectDropdown options={allStatuses} selected={filters.status} onChange={(selected) => setFilters(prev => ({ ...prev, status: selected }))} placeholder="All Statuses" /></div></div>
                            <div><label className="text-xs font-bold uppercase text-[color:var(--muted)]">Department</label><div className="mt-1.5"><MultiSelectDropdown options={allDepartments} selected={filters.department} onChange={(selected) => setFilters(prev => ({ ...prev, department: selected }))} placeholder="All Departments" /></div></div>
                            <div><label className="text-xs font-bold uppercase text-[color:var(--muted)]">BI Category</label><div className="mt-1.5"><MultiSelectDropdown options={allBiCategories} selected={filters.biCategory} onChange={(selected) => setFilters(prev => ({ ...prev, biCategory: selected }))} placeholder="All Categories" /></div></div>
                        </div>
                    </div>
                </div>
            )}
            
            <main className="flex-1 px-4 sm:px-6 pb-12 pt-4 w-full font-sans">
                {error && viewMode === 'manager' && <div className="mb-6 p-4 bg-[color:var(--alert-bg)] border border-[color:var(--alert-border)] text-[color:var(--accent2)] rounded-2xl font-semibold">⚠️ {error}</div>}

                {viewMode === 'manager' && <ManagerDashboard tasks={tasks} openDrawer={openDrawer} assigneeColors={assigneeColors} uniqueAssignees={uniqueAssignees} openAssigneeDrawer={openAssigneeDrawer} />}
                
                {viewMode === 'timeline' && (
                    <div className="animate-in fade-in duration-300">
                        <TimelineView tasks={tasks} uniqueAssignees={uniqueAssignees} assigneeColors={assigneeColors} onTaskClick={handleTaskClick} openAssigneeDrawer={openAssigneeDrawer} openTaskDrawer={openDrawer} />
                    </div>
                )}

                {viewMode === 'workload' && (
                    <div className="animate-in fade-in duration-300 h-[calc(100vh-200px)] min-h-[500px]">
                        <section className="bg-[color:var(--surface)] rounded-3xl p-6 shadow-sm border border-[color:var(--border)] h-full flex flex-col">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
                                <h2 className="text-xl font-bold text-[color:var(--text)] font-syne flex items-center gap-2">
                                    <LineChartIcon className="text-[color:var(--accent)]" /> Active Workload History
                                </h2>
                                <div className="bg-[color:var(--surface2)] p-1 rounded-xl flex text-xs font-bold border border-[color:var(--border)]">
                                    <button onClick={() => setWorkloadView('assignee')} className={`px-4 py-2 rounded-lg transition-all ${workloadView === 'assignee' ? 'bg-[color:var(--surface)] shadow text-[color:var(--accent)] border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>By Assignee</button>
                                    <button onClick={() => setWorkloadView('department')} className={`px-4 py-2 rounded-lg transition-all ${workloadView === 'department' ? 'bg-[color:var(--surface)] shadow text-[color:var(--accent)] border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>By Department</button>
                                    <button onClick={() => setWorkloadView('biCategory')} className={`px-4 py-2 rounded-lg transition-all ${workloadView === 'biCategory' ? 'bg-[color:var(--surface)] shadow text-[color:var(--accent)] border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>By Category</button>
                                </div>
                            </div>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsLineChart data={dailyWorkloadData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2a2a35' : '#e5e7eb'} />
                                        <XAxis dataKey="displayDate" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)' }} dy={10} />
                                        <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)' }}/>
                                        <Tooltip cursor={{fill: 'var(--surface2)'}} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} itemStyle={{ color: 'var(--text)' }} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                                        {dailyWorkloadData.activeChartKeys.map(key => (
                                            <Line key={key} type="monotone" dataKey={key} stroke={dailyWorkloadData.chartColors[key] || 'var(--muted)'} strokeWidth={2.5} dot={{r: 3, strokeWidth: 0}} activeDot={{r: 6, strokeWidth: 0}} />
                                        ))}
                                        <ReferenceLine x={dailyWorkloadData.todayFormatted} stroke="var(--accent2)" strokeWidth={2} strokeDasharray="4 4" label={{ value: "TODAY", position: "insideTopLeft", fill: "var(--accent2)", fontSize: 10, fontWeight: 'bold' }} />
                                    </RechartsLineChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    </div>
                )}

                {viewMode === 'team' && (
                    <div className="animate-in fade-in duration-300 mt-2">
                        <TeamView groupedByTeam={groupedByTeam} assigneeColors={assigneeColors} onTaskClick={handleTaskClick} openAssigneeDrawer={openAssigneeDrawer} />
                    </div>
                )}

                {viewMode === 'board' && (
                    <div className="animate-in fade-in duration-300 mt-2">
                        <BoardView tasks={tasks} onTaskClick={handleTaskClick} assigneeColors={assigneeColors} openAssigneeDrawer={openAssigneeDrawer} />
                    </div>
                )}

                {viewMode === 'table' && (
                    <div className="animate-in fade-in duration-300 mt-2">
                        <TableView tasks={tasks} onTaskClick={handleTaskClick} assigneeColors={assigneeColors} onUpdateTask={handleUpdateTask} jiraAPI={jiraAPI} isConnected={isConnected} assignableUsers={projectUsers} openAssigneeDrawer={openAssigneeDrawer} />
                    </div>
                )}
            </main>
            
            <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} assigneeColors={assigneeColors} biCategoryColors={biCategoryColors} departmentColors={departmentColors} onUpdateTask={handleUpdateTask} jiraAPI={jiraAPI} isConnected={isConnected} assignableUsers={projectUsers} currentUser={currentUser} openAssigneeDrawer={openAssigneeDrawer} />
            <TaskListDrawer isOpen={drawerState.isOpen} onClose={closeDrawer} title={drawerState.title} tasks={drawerState.tasks} onTaskClick={(task) => { handleTaskClick(task); closeDrawer(); }}/>
            <AssigneeChartDrawer isOpen={assigneeChartDrawer.isOpen} onClose={closeAssigneeChartDrawer} assigneeName={assigneeChartDrawer.assigneeName} tasks={assigneeChartDrawer.tasks} departmentColors={departmentColors} biCategoryColors={biCategoryColors} onTaskClick={(task) => { closeAssigneeChartDrawer(); handleTaskClick(task); }}/>
            <LabelChartDrawer isOpen={labelChartDrawer.isOpen} onClose={closeLabelChartDrawer} labelName={labelChartDrawer.labelName} tasks={labelChartDrawer.tasks} biCategoryColors={biCategoryColors} onTaskClick={(task) => { closeLabelChartDrawer(); handleTaskClick(task); }}/>
            <ConfigModal isOpen={showConfig} onClose={() => setShowConfig(false)} jiraConfig={jiraConfig} saveJiraConfig={saveJiraConfig} isConnected={isConnected} />
            <CreateTaskModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateTask} projectKey={jiraConfig.projectKey} currentUser={currentUser} assignableUsers={projectUsers} departmentOptions={allDepartments} biCategoryOptions={staticBiCategoriesForCreate} />
        </div>
    );
}