import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Filter, Search, RefreshCw, Settings, TrendingUp, Minimize2, Maximize2, Building, Tag, Zap, PlusCircle } from 'lucide-react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// Import local dependencies
import useJira from './hooks/useJira';
import { getDynamicMockTasks } from './utils/mockData';
import { parseDate, formatDateForInput, formatAssigneeName, getStatusColor } from './utils/helpers';

// Import Components
import MultiSelectDropdown from './components/MultiSelectDropdown';
import GanttChart from './components/GanttChart';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import TaskListDrawer from './components/TaskListDrawer';
import AssigneeChartDrawer from './components/AssigneeChartDrawer';
import LabelChartDrawer from './components/LabelChartDrawer';
import ConfigModal from './components/ConfigModal';
import CreateTaskModal from './components/CreateTaskModal';
import Badge from './components/Badge';
import TimeView from './components/TimeView';

function App() {
    const { allTasks, setAllTasks, loading, error, isConnected, lastRefreshTime, jiraConfig, saveJiraConfig, loadJiraData, jiraAPI } = useJira();
    
    const [tasks, setTasks] = useState([]);
    const [filters, setFilters] = useState({ taskName: '', assignee: [], status: [], department: [], labels: [], biCategory: [] });
    
    const [dateRange, setDateRange] = useState(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        return { start: startDate, end: endDate };
    });

    const [viewMode, setViewMode] = useState('gantt');
    const [workloadView, setWorkloadView] = useState('assignee');
    const [selectedTask, setSelectedTask] = useState(null);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [currentDate] = useState(new Date());
    const [drawerState, setDrawerState] = useState({ isOpen: false, title: '', tasks: [] });
    const [assigneeChartDrawer, setAssigneeChartDrawer] = useState({ isOpen: false, assigneeName: '', tasks: [] });
    const [labelChartDrawer, setLabelChartDrawer] = useState({ isOpen: false, labelName: '', tasks: [] });
    const [isWorkingHours, setIsWorkingHours] = useState(false);

    const [projectUsers, setProjectUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    // NEW: Effect to fetch user data once when connected
    useEffect(() => {
        if (isConnected && jiraConfig.projectKey) {
            const fetchUsers = async () => {
                try {
                    const [users, me] = await Promise.all([
                        jiraAPI.getAssignableUsers(jiraConfig.projectKey),
                        jiraAPI.getMe()
                    ]);
                    setProjectUsers(users);
                    setCurrentUser(me);
                } catch (e) {
                    console.error("Failed to fetch user data:", e);
                }
            };
            fetchUsers();
        }
    }, [isConnected, jiraConfig.projectKey, jiraAPI]);


    useEffect(() => {
        const checkWorkingHours = () => {
            const now = new Date();
            const currentHour = now.getHours();
            const isWorking = currentHour >= 8 && currentHour < 19;
            setIsWorkingHours(isWorking);
        };
        checkWorkingHours();
        const intervalId = setInterval(checkWorkingHours, 60 * 1000);
        return () => clearInterval(intervalId);
    }, []);

    const handleUpdateTask = async (taskId, updates) => {
        if (!isConnected) {
            const updatedTasks = allTasks.map(task => {
                if (task.id === taskId) {
                    const newComments = updates.comment ? [...task.comments, { author: "You (Demo)", body: `<p>${updates.comment}</p>`, created: new Date().toLocaleString(), createdTimestamp: new Date().toISOString() }] : task.comments;
                    let newStatus = task.status;
                    if (updates.statusId) {
                        const availableStatuses = ['[BI] TO DO', '[BI] IN PROGRESS', '[BI] PENDING USER REVIEW', '[BI] DONE'];
                        const currentIdx = availableStatuses.indexOf(task.status);
                        newStatus = availableStatuses[(currentIdx + 1) % availableStatuses.length];
                    }
                    return { ...task, status: newStatus, priority: updates.priority || task.priority, biCategory: updates.biCategory || task.biCategory, comments: newComments, lastUpdated: new Date().toISOString() };
                }
                return task;
            });
            setAllTasks(updatedTasks);
            if (selectedTask && selectedTask.id === taskId) {
                const updatedTask = updatedTasks.find(t => t.id === taskId);
                setSelectedTask(updatedTask);
            }
            setTimeout(() => setSelectedTask(null), 500);
            return;
        }
        try {
            const { statusId, comment, priority, biCategory } = updates;
            const fieldsPayload = {};
            if (priority) { fieldsPayload.priority = { name: priority }; }
            if (biCategory) { fieldsPayload.customfield_10307 = { value: biCategory }; }
            if (Object.keys(fieldsPayload).length > 0) {
                await jiraAPI.updateIssue(taskId, { fields: fieldsPayload });
            }
            if (statusId) { await jiraAPI.transitionIssue(taskId, statusId); }
            if (comment) { await jiraAPI.addComment(taskId, comment); }
            await loadJiraData();
            setSelectedTask(null);
        } catch (err) {
            console.error("Failed to update task:", err);
            throw err;
        }
    };

        const staticBiCategoriesForCreate = [
        'Product Spec. Tracking [D]',
        'Product Analysis [D]',
        'Product Report/Ad-Hoc [D]',
        'Product Investigation [D]',
        'Initiation/Idea [D]',
        'Others [CO]'
    ];

const handleCreateTask = async (issueData) => {
    if (!isConnected) {
        alert("Cannot create task in disconnected mode.");
        throw new Error("Disconnected");
    }
    try {
        // The modal now prepares the full payload, just send it.
        const createdTaskResponse = await jiraAPI.createIssue(issueData);
        console.log('Task created successfully:', createdTaskResponse);
        
        // Store the original description to update later
        const originalDescription = issueData.fields.description;
        const createdIssueKey = createdTaskResponse.key;
        
        // Refresh data to see the new task
        await loadJiraData();
        
        // Close the create modal
        setIsCreateModalOpen(false);
        
        // Open drawer immediately
        setTimeout(() => {
            const tasks = allTasks;
            const newTask = tasks.find(task => task.id === createdIssueKey);
            if (newTask) {
                console.log('Opening task detail drawer for:', createdIssueKey);
                setSelectedTask(newTask);
            } else {
                console.warn('Could not find newly created task in allTasks');
                // If not found, still try to open with basic info
                setSelectedTask({
                    id: createdIssueKey,
                    title: issueData.fields.summary,
                    description: '', // Will be updated later
                    status: '[BI] OPEN',
                    assignee: 'Loading...'
                });
            }
        }, 500); // Small delay to ensure modal is closed
        
        // WORKAROUND: Update description after 10 seconds to bypass automation
        if (originalDescription?.content?.[0]?.content?.[0]?.text) {
            console.log(`Scheduling description update for ${createdIssueKey} in 10 seconds...`);
            
            setTimeout(async () => {
                console.log(`Now updating description for ${createdIssueKey}...`);
                try {
                    await jiraAPI.updateIssue(createdIssueKey, {
                        fields: {
                            description: originalDescription
                        }
                    });
                    console.log(`✅ Successfully updated description for ${createdIssueKey}`);
                    
                    // Refresh data to show updated description
                    await loadJiraData();
                    
                } catch (updateError) {
                    console.error("❌ Failed to update description after delay:", updateError);
                }
            }, 10000); // 10 seconds delay
        }

    } catch (err) {
        console.error("Failed to create task:", err);
        throw err;
    }
};

    const openDrawer = (title, tasks) => setDrawerState({ isOpen: true, title, tasks });
    const closeDrawer = () => setDrawerState({ isOpen: false, title: '', tasks: [] });
    const openAssigneeChartDrawer = (assigneeName, tasks) => setAssigneeChartDrawer({ isOpen: true, assigneeName, tasks });
    const closeAssigneeChartDrawer = () => setAssigneeChartDrawer({ isOpen: false, assigneeName: '', tasks: [] });
    const openLabelChartDrawer = (labelName, tasks) => setLabelChartDrawer({ isOpen: true, labelName, tasks });
    const closeLabelChartDrawer = () => setLabelChartDrawer({ isOpen: false, labelName: '', tasks: [] });
    
    // NEW: Effect to fetch user data once when connected
    useEffect(() => {
        if (isConnected && jiraConfig.projectKey) {
            const fetchUsers = async () => {
                try {
                    const [users, me] = await Promise.all([
                        jiraAPI.getAssignableUsers(jiraConfig.projectKey),
                        jiraAPI.getMe()
                    ]);
                    
                    // Define Business Intelligence team members (can be moved to config later)
                    const biTeamEmails = [
                        'sorawee.p@lmwn.com',
                        'tanyapat.m@lmwn.com',
                        // Add more BI team members here
                    ];
                    
                    // Filter users based on:
                    // 1. They are in the BI team email list OR
                    // 2. They have worked on Business Intelligence tasks OR
                    // 3. They are the current user
                    const biUsers = users.filter(user => {
                        // Check if in BI team list
                        if (biTeamEmails.includes(user.emailAddress)) return true;
                        
                        // Check if current user
                        if (user.emailAddress === me.emailAddress) return true;
                        
                        // Check if has BI department tasks
                        const userTasks = allTasks.filter(task => 
                            task.assigneeEmail === user.emailAddress && 
                            task.department === 'Business Intelligence'
                        );
                        return userTasks.length > 0;
                    });
                    
                    // Sort by displayName
                    biUsers.sort((a, b) => a.displayName.localeCompare(b.displayName));
                    
                    setProjectUsers(biUsers);
                    setCurrentUser(me);
                    
                    console.log(`Filtered ${biUsers.length} BI team members from ${users.length} total users`);
                } catch (e) {
                    console.error("Failed to fetch user data:", e);
                }
            };
            fetchUsers();
        }
    }, [isConnected, jiraConfig.projectKey, jiraAPI, allTasks]);

    useEffect(() => {
        const isAnyDrawerOpen = drawerState.isOpen || !!selectedTask || assigneeChartDrawer.isOpen || labelChartDrawer.isOpen || isCreateModalOpen;
        if (isAnyDrawerOpen) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        } else {
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '0';
        }
        return () => {
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '0';
        };
    }, [drawerState.isOpen, selectedTask, assigneeChartDrawer.isOpen, labelChartDrawer.isOpen, isCreateModalOpen]);

    useEffect(() => {
        let filtered = [...allTasks];
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start); start.setHours(0,0,0,0);
            const end = new Date(dateRange.end); end.setHours(23,59,59,999);
            filtered = filtered.filter(task => {
                const taskDate = parseDate(task.startDate);
                return taskDate ? (taskDate >= start && taskDate <= end) : false;
            });
        }
        if (filters.taskName) filtered = filtered.filter(task => task.title.toLowerCase().includes(filters.taskName.toLowerCase()) || task.id.toLowerCase().includes(filters.taskName.toLowerCase()));
        if (filters.assignee.length > 0) filtered = filtered.filter(task => filters.assignee.includes(task.assignee));
        if (filters.status.length > 0) filtered = filtered.filter(task => filters.status.includes(task.status));
        if (filters.department.length > 0) filtered = filtered.filter(task => filters.department.includes(task.department));
        if (filters.labels.length > 0) filtered = filtered.filter(task => filters.labels.every(label => (task.labels || []).includes(label)));
        if (filters.biCategory.length > 0) filtered = filtered.filter(task => filters.biCategory.includes(task.biCategory));
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const getStatusOrder = (status) => {
            const s = status.toLowerCase();
            if (s.includes('open') || s.includes('in progress') || s.includes('to do') || s.includes('reopen')) return 1;
            if (s.includes('on hold') || s.includes('pending review')) return 2;
            if (s.includes('done') || s.includes('cancel')) return 3;
            return 4; 
        };

        filtered.sort((a, b) => {
            const orderA = getStatusOrder(a.status);
            const orderB = getStatusOrder(b.status);
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            if (orderA === 3) {
                const dateA = new Date(a.lastUpdated);
                const dateB = new Date(b.lastUpdated);
                return dateB - dateA;
            } else {
                const priorityOrder = { 'Highest': 1, 'High': 2, 'Medium': 3, 'Low': 4, default: 5 };
                const priorityA = priorityOrder[a.priority] || priorityOrder.default;
                const priorityB = priorityOrder[b.priority] || priorityOrder.default;
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                const dateA = a.dueDate ? parseDate(a.dueDate) : null;
                const dateB = b.dueDate ? parseDate(b.dueDate) : null;
                if (dateA && !dateB) return -1;
                if (!dateA && dateB) return 1;
                if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
                    return dateA - dateB;
                }
                const isA_Overdue = dateA ? today > dateA : false;
                const isB_Overdue = dateB ? today > dateB : false;
                if (isA_Overdue !== isB_Overdue) {
                    return isA_Overdue ? -1 : 1;
                }
            }
            return 0;
        });
        setTasks(filtered);
    }, [filters, allTasks, dateRange]);
    
    const { assigneeColors, uniqueAssignees, allStatuses, allDepartments, allLabels, allBiCategories, departmentColors, biCategoryColors } = useMemo(() => {
        const dataToProcess = allTasks;
        const uniqueAssignees = [...new Set(allTasks.map(task => task.assignee).filter(Boolean))].sort();
        const allStatuses = [...new Set(dataToProcess.map(t => t.status))].sort();
        const allDepartments = [...new Set(dataToProcess.map(t => t.department).filter(Boolean))].sort();
        const allLabels = [...new Set(dataToProcess.flatMap(t => t.labels || []))].filter(Boolean).sort();
        const allBiCategories = [...new Set(dataToProcess.map(t => t.biCategory).filter(Boolean))].sort();
        const colorGen = (keys, colors) => {
            const colorMap = {};
            keys.forEach((key, index) => { colorMap[key] = colors[index % colors.length]; });
            colorMap['N/A'] = '#9ca3af';
            colorMap['Unassigned'] = '#9ca3af';
            return colorMap;
        };
        const assigneeColors = colorGen(uniqueAssignees, ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#6366f1']);
        const departmentColors = colorGen(allDepartments, ['#a855f7', '#14b8a6', '#6366f1', '#eab308', '#0891b2', '#db2777', '#65a30d', '#f472b6']);
        const biCategoryColors = colorGen(allBiCategories, ['#fdba74', '#a78bfa', '#f0abfc', '#67e8f9', '#86efac', '#fd79a8', '#a8edea', '#fde047']);
        return { assigneeColors, uniqueAssignees, allStatuses, allDepartments, allLabels, allBiCategories, departmentColors, biCategoryColors };
    }, [allTasks]);

    const dailyWorkloadData = useMemo(() => {
        const dataToProcess = allTasks;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        const chartStartDate = new Date(); chartStartDate.setMonth(chartStartDate.getMonth() - 3);
        const chartEndDate = new Date();
        const data = [];
        let keys, colors;
        if (workloadView === 'assignee') { keys = uniqueAssignees; colors = assigneeColors; } 
        else if (workloadView === 'department') { keys = allDepartments; colors = departmentColors; } 
        else { keys = allBiCategories; colors = biCategoryColors; }
        for (let d = new Date(chartStartDate); d <= chartEndDate; d.setDate(d.getDate() + 1)) {
            const currentDateIter = new Date(d); currentDateIter.setHours(0, 0, 0, 0);
            const dayData = { date: currentDateIter.toISOString().split('T')[0], displayDate: currentDateIter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
            keys.forEach(key => {
                dayData[key] = dataToProcess.filter(task => {
                    if (filters.assignee.length > 0 && !filters.assignee.includes(task.assignee)) return false;
                    const groupKey = workloadView === 'assignee' ? task.assignee : (workloadView === 'department' ? task.department : task.biCategory);
                    if (groupKey !== key) return false;
                    const taskStartDate = parseDate(task.startDate);
                    if (!taskStartDate || currentDateIter < taskStartDate) return false;
                    const isResolved = task.status.toLowerCase().includes('done') || task.status.toLowerCase().includes('cancelled');
                    if (isResolved) { const taskResolutionDate = parseDate(task.resolutiondate); return taskResolutionDate && currentDateIter <= taskResolutionDate; } 
                    else { return true; }
                }).length;
            });
            data.push(dayData);
        }
        const activeKeys = keys.filter(key => data.some(dayData => dayData[key] > 0));
        return { chartData: data, activeChartKeys: activeKeys, chartColors: colors, todayFormatted: todayStr };
    }, [allTasks, workloadView, filters.assignee, uniqueAssignees, allDepartments, allBiCategories, assigneeColors, departmentColors, biCategoryColors]);

    const workloadByPerson = useMemo(() => {
        const workload = allTasks.reduce((acc, task) => {
            const assignee = task.assignee || 'Unassigned';
            if (!acc[assignee]) acc[assignee] = { total: 0, completed: 0, storyPoints: 0, email: task.assigneeEmail };
            acc[assignee].total++;
            acc[assignee].storyPoints += task.storyPoints || 0;
            if (task.status.toLowerCase().includes('done') || task.status.toLowerCase().includes('cancelled')) acc[assignee].completed++;
            return acc;
        }, {});
        return Object.entries(workload).sort(([a], [b]) => a.localeCompare(b));
    }, [allTasks]);
    
    const labelLeaderboard = useMemo(() => {
        const leaderboard = tasks.reduce((acc, task) => {
            (task.labels || []).forEach(label => {
                if (!acc[label]) acc[label] = { totalTasks: 0, assignees: {} };
                acc[label].totalTasks++;
                const assigneeName = task.assignee || 'Unassigned';
                if (!acc[label].assignees[assigneeName]) acc[label].assignees[assigneeName] = { count: 0, email: task.assigneeEmail };
                acc[label].assignees[assigneeName].count++;
            });
            return acc;
        }, {});
        const processedLeaderboard = Object.entries(leaderboard).map(([label, data]) => {
            const sortedAssignees = Object.entries(data.assignees).sort(([, dataA], [, dataB]) => dataB.count - dataA.count);
            return { label, totalTasks: data.totalTasks, assignees: sortedAssignees };
        });
        const filteredLeaderboard = processedLeaderboard.filter(item => (item.label || '').endsWith('@lmwn.com'));
        filteredLeaderboard.sort((a, b) => b.totalTasks - a.totalTasks);
        return filteredLeaderboard;
    }, [tasks]);

    const sourceOfTaskData = useMemo(() => {
        const hierarchy = {};
        tasks.forEach(task => {
            const dept = task.department || 'N/A';
            const category = task.biCategory || 'N/A';
            const relevantLabels = task.labels || [];
            if (!hierarchy[dept]) { hierarchy[dept] = { labels: {} }; }
            const processLabel = (label) => {
                if (!hierarchy[dept].labels[label]) { hierarchy[dept].labels[label] = { categories: {} }; }
                if (!hierarchy[dept].labels[label].categories[category]) { hierarchy[dept].labels[label].categories[category] = { tasks: [] }; }
                hierarchy[dept].labels[label].categories[category].tasks.push(task);
            };
            if (relevantLabels.length > 0) { relevantLabels.forEach(processLabel); } 
            else { processLabel('No Label'); }
        });
        return Object.entries(hierarchy).map(([deptName, deptData]) => {
            const labels = Object.entries(deptData.labels).map(([labelName, labelData]) => {
                const categories = Object.entries(labelData.categories).map(([catName, catData]) => ({ name: catName, tasks: catData.tasks, taskCount: catData.tasks.length })).sort((a, b) => b.taskCount - a.taskCount);
                return { name: labelName, categories: categories, taskCount: categories.reduce((sum, cat) => sum + cat.taskCount, 0) };
            }).sort((a, b) => b.taskCount - a.taskCount);
            return { name: deptName, labels: labels, taskCount: labels.reduce((sum, label) => sum + label.taskCount, 0) };
        }).sort((a, b) => b.taskCount - a.taskCount);
    }, [tasks]);
    
    const assigneeSourceData = useMemo(() => {
        const hierarchy = {};
        tasks.forEach(task => {
            const assignee = task.assignee || 'Unassigned';
            const dept = task.department || 'N/A';
            const category = task.biCategory || 'N/A';
            const relevantLabels = task.labels || [];
            if (!hierarchy[assignee]) hierarchy[assignee] = { depts: {}, email: task.assigneeEmail };
            if (!hierarchy[assignee].depts[dept]) hierarchy[assignee].depts[dept] = { labels: {} };
            const processLabel = (label) => {
                if (!hierarchy[assignee].depts[dept].labels[label]) { hierarchy[assignee].depts[dept].labels[label] = { categories: {} }; }
                if (!hierarchy[assignee].depts[dept].labels[label].categories[category]) { hierarchy[assignee].depts[dept].labels[label].categories[category] = { tasks: [] }; }
                hierarchy[assignee].depts[dept].labels[label].categories[category].tasks.push(task);
            };
            if (relevantLabels.length > 0) { relevantLabels.forEach(processLabel); } 
            else { processLabel('No Label'); }
        });
        return Object.entries(hierarchy).map(([assigneeName, assigneeData]) => {
            const depts = Object.entries(assigneeData.depts).map(([deptName, deptData]) => {
                const labels = Object.entries(deptData.labels).map(([labelName, labelData]) => {
                    const categories = Object.entries(labelData.categories).map(([catName, catData]) => ({ name: catName, tasks: catData.tasks, taskCount: catData.tasks.length })).sort((a, b) => b.taskCount - a.taskCount);
                    return { name: labelName, categories, taskCount: categories.reduce((sum, cat) => sum + cat.taskCount, 0) };
                }).sort((a, b) => b.taskCount - a.taskCount);
                return { name: deptName, labels, taskCount: labels.reduce((sum, label) => sum + label.taskCount, 0) };
            }).sort((a, b) => b.taskCount - a.taskCount);
            return { name: assigneeName, email: assigneeData.email, depts, taskCount: depts.reduce((sum, dept) => sum + dept.taskCount, 0) };
        }).sort((a, b) => b.taskCount - a.taskCount);
    }, [tasks]);

    const { minDateForGantt, maxDateForGantt } = useMemo(() => {
        if (tasks.length === 0) {
            const today = new Date(); const minD = new Date(today); minD.setDate(today.getDate() - 14); const maxD = new Date(today); maxD.setDate(today.getDate() + 14); return { minDateForGantt: minD, maxDateForGantt: maxD };
        }
        const allDates = tasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate), parseDate(t.dueDate)]).filter(Boolean);
        if (allDates.length === 0) {
            const today = new Date(); const minD = new Date(today); minD.setDate(today.getDate() - 14); const maxD = new Date(today); maxD.setDate(today.getDate() + 14); return { minDateForGantt: minD, maxDateForGantt: maxD };
        }
        const minD = new Date(Math.min(...allDates)); const maxD = new Date(Math.max(...allDates));
        minD.setDate(minD.getDate() - 7); maxD.setDate(maxD.getDate() + 7);
        return { minDateForGantt: minD, maxDateForGantt: maxD };
    }, [tasks]);

    const handleAssigneeFilter = (person) => setFilters(prev => ({ ...prev, assignee: prev.assignee.includes(person) ? prev.assignee.filter(a => a !== person) : [...prev.assignee, person] }));
    const handleClearAllFilters = () => {
        setFilters({ taskName: '', assignee: [], status: [], department:[], labels:[], biCategory:[] });
        const endDate = new Date(); const startDate = new Date(); startDate.setMonth(startDate.getMonth() - 3); setDateRange({ start: startDate, end: endDate });
    };

    const groupedByTeam = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            const assignee = task.assignee || 'Unassigned';
            if (!acc[assignee]) acc[assignee] = {tasks: [], email: task.assigneeEmail };
            acc[assignee].tasks.push(task);
            return acc;
        }, {});
        return Object.entries(grouped).sort(([, a], [, b]) => b.tasks.length - a.tasks.length);
    }, [tasks]);

    const groupedByDepartment = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            const dept = task.department || 'N/A';
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(task);
            return acc;
        }, {});
        return Object.entries(grouped).sort(([, tasksA], [, tasksB]) => tasksB.length - tasksA.length);
    }, [tasks]);

    const groupedByBiCategory = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            const cat = task.biCategory || 'N/A';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(task);
            return acc;
        }, {});
        return Object.entries(grouped).sort(([, tasksA], [, tasksB]) => tasksB.length - tasksA.length);
    }, [tasks]);

    const groupedByStatus = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            const status = task.status || 'N/A';
            if (!acc[status]) acc[status] = [];
            acc[status].push(task);
            return acc;
        }, {});
        const getStatusOrder = (status) => {
            const s = status.toLowerCase();
            if (s.includes('open') || s.includes('in progress') || s.includes('to do') || s.includes('reopen')) return 1;
            if (s.includes('on hold') || s.includes('pending review')) return 2;
            if (s.includes('done') || s.includes('cancel')) return 3;
            return 4; 
        };
        return new Map(Object.entries(grouped).sort(([statusA], [statusB]) => getStatusOrder(statusA) - getStatusOrder(statusB)));
    }, [tasks]);

    const TeamView = () => ( <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{ groupedByTeam.map(([person, {tasks: personTasks, email}]) => ( <div key={person} className="bg-white rounded-lg shadow overflow-hidden flex flex-col"><div className="p-4 border-b flex items-center space-x-3"><span className="w-4 h-4 rounded-full" style={{backgroundColor: assigneeColors[person]}}></span><h3 className="text-lg font-semibold">{formatAssigneeName(person, email)}<span className="ml-2 text-sm text-gray-500">({personTasks.length} tasks)</span></h3></div><div className="p-4 space-y-3 flex-grow overflow-y-auto" style={{maxHeight: '24rem'}}>{personTasks.slice(0, 5).map(task => (<div key={task.id} className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedTask(task)}><p className="text-sm text-gray-900 mb-2 font-medium">{task.title}</p><div className="flex justify-between items-center text-xs text-gray-500"><div className="flex items-center flex-wrap gap-2"><Badge type="priority" task={task} /><Badge type="timeliness" task={task} /><Badge type="status" task={task} /></div><span className="text-xs text-gray-500">{task.storyPoints || 0} pts</span></div></div>))}{personTasks.length > 5 && (<div className="text-center text-sm text-blue-600 pt-2 cursor-pointer" onClick={() => openDrawer(`${formatAssigneeName(person, email)}'s Tasks`, personTasks)}>View all {personTasks.length} tasks...</div>)}</div></div>))}</div> );
    
    const StatusColumn = ({ title, tasks = [], onTaskClick, assigneeColors }) => ( <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col"><div className={`p-4 border-b flex items-center space-x-3 ${getStatusColor(title)}`}><h3 className="text-lg font-semibold">{title}<span className="ml-2 text-sm font-normal text-gray-700">({tasks.length} tasks)</span></h3></div><div className="p-4 space-y-3 flex-grow overflow-y-auto" style={{ height: '40rem' }}>{tasks.length === 0 ? ( <p className="text-gray-500 text-center pt-10">No tasks in this status.</p>) : (tasks.map(task => (<div key={task.id} className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedTask(task)}><p className="text-sm font-medium text-gray-900 mb-2 truncate" title={task.title}>{task.title}</p><div className="mt-2 pt-2 border-t border-gray-100"><div className="flex justify-between items-center text-xs text-gray-500"><div className="flex items-center gap-1.5 truncate"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: assigneeColors[task.assignee] }}></span><span className="truncate">{formatAssigneeName(task.assignee, task.assigneeEmail)}</span></div><div className="flex items-center gap-1 flex-shrink-0"><Badge type="timeliness" task={task} /><Badge type="priority" task={task} /></div></div></div></div>)))} </div></div> );

    return (
        <div className="p-4 md:p-6 bg-gray-50 text-gray-900 min-h-screen">
            <header className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <div>
                        <h1 className="text-3xl font-bold">Team Dashboard</h1>
                        <div className="flex items-center space-x-4 mt-1">
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
                            {isConnected && isWorkingHours && (
                                <div className="px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white flex items-center gap-1 animate-pulse">
                                    <Zap size={12} />
                                    <span>LIVE</span>
                                </div>
                            )}
                        </div>
                        {lastRefreshTime && isConnected && (
                            <p className="text-xs text-gray-500 mt-1">
                                Last refresh: {lastRefreshTime.toLocaleTimeString('th-TH')}
                            </p>
                        )}
                        {error && <div className="mt-2 p-3 bg-red-100 text-red-800 rounded text-sm break-all">⚠️ **Error:** {error}</div>}
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        <button onClick={() => setIsCreateModalOpen(true)} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2">
                            <PlusCircle className="w-4 h-4" />
                            <span>Create Task</span>
                        </button>
                        <button onClick={() => loadJiraData(false)} disabled={loading} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span></button>
                        <button onClick={() => setShowConfig(true)} className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 flex items-center space-x-2"><Settings className="w-4 h-4" /><span>Config</span></button>
                    </div>
                </div>
            </header>
            
            <main>
                <div className="mb-6 bg-white rounded-lg shadow">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h2 className="text-xl font-semibold flex items-center"><TrendingUp className="w-5 h-5 mr-2" />Daily Workload</h2>
                        <div className="bg-gray-100 p-1 rounded-lg shadow-inner inline-flex items-center">
                            <button onClick={() => setWorkloadView('assignee')} className={`px-3 py-1 rounded-md transition-colors text-sm ${workloadView === 'assignee' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>By Assignee</button>
                            <button onClick={() => setWorkloadView('department')} className={`px-3 py-1 rounded-md transition-colors text-sm ${workloadView === 'department' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>By Department</button>
                            <button onClick={() => setWorkloadView('biCategory')} className={`px-3 py-1 rounded-md transition-colors text-sm ${workloadView === 'biCategory' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>By BI Category</button>
                        </div>
                    </div>
                    <div className="p-2 sm:p-4">
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={dailyWorkloadData.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={'#e5e7eb'} />
                                <XAxis dataKey="displayDate" fontSize={12} interval="preserveStartEnd" tick={{ fill: '#6b7280' }} />
                                <YAxis allowDecimals={false} tick={{ fill: '#6b7280' }}/>
                                <Tooltip contentStyle={{ backgroundColor: 'white', borderColor: '#e5e7eb' }} labelStyle={{ color: '#111827' }} />
                                <Legend formatter={(value) => value} />
                                {dailyWorkloadData.activeChartKeys.map(key => (
                                    <Line key={key} type="monotone" dataKey={key} name={key} stroke={dailyWorkloadData.chartColors[key] || '#9ca3af'} strokeWidth={2} dot={{r: 2}} activeDot={{r: 6}} />
                                ))}
                                <ReferenceLine x={dailyWorkloadData.todayFormatted} stroke="red" strokeWidth={3} label={{ value: "Today", position: "top", fill: "red", fontSize: 12, fontWeight: 'bold' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            
                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-4">Team Workload & Color Legend</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {workloadByPerson.map(([person, workload]) => (
                            <div key={person} className={`bg-white p-4 rounded-lg shadow border-2 ${filters.assignee.includes(person) ? 'border-blue-500' : 'border-transparent'} hover:border-blue-400 cursor-pointer transition-all`} onClick={() => handleAssigneeFilter(person)}>
                                <h3 className="text-base font-semibold flex items-center mb-2">
                                    <span className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: assigneeColors[person]}}></span>
                                    {formatAssigneeName(person, workload.email)}
                                </h3>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-600">Tasks:</span><span>{workload.completed}/{workload.total}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Story Pts:</span><span>{workload.storyPoints}</span></div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                        <div className="h-2 rounded-full" style={{ width: `${(workload.total > 0 ? (workload.completed / workload.total) * 100 : 0)}%`, backgroundColor: assigneeColors[person] }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white p-4 rounded-lg shadow mb-6">
                    <div className="flex items-center space-x-4 mb-4">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <h3 className="font-medium">Filters</h3>
                        {(filters.taskName || filters.assignee.length > 0 || filters.status.length > 0 || filters.department.length > 0 || filters.labels.length > 0 || filters.biCategory.length > 0) && 
                            <button onClick={handleClearAllFilters} className="text-sm text-blue-600 hover:text-blue-800">Clear All Filters</button>
                        }
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs text-gray-500">Search Task</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input type="text" placeholder="Name or ID..." className="pl-10 w-full p-2 border rounded-lg" value={filters.taskName} onChange={(e) => setFilters(prev => ({ ...prev, taskName: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Start Date</label>
                            <input type="date" className="w-full p-2 border rounded-lg" value={formatDateForInput(dateRange.start)} onChange={e => setDateRange(prev => ({...prev, start: new Date(e.target.value)}))} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">End Date</label>
                            <input type="date" className="w-full p-2 border rounded-lg" value={formatDateForInput(dateRange.end)} onChange={e => setDateRange(prev => ({...prev, end: new Date(e.target.value)}))} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Assignee</label>
                            <MultiSelectDropdown options={uniqueAssignees} selected={filters.assignee} onChange={(selected) => setFilters(prev => ({ ...prev, assignee: selected }))} placeholder="All Assignees" colors={assigneeColors} tasks={allTasks}/>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Status</label>
                            <MultiSelectDropdown options={allStatuses} selected={filters.status} onChange={(selected) => setFilters(prev => ({ ...prev, status: selected }))} placeholder="All Statuses" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Department</label>
                            <MultiSelectDropdown options={allDepartments} selected={filters.department} onChange={(selected) => setFilters(prev => ({ ...prev, department: selected }))} placeholder="All Departments" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Label</label>
                            <MultiSelectDropdown options={allLabels} selected={filters.labels} onChange={(selected) => setFilters(prev => ({ ...prev, labels: selected }))} placeholder="All Labels" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">BI Category</label>
                            <MultiSelectDropdown options={allBiCategories} selected={filters.biCategory} onChange={(selected) => setFilters(prev => ({ ...prev, biCategory: selected }))} placeholder="All BI Categories" />
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">Showing {tasks.length} tasks</div>
                </section>
            
                <div className="mb-6 flex justify-between items-center">
                    <div className="bg-white p-1 rounded-lg shadow inline-flex items-center flex-wrap">
                        <button onClick={() => setViewMode('gantt')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'gantt' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>Gantt</button>
                        <button onClick={() => setViewMode('time')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'time' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By Time</button>
                        <button onClick={() => setViewMode('status')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'status' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By Status</button>
                        <button onClick={() => setViewMode('assignee-source')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'assignee-source' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By Assignee Source</button>
                        <button onClick={() => setViewMode('source')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'source' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By Dept. Source</button>
                        <button onClick={() => setViewMode('team')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'team' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By Team</button>
                        <button onClick={() => setViewMode('department')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'department' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By Department</button>
                        <button onClick={() => setViewMode('biCategory')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'biCategory' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By BI Category</button>
                        <button onClick={() => setViewMode('label')} className={`px-3 py-2 rounded-md transition-colors text-sm ${viewMode === 'label' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>By Label</button>
                    </div>
                    {viewMode === 'gantt' && (<button onClick={() => setIsCompactMode(!isCompactMode)} title={isCompactMode ? 'Default View' : 'Compact View'} className="p-2 rounded-md transition-colors text-sm text-gray-600 bg-white shadow hover:bg-gray-200">{isCompactMode ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}</button>)}
                </div>
                
                {viewMode === 'gantt' && <GanttChart tasks={tasks} minDate={minDateForGantt} maxDate={maxDateForGantt} isCompactMode={isCompactMode} onTaskClick={setSelectedTask} assigneeColors={assigneeColors} currentDate={currentDate} />}
                {viewMode === 'time' && <TimeView tasks={tasks} onTaskClick={setSelectedTask} assigneeColors={assigneeColors} />}
                {viewMode === 'team' && <TeamView />}
                {viewMode === 'status' && (() => { const row1Statuses = ['[BI] OPEN', '[BI] IN PROGRESS', '[BI] DONE']; const row2Statuses = ['[BI] ON HOLD', '[BI] PENDING USER REVIEW', '[BI] CANCELLED']; return ( <div className="flex flex-col gap-8"><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{row1Statuses.map(statusName => (<StatusColumn key={statusName} title={statusName} tasks={groupedByStatus.get(statusName) || []} onTaskClick={setSelectedTask} openDrawer={openDrawer} assigneeColors={assigneeColors} />))}</div><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{row2Statuses.map(statusName => (<StatusColumn key={statusName} title={statusName} tasks={groupedByStatus.get(statusName) || []} onTaskClick={setSelectedTask} openDrawer={openDrawer} assigneeColors={assigneeColors} />))}</div></div> );})()}
                {viewMode === 'department' && (<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{groupedByDepartment.map(([dept, deptTasks]) => ( <div key={dept} className="bg-white rounded-lg shadow overflow-hidden flex flex-col"><div className="p-4 border-b flex items-center space-x-3"><span className="w-4 h-4 rounded-full" style={{backgroundColor: departmentColors[dept]}}></span><h3 className="text-lg font-semibold">{dept}<span className="ml-2 text-sm text-gray-500">({deptTasks.length} tasks)</span></h3></div><div className="p-4 space-y-3 flex-grow overflow-y-auto" style={{maxHeight: '24rem'}}>{deptTasks.slice(0, 5).map(task => (<div key={task.id} className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedTask(task)}><p className="text-sm text-gray-900 mb-2 font-medium">{task.title}</p><div className="flex justify-between items-center text-xs text-gray-500"><span>{formatAssigneeName(task.assignee, task.assigneeEmail)}</span><Badge type="status" task={task} /></div></div>))}{deptTasks.length > 5 && (<div className="text-center text-sm text-blue-600 pt-2 cursor-pointer" onClick={() => openDrawer(`Department: ${dept}`, deptTasks)}>View all {deptTasks.length} tasks...</div>)}</div></div>))}</div>)}
                {viewMode === 'biCategory' && (<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{groupedByBiCategory.map(([cat, catTasks]) => (<div key={cat} className="bg-white rounded-lg shadow overflow-hidden flex flex-col"><div className="p-4 border-b flex items-center space-x-3"><span className="w-4 h-4 rounded-full" style={{backgroundColor: biCategoryColors[cat]}}></span><h3 className="text-lg font-semibold">{cat}<span className="ml-2 text-sm text-gray-500">({catTasks.length} tasks)</span></h3></div><div className="p-4 space-y-3 flex-grow overflow-y-auto" style={{maxHeight: '24rem'}}>{catTasks.slice(0, 5).map(task => (<div key={task.id} className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedTask(task)}><p className="text-sm text-gray-900 mb-2 font-medium">{task.title}</p><div className="flex justify-between items-center text-xs text-gray-500"><span>{formatAssigneeName(task.assignee, task.assigneeEmail)}</span><Badge type="status" task={task} /></div></div>))}{catTasks.length > 5 && (<div className="text-center text-sm text-blue-600 pt-2 cursor-pointer" onClick={() => openDrawer(`BI Category: ${cat}`, catTasks)}>View all {catTasks.length} tasks...</div>)}</div></div>))}</div>)}
                {viewMode === 'label' && (<div className="bg-white rounded-lg shadow overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-xs text-gray-700 uppercase"><tr><th className="px-6 py-3">#</th><th className="px-6 py-3">Label</th><th className="px-6 py-3">Total Tasks</th><th className="px-6 py-3">Assignees</th></tr></thead><tbody>{labelLeaderboard.map((item, index) => (<tr key={item.label} className="bg-white border-b hover:bg-gray-50"><td className="px-6 py-4 font-medium">{index + 1}</td><td className="px-6 py-4 font-semibold text-blue-600 hover:underline cursor-pointer" onClick={() => openLabelChartDrawer(item.label, tasks.filter(t => t.labels.includes(item.label)))}>{item.label}</td><td className="px-6 py-4">{item.totalTasks}</td><td className="px-6 py-4 flex flex-wrap gap-x-4 gap-y-2">{item.assignees.map(([assignee, data]) => (<div key={assignee} className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: assigneeColors[assignee]}}></span><button className="hover:underline" onClick={() => openDrawer(`Label: ${item.label} / Assignee: ${assignee}`, tasks.filter(t => t.labels.includes(item.label) && (t.assignee || 'Unassigned') === assignee))}>{formatAssigneeName(assignee, data.email)} ({data.count})</button></div>))}</td></tr>))}</tbody></table></div>)}
                {viewMode === 'source' && (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{sourceOfTaskData.map(dept => (<div key={dept.name} className="bg-white rounded-lg shadow flex flex-col"><h3 className="p-4 border-b text-lg font-semibold flex items-center space-x-3"><span className="w-4 h-4 rounded-full" style={{ backgroundColor: departmentColors[dept.name] }}></span><span>{dept.name}</span><span className="text-base font-normal text-gray-500">({dept.taskCount} tasks)</span></h3><div className="p-4 space-y-4 flex-grow overflow-y-auto" style={{maxHeight: '32rem'}}>{dept.labels.map(label => (<div key={label.name} className="pl-4 border-l-2"><div className="flex items-center space-x-3 mb-2"><Tag className="w-4 h-4 text-gray-600" /><h4 className="font-semibold">{label.name} <span className="font-normal text-gray-600">({label.taskCount} tasks)</span></h4></div><div className="pl-6 space-y-1 text-sm">{label.categories.map(cat => (<div key={cat.name} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer" onClick={() => openDrawer(`${dept.name} > ${label.name} > ${cat.name}`, cat.tasks)}><div className="flex items-center space-x-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: biCategoryColors[cat.name] }}></span><span>{cat.name}</span></div><span className="text-gray-600">{cat.taskCount} tasks</span></div>))}</div></div>))}</div></div>))}</div>)}
                {viewMode === 'assignee-source' && (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{assigneeSourceData.map(assignee => (<div key={assignee.name} className="bg-white rounded-lg shadow flex flex-col"><h3 className="p-4 border-b text-lg font-semibold flex items-center space-x-3 cursor-pointer hover:bg-gray-50" onClick={() => openAssigneeChartDrawer(assignee.name, tasks.filter(t => (t.assignee || 'Unassigned') === assignee.name))}><span className="w-4 h-4 rounded-full" style={{ backgroundColor: assigneeColors[assignee.name] }}></span><span>{formatAssigneeName(assignee.name, assignee.email)}</span><span className="ml-3 text-base font-normal text-gray-500">({assignee.taskCount} tasks)</span></h3><div className="p-4 space-y-4 flex-grow overflow-y-auto" style={{maxHeight: '32rem'}}>{assignee.depts.map(dept => (<div key={dept.name} className="pl-4"> <div className="flex items-center space-x-3 mb-2"><Building className="w-4 h-4 text-gray-600" /><h4 className="font-semibold">{dept.name} <span className="font-normal text-gray-600">({dept.taskCount} tasks)</span></h4></div>{dept.labels.map(label => (<div key={label.name} className="pl-8 border-l-2 ml-2"><div className="flex items-center space-x-3 mb-2"><Tag className="w-4 h-4 text-gray-500" /><h5 className="font-medium">{label.name} <span className="font-normal text-gray-500">({label.taskCount} tasks)</span></h5></div><div className="pl-6 space-y-1 text-sm">{label.categories.map(cat => (<div key={cat.name} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer" onClick={() => openDrawer(`${assignee.name} > ${dept.name} > ${label.name} > ${cat.name}`, cat.tasks)}><div className="flex items-center space-x-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: biCategoryColors[cat.name] }}></span><span>{cat.name}</span></div><span className="text-gray-600">{cat.taskCount} tasks</span></div>))}</div></div>))}</div>))}</div></div>))}</div>)}
            </main>
            
            <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} assigneeColors={assigneeColors} biCategoryColors={biCategoryColors} departmentColors={departmentColors} onUpdateTask={handleUpdateTask} jiraAPI={jiraAPI} isConnected={isConnected} allBiCategories={allBiCategories} />
            <TaskListDrawer isOpen={drawerState.isOpen} onClose={closeDrawer} title={drawerState.title} tasks={drawerState.tasks} onTaskClick={(task) => { setSelectedTask(task); closeDrawer(); }}/>
            <AssigneeChartDrawer isOpen={assigneeChartDrawer.isOpen} onClose={closeAssigneeChartDrawer} assigneeName={assigneeChartDrawer.assigneeName} tasks={assigneeChartDrawer.tasks} departmentColors={departmentColors} biCategoryColors={biCategoryColors} onTaskClick={(task) => { closeAssigneeChartDrawer(); setSelectedTask(task); }}/>
            <LabelChartDrawer isOpen={labelChartDrawer.isOpen} onClose={closeLabelChartDrawer} labelName={labelChartDrawer.labelName} tasks={labelChartDrawer.tasks} biCategoryColors={biCategoryColors} onTaskClick={(task) => { closeLabelChartDrawer(); setSelectedTask(task); }}/>
            <ConfigModal isOpen={showConfig} onClose={() => setShowConfig(false)} jiraConfig={jiraConfig} saveJiraConfig={saveJiraConfig} isConnected={isConnected} />
            <CreateTaskModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                onSubmit={handleCreateTask}
                projectKey={jiraConfig.projectKey}
                // Pass the current user's full object to the modal
                currentUser={currentUser} 
                // Pass the list of assignable users (assuming useJira provides it)
                assignableUsers={projectUsers}
                departmentOptions={allDepartments}
                biCategoryOptions={staticBiCategoriesForCreate}
            />
        </div>
    );
}

export default App;