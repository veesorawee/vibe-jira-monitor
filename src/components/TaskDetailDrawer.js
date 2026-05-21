import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, User, History, ExternalLink, Bot, Play, Square, Send, XCircle } from 'lucide-react';
import Badge from './Badge';
import { parseDate } from '../utils/helpers';
import { deriveCurrentAction, LogEntry, MarkdownResult } from '../utils/agentUtils';

const TaskDetailDrawer = ({
    task, onClose, assigneeColors, biCategoryColors, departmentColors,
    onUpdateTask, jiraAPI, isConnected, assignableUsers = [], currentUser = null,
    openAssigneeDrawer,
    onRunAgent, agents = [], onStopAgent, onPostResult, onDenyResult,
}) => {
    const [activeTab, setActiveTab] = useState('details');
    const [transitions, setTransitions] = useState([]);
    const [selectedTransitionId, setSelectedTransitionId] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [newPriority, setNewPriority] = useState(null);
    const [newBiCategory, setNewBiCategory] = useState(null);
    const [newAssigneeId, setNewAssigneeId] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');

    const terminalRef = useRef(null);
    const [resultComment, setResultComment] = useState('');
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState('');
    const priorities = ['Highest', 'High', 'Medium', 'Low'];

    // Agents scoped to the current task
    const taskAgents = agents.filter(a => a.taskId === task?.id);
    const latestAgent = taskAgents[taskAgents.length - 1];
    const isTaskAgentRunning = !!latestAgent && latestAgent.status === 'running';

    useEffect(() => {
        if (task) {
            setActiveTab('details');
            setSelectedTransitionId(null);
            setNewComment('');
            setError('');
            setNewPriority(null);
            setNewBiCategory(null);
            setNewAssigneeId(null);
        }
    }, [task]);

    useEffect(() => {
        if (activeTab === 'actions' && task && jiraAPI && isConnected) {
            const fetchTransitions = async () => {
                try {
                    const response = await jiraAPI.getTransitions(task.id);
                    setTransitions(response.transitions || []);
                } catch (err) {
                    setError('Could not load actions.');
                }
            };
            fetchTransitions();
        }
    }, [activeTab, task, jiraAPI, isConnected]);

    useEffect(() => {
        setResultComment('');
        setPostError('');
        setPosting(false);
    }, [latestAgent?.id]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [latestAgent?.logs?.length]);

    const handleUpdate = async () => {
        if (!task) return;
        setError(''); setIsUpdating(true);
        try {
            await onUpdateTask(task.id, {
                statusId: selectedTransitionId,
                comment: newComment.trim() || null,
                priority: newPriority,
                biCategory: newBiCategory,
                assigneeId: newAssigneeId
            });
            setNewComment(''); setNewPriority(null); setNewBiCategory(null); setNewAssigneeId(null);
            onClose();
        } catch (err) {
            setError(`Update failed: ${err.message}`);
        } finally {
            setIsUpdating(false);
        }
    };

    const [currentActivityFilter, setCurrentActivityFilter] = useState('all');

    const activityFeed = useMemo(() => {
        if (!task) return [];
        const historyItems = (task.fullChangeHistory || []).map(item => ({
            type: 'history', created: new Date(item.created), author: item.author, data: item.changes
        }));
        const commentItems = (task.comments || []).map(item => ({
            type: 'comment', created: new Date(item.createdTimestamp), displayDate: item.created, author: item.author, data: item.body
        }));
        const combined = [...historyItems, ...commentItems].sort((a, b) => b.created.getTime() - a.created.getTime());
        if (currentActivityFilter === 'history') return combined.filter(item => item.type === 'history');
        if (currentActivityFilter === 'comments') return combined.filter(item => item.type === 'comment');
        return combined;
    }, [task, currentActivityFilter]);

    const canUpdate = !isUpdating && isConnected && (!!selectedTransitionId || newComment.trim() !== '' || !!newPriority || !!newBiCategory || !!newAssigneeId);

    const formatDisplayDate = (dateString, includeTime = false) => {
        if (!dateString) return '–';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const options = { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' };
        if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; options.hour12 = false; }
        return date.toLocaleString('en-GB', options).replace(',', '');
    };

    return (
        <div className={`fixed inset-0 z-[110] transition-opacity ${!!task ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${!!task ? 'bg-opacity-60 backdrop-blur-sm' : 'bg-opacity-0'}`} onClick={onClose}></div>

            <div className={`fixed top-0 right-0 h-full bg-[color:var(--surface)] text-[color:var(--text)] border-l border-[color:var(--border)] w-full max-w-2xl shadow-2xl transition-transform transform ease-in-out duration-300 flex flex-col ${!!task ? 'translate-x-0' : 'translate-x-full'}`}>
                {task && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-[color:var(--border)] flex-shrink-0 bg-[color:var(--surface2)]">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-[color:var(--muted)]">{task.id}</h3>
                                <a href={`https://linemanwongnai.atlassian.net/browse/${task.id}`} target="_blank" rel="noopener noreferrer" title="Open in Jira" className="text-[color:var(--accent3)] hover:opacity-80 transition-opacity p-2 bg-[color:var(--surface)] rounded-lg border border-[color:var(--border)] shadow-sm">
                                    <ExternalLink size={16} />
                                </a>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-1 bg-[color:var(--surface)] border border-[color:var(--border)] p-1 rounded-xl">
                                    <button onClick={() => setActiveTab('details')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeTab === 'details' ? 'bg-[color:var(--accent)] text-[color:var(--bg)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>Details</button>
                                    <button onClick={() => setActiveTab('actions')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeTab === 'actions' ? 'bg-[color:var(--accent)] text-[color:var(--bg)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>Actions</button>
                                    <button onClick={() => setActiveTab('run')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'run' ? 'bg-[color:var(--accent3)] text-[color:var(--bg)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>
                                        <Bot size={13} />Run
                                        {isTaskAgentRunning && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>}
                                    </button>
                                </div>
                                <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--accent2)] bg-[color:var(--surface)] border border-[color:var(--border)] rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="p-6 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
                            <h2 className="text-2xl font-bold text-[color:var(--text)] leading-snug font-syne">{task.title}</h2>
                        </div>

                        <div className="p-6 space-y-8 overflow-y-auto bg-[color:var(--bg)]">
                            {activeTab === 'details' && (
                                <>
                                    <div className="flex items-center flex-wrap gap-2 mb-2">
                                        <Badge type="priority" task={task} />
                                        <Badge type="timeliness" task={task} />
                                        <Badge type="status" task={task} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-y-6 gap-x-6 text-sm bg-[color:var(--surface)] p-5 rounded-2xl border border-[color:var(--border)] shadow-sm">
                                        <div>
                                            <span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider block mb-1.5">Assignee</span>
                                            <p
                                                className="font-semibold flex items-center gap-2 cursor-pointer hover:underline decoration-2 underline-offset-4"
                                                onClick={() => openAssigneeDrawer && openAssigneeDrawer(task.assignee)}
                                                style={{ textDecorationColor: assigneeColors[task.assignee] || 'var(--muted)' }}
                                            >
                                                <span className="w-3 h-3 rounded-full shadow-inner" style={{backgroundColor: assigneeColors[task.assignee] || '#ccc'}}></span>
                                                {task.assignee}
                                            </p>
                                        </div>
                                        <div><span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider block mb-1.5">BI Category</span><p className="font-semibold flex items-center gap-2"><span className="w-3 h-3 rounded-full shadow-inner" style={{backgroundColor: biCategoryColors[task.biCategory] || '#ccc'}}></span>{task.biCategory || 'Uncategorized'}</p></div>
                                        <div><span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider block mb-1.5">Department</span><p className="font-semibold flex items-center gap-2"><span className="w-3 h-3 rounded-full shadow-inner" style={{backgroundColor: departmentColors[task.department] || '#ccc'}}></span>{task.department || 'Unknown'}</p></div>

                                        <div><span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider block mb-1.5">Start Date</span><p className="font-semibold text-[color:var(--text)]">{formatDisplayDate(task.created || task.startDate, false)}</p></div>
                                        <div><span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider block mb-1.5">Due Date</span><p className={`font-semibold ${task.dueDate && !task.resolutiondate && (new Date().setHours(0,0,0,0) > parseDate(task.dueDate)) ? 'text-[color:var(--accent2)]' : 'text-[color:var(--text)]'}`}>{formatDisplayDate(task.dueDate, false)}</p></div>
                                        <div><span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider block mb-1.5">Resolved</span><p className="font-semibold text-[color:var(--text)]">{formatDisplayDate(task.resolutiondate, true)}</p></div>

                                        <div className="col-span-3 border-t border-[color:var(--border)] pt-4 mt-2">
                                            <span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider block mb-1.5">Last Update</span>
                                            <p className="font-semibold text-[color:var(--text)]">{formatDisplayDate(task.lastUpdated, true)}</p>
                                        </div>
                                    </div>

                                    {task.labels && task.labels.length > 0 && <div><span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider mb-2 block">Labels</span><div className="flex flex-wrap gap-2">{task.labels.map(label => (<span key={label} className="px-3 py-1 text-xs font-bold rounded-lg bg-[color:var(--surface2)] border border-[color:var(--border)] text-[color:var(--text)]">{label}</span>))}</div></div>}

                                    {(task.slackLink || (task.figmaLinks && task.figmaLinks.length > 0)) && (
                                        <div>
                                            <span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider mb-2 block">Related Links</span>
                                            <div className="flex flex-row flex-wrap gap-3">
                                                {task.slackLink && (<a href={task.slackLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl hover:bg-purple-500/20 text-sm font-bold transition-colors">💬 Open in Slack</a>)}
                                                {task.figmaLinks && task.figmaLinks.map((link, index) => (<a key={index} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-xl hover:bg-pink-500/20 text-sm font-bold transition-colors">🎨 {link.text || `Figma File #${index + 1}`}</a>))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <span className="text-[color:var(--muted)] font-bold text-xs uppercase tracking-wider mb-2 block">Description</span>
                                        <div className="text-[color:var(--text)] bg-[color:var(--surface)] p-5 rounded-2xl border border-[color:var(--border)] text-sm max-w-none break-words leading-relaxed shadow-sm" dangerouslySetInnerHTML={{__html: task.description || '<p class="opacity-50 italic">No description available.</p>'}} />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-4 mt-8 border-t border-[color:var(--border)] pt-8">
                                            <h5 className="text-[color:var(--text)] font-bold text-lg flex items-center font-syne"><History className="w-5 h-5 mr-2 text-[color:var(--accent)]" />Activity Feed</h5>
                                            <div className="flex items-center space-x-1 bg-[color:var(--surface2)] border border-[color:var(--border)] p-1 rounded-xl text-xs font-bold">
                                                <button onClick={() => setCurrentActivityFilter('all')} className={`px-3 py-1.5 rounded-lg transition-colors ${currentActivityFilter === 'all' ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>All</button>
                                                <button onClick={() => setCurrentActivityFilter('history')} className={`px-3 py-1.5 rounded-lg transition-colors ${currentActivityFilter === 'history' ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>History</button>
                                                <button onClick={() => setCurrentActivityFilter('comments')} className={`px-3 py-1.5 rounded-lg transition-colors ${currentActivityFilter === 'comments' ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>Comments</button>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {activityFeed.map((item, index) => (
                                                <div key={index} className="flex space-x-4 text-sm bg-[color:var(--surface)] p-4 rounded-2xl border border-[color:var(--border)] shadow-sm">
                                                    <div className="w-8 h-8 rounded-full bg-[color:var(--surface2)] flex items-center justify-center flex-shrink-0 text-[color:var(--muted)] border border-[color:var(--border)]"><User size={16} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <p className="font-bold text-[color:var(--text)]">{item.author}</p>
                                                            <p className="text-xs text-[color:var(--muted)] font-medium">{item.displayDate || formatDisplayDate(item.created, true)}</p>
                                                        </div>
                                                        {item.type === 'history' ? (
                                                            <div className="bg-[color:var(--bg)] border border-[color:var(--border)] rounded-xl p-3 space-y-1.5">
                                                                {item.data.map((change, idx) => (
                                                                    <div key={idx} className="text-xs text-[color:var(--text)]">
                                                                        <span className="font-bold text-[color:var(--muted)] capitalize">{change.field}: </span>
                                                                        {change.from && <span className="line-through text-[color:var(--muted)] opacity-60">{change.from}</span>}
                                                                        <span className="mx-2 text-[color:var(--accent)]">→</span>
                                                                        <span className="font-bold">{change.to}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[color:var(--text)] bg-[color:var(--accent3)]/10 border border-[color:var(--accent3)]/20 p-4 rounded-xl text-sm max-w-none break-words" dangerouslySetInnerHTML={{__html: item.data}} />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'actions' && (
                                <div className="space-y-8 bg-[color:var(--surface)] p-6 rounded-2xl border border-[color:var(--border)] shadow-sm">

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-3">
                                            Change Assignee <span className="lowercase normal-case font-normal">(current: {task.assignee})</span>
                                        </label>
                                        <select
                                            value={newAssigneeId || ''}
                                            onChange={e => setNewAssigneeId(e.target.value || null)}
                                            className={`w-full p-3 border rounded-xl outline-none transition-colors appearance-none cursor-pointer font-medium ${newAssigneeId ? 'border-[color:var(--accent)] bg-[color:var(--surface)] text-[color:var(--text)]' : 'border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)]'}`}
                                        >
                                            <option value="">-- Keep Current Assignee --</option>
                                            {assignableUsers && assignableUsers.map(user => (
                                                <option key={user.accountId} value={user.accountId}>{user.displayName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-3">Change Status</label>
                                        <div className="flex flex-wrap gap-2">
                                            {transitions.map(trans => (
                                                <button key={trans.id}
                                                    onClick={() => setSelectedTransitionId(prevId => prevId === trans.id ? null : trans.id)}
                                                    className={`px-4 py-2 text-sm font-bold rounded-xl border transition-all ${selectedTransitionId === trans.id ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--bg)]' : 'border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)] hover:border-[color:var(--muted)]'}`}
                                                >
                                                    {trans.name}
                                                </button>
                                            ))}
                                            {(transitions.length === 0 && !error) && <p className="text-sm text-[color:var(--muted)] italic">No available transitions.</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-3">Change Priority <span className="lowercase normal-case font-normal">(current: {task.priority})</span></label>
                                        <div className="flex flex-wrap gap-2">
                                            {priorities.map(p => (
                                                <button key={p}
                                                    onClick={() => setNewPriority(prev => prev === p ? null : p)}
                                                    disabled={p === task.priority}
                                                    className={`px-4 py-2 text-sm font-bold rounded-xl border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${newPriority === p ? 'border-[color:var(--accent3)] bg-[color:var(--accent3)] text-[color:var(--bg)]' : 'border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)] hover:border-[color:var(--muted)]'}`}>
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-3">Add Comment (Optional)</label>
                                        <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows="5" className="w-full p-4 border border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl focus:border-[color:var(--accent)] outline-none transition-colors placeholder:text-[color:var(--muted)]" placeholder="Write your comment here..."></textarea>
                                    </div>

                                    {error && <div className="text-[color:var(--accent2)] bg-[color:var(--alert-bg)] border border-[color:var(--alert-border)] p-4 rounded-xl text-sm font-bold">{error}</div>}

                                    <div className="border-t border-[color:var(--border)] pt-6">
                                        <button onClick={handleUpdate} disabled={!canUpdate} className="w-full bg-[color:var(--accent)] text-[color:var(--bg)] font-black text-lg px-6 py-4 rounded-xl hover:opacity-80 transition-opacity disabled:bg-[color:var(--surface2)] disabled:text-[color:var(--muted)] disabled:border disabled:border-[color:var(--border)] disabled:cursor-not-allowed">
                                            {isUpdating ? 'Updating...' : 'Confirm Update'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'run' && (() => {
                                const action = latestAgent
                                    ? deriveCurrentAction(latestAgent.logs, latestAgent.status === 'running')
                                    : null;

                                return (
                                    <div className="space-y-3">
                                        {/* Header */}
                                        <div className="flex items-center justify-between bg-[color:var(--surface)] p-4 rounded-2xl border border-[color:var(--border)] shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[color:var(--accent3)]/10 border border-[color:var(--accent3)]/30 flex items-center justify-center">
                                                    <Bot size={18} className="text-[color:var(--accent3)]" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-[color:var(--text)]">Claude Code Runner</p>
                                                    <p className="text-xs text-[color:var(--muted)]">Analyze requirements &amp; execute data queries</p>
                                                </div>
                                            </div>
                                            {isTaskAgentRunning ? (
                                                <button onClick={() => onStopAgent(latestAgent.id)} className="flex items-center gap-2 px-4 py-2 bg-[color:var(--accent2)] text-white font-bold text-sm rounded-xl hover:opacity-80 transition-opacity shadow">
                                                    <Square size={13} /> Stop
                                                </button>
                                            ) : (
                                                <button onClick={() => onRunAgent(task)} className="flex items-center gap-2 px-4 py-2 bg-[color:var(--accent3)] text-[color:var(--bg)] font-bold text-sm rounded-xl hover:opacity-80 transition-opacity shadow">
                                                    <Play size={13} />
                                                    {latestAgent ? 'Re-run' : 'Run Analysis'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Live status banner */}
                                        {action && (
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                                                action.phase === 'running' ? 'bg-blue-500/8 border-blue-500/20 text-blue-300' :
                                                action.phase === 'done'    ? 'bg-green-500/8 border-green-500/20 text-green-300' :
                                                                            'bg-red-500/8 border-red-500/20 text-red-300'
                                            }`}>
                                                {action.phase === 'running' && (
                                                    <span className="relative flex-shrink-0 flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400"></span>
                                                    </span>
                                                )}
                                                {action.phase === 'done'  && <span className="text-green-400 flex-shrink-0">✓</span>}
                                                {action.phase === 'error' && <span className="text-red-400 flex-shrink-0">✗</span>}
                                                <span className="truncate">{action.label}</span>
                                                {action.phase === 'done' && latestAgent.result?.cost != null && (
                                                    <span className="ml-auto text-xs font-normal opacity-60 flex-shrink-0">${latestAgent.result.cost.toFixed(4)}</span>
                                                )}
                                                {action.phase === 'done' && latestAgent.result?.duration != null && (
                                                    <span className="text-xs font-normal opacity-60 flex-shrink-0">{(latestAgent.result.duration / 1000).toFixed(1)}s</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Result box + actions */}
                                        {latestAgent?.result && (
                                            <div className="bg-[color:var(--surface)] border border-green-500/20 rounded-2xl overflow-hidden">
                                                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/5 border-b border-green-500/15">
                                                    <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Analysis Result</span>
                                                </div>
                                                <div className="p-4 overflow-y-auto" style={{ maxHeight: '260px' }}>
                                                    <MarkdownResult text={latestAgent.result.text || 'Completed with no output.'} dark={false} />
                                                </div>

                                                {/* Action bar */}
                                                {!latestAgent.posted && !latestAgent.denied && (
                                                    <div className="px-4 pb-4 pt-2 border-t border-green-500/10 space-y-2.5">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">Post to Jira ticket</p>
                                                        <textarea
                                                            value={resultComment}
                                                            onChange={e => setResultComment(e.target.value)}
                                                            placeholder="Add a comment (optional)…"
                                                            rows={2}
                                                            className="w-full bg-[color:var(--surface2)] border border-[color:var(--border)] rounded-xl px-3 py-2 text-xs text-[color:var(--text)] placeholder-[color:var(--muted)] outline-none focus:border-[color:var(--accent3)] resize-none transition-colors"
                                                        />
                                                        {postError && <p className="text-xs text-[color:var(--accent2)]">{postError}</p>}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={async () => {
                                                                    setPosting(true); setPostError('');
                                                                    try { await onPostResult(latestAgent.id, resultComment); setResultComment(''); }
                                                                    catch (e) { setPostError(e.message || 'Failed to post'); }
                                                                    finally { setPosting(false); }
                                                                }}
                                                                disabled={posting}
                                                                className="flex items-center gap-1.5 px-4 py-2 bg-[color:var(--accent3)] text-[color:var(--bg)] text-xs font-bold rounded-xl hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                            >
                                                                <Send size={12} /> {posting ? 'Posting…' : 'Post to Jira'}
                                                            </button>
                                                            <button
                                                                onClick={() => onDenyResult(latestAgent.id)}
                                                                className="flex items-center gap-1.5 px-4 py-2 bg-[color:var(--surface2)] border border-[color:var(--border)] text-[color:var(--muted)] text-xs font-bold rounded-xl hover:text-[color:var(--text)] transition-colors"
                                                            >
                                                                <XCircle size={12} /> Deny
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {latestAgent.posted && (
                                                    <div className="px-4 py-3 border-t border-green-500/10 flex items-center gap-2 text-xs text-green-500 font-semibold">
                                                        <span>✓</span> Posted to Jira ticket
                                                    </div>
                                                )}
                                                {latestAgent.denied && (
                                                    <div className="px-4 py-3 border-t border-[color:var(--border)] flex items-center gap-2 text-xs text-[color:var(--muted)] font-semibold">
                                                        <XCircle size={12} /> Dismissed
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Empty state */}
                                        {!latestAgent && (
                                            <div className="text-center py-14 text-[color:var(--muted)]">
                                                <Bot size={36} className="mx-auto mb-3 opacity-15" />
                                                <p className="text-sm font-medium">Click "Run Analysis" to start</p>
                                                <p className="text-xs mt-1 opacity-60">Claude will read the task and decide whether to run SQL or write an analysis</p>
                                            </div>
                                        )}

                                        {/* Terminal */}
                                        {latestAgent && latestAgent.logs.length > 0 && (
                                            <div className="bg-[#0a0a0f] rounded-2xl border border-[#1a1a2e] overflow-hidden">
                                                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0f0f1a] border-b border-[#1a1a2e]">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></div>
                                                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></div>
                                                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></div>
                                                    <span className="ml-2 text-[#3a3a5a] text-xs font-mono">{task.id}</span>
                                                    {isTaskAgentRunning && (
                                                        <span className="ml-auto text-[#3a3a5a] text-xs font-mono animate-pulse">running…</span>
                                                    )}
                                                </div>
                                                <div
                                                    ref={terminalRef}
                                                    className="p-4 font-mono space-y-3 overflow-y-auto"
                                                    style={{ maxHeight: '52vh' }}
                                                >
                                                    {latestAgent.logs.map((log, i) => (
                                                        <LogEntry key={i} log={log} />
                                                    ))}
                                                    {isTaskAgentRunning && (
                                                        <span className="inline-block text-[color:var(--accent3)] text-sm animate-pulse">▋</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default React.memo(TaskDetailDrawer);
