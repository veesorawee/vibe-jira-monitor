import React, { useState, useEffect, useMemo } from 'react';
import { X, User, History, MessageSquare } from 'lucide-react';
import Badge from './Badge';
import { parseDate } from '../utils/helpers';

const TaskDetailDrawer = ({ task, onClose, assigneeColors, biCategoryColors, departmentColors, onUpdateTask, jiraAPI, isConnected, allBiCategories = [] }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [transitions, setTransitions] = useState([]);
    const [selectedTransitionId, setSelectedTransitionId] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [newPriority, setNewPriority] = useState(null);
    const [newBiCategory, setNewBiCategory] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');

    const priorities = ['Highest', 'High', 'Medium', 'Low'];

    useEffect(() => {
        if (task) {
            setActiveTab('details');
            setSelectedTransitionId(null);
            setNewComment('');
            setError('');
            setNewPriority(null);
            setNewBiCategory(null);
        }
    }, [task]);

    useEffect(() => {
        if (activeTab === 'actions' && task && jiraAPI && isConnected) {
            const fetchTransitions = async () => {
                try {
                    const response = await jiraAPI.getTransitions(task.id);
                    setTransitions(response.transitions || []);
                } catch (err) {
                    console.error("Failed to fetch transitions:", err);
                    setError('Could not load actions.');
                }
            };
            fetchTransitions();
        }
    }, [activeTab, task, jiraAPI, isConnected]);
    
    const handleUpdate = async () => {
        if (!task) return;
        setError('');
        setIsUpdating(true);
        try {
            await onUpdateTask(task.id, {
                statusId: selectedTransitionId,
                comment: newComment.trim() || null,
                priority: newPriority,
                biCategory: newBiCategory,
            });
            setNewComment('');
            setNewPriority(null);
            setNewBiCategory(null);
            onClose();
        } catch (err) {
            setError(`Update failed: ${err.message}`);
        } finally {
            setIsUpdating(false);
        }
    };

    const [activityFilter, setActivityFilter] = useState('all');

    const activityFeed = useMemo(() => {
        if (!task) return [];
        const historyItems = (task.fullChangeHistory || []).map(item => ({
            type: 'history',
            created: new Date(item.created),
            author: item.author,
            data: item.changes
        }));
        const commentItems = (task.comments || []).map(item => ({
            type: 'comment',
            created: new Date(item.createdTimestamp),
            displayDate: item.created,
            author: item.author,
            data: item.body
        }));
        const combined = [...historyItems, ...commentItems].sort((a, b) => b.created.getTime() - a.created.getTime());
        if (activityFilter === 'history') {
            return combined.filter(item => item.type === 'history');
        }
        if (activityFilter === 'comments') {
            return combined.filter(item => item.type === 'comment');
        }
        return combined;
    }, [task, activityFilter]);

    const canUpdate = !isUpdating && isConnected && (!!selectedTransitionId || newComment.trim() !== '' || !!newPriority || !!newBiCategory);

    return (
        <div className={`fixed inset-0 z-50 transition-opacity ${!!task ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${!!task ? 'bg-opacity-50' : 'bg-opacity-0'}`} onClick={onClose}></div>
            
            <div className={`fixed top-0 right-0 h-full bg-white w-full max-w-2xl shadow-xl transition-transform transform ease-in-out duration-300 flex flex-col ${!!task ? 'translate-x-0' : 'translate-x-full'}`}>
                {task && (
                    <>
                        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-gray-600">{task.id}</h3>
                                <a href={`https://linemanwongnai.atlassian.net/browse/${task.id}`} target="_blank" rel="noopener noreferrer" title="Open in Jira" className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                </a>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-full">
                                    <button onClick={() => setActiveTab('details')} className={`px-3 py-1 rounded-full text-sm font-medium ${activeTab === 'details' ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>Details</button>
                                    <button onClick={() => setActiveTab('actions')} className={`px-3 py-1 rounded-full text-sm font-medium ${activeTab === 'actions' ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>Actions</button>
                                </div>
                                <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="p-4 border-b bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                            {activeTab === 'details' && (
                                <>
                                    <div className="flex items-center flex-wrap gap-2 mb-4">
                                        <Badge type="priority" task={task} />
                                        <Badge type="timeliness" task={task} />
                                        <Badge type="status" task={task} />
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-y-6 gap-x-6 text-sm">
                                        <div><span className="text-gray-500 block">Assignee</span><p className="font-medium flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: assigneeColors[task.assignee]}}></span>{task.assignee}</p></div>
                                        <div><span className="text-gray-500 block">BI Category</span><p className="font-medium flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: biCategoryColors[task.biCategory]}}></span>{task.biCategory}</p></div>
                                        <div><span className="text-gray-500 block">Department</span><p className="font-medium flex items-center gap-2 mt-1"><span className="w-3 h-3 rounded-full" style={{backgroundColor: departmentColors[task.department]}}></span>{task.department}</p></div>
                                        
                                        <div><span className="text-gray-500 block">Start Date</span><p className="font-medium mt-1">{task.startDate || '–'}</p></div>
                                        <div><span className="text-gray-500 block">Due Date</span><p className={`font-medium mt-1 ${task.dueDate && !task.resolutiondate && (new Date() > parseDate(task.dueDate)) ? 'text-red-600' : ''}`}>{task.dueDate || '–'}</p></div>
                                        <div><span className="text-gray-500 block">Resolution Date</span><p className="font-medium mt-1">{task.resolutiondate || '–'}</p></div>
                                        
                                        <div><span className="text-gray-500 block">Story Points</span><p className="font-medium mt-1">{task.storyPoints || 0}</p></div>
                                        <div className="col-span-2"><span className="text-gray-500 block">Last Update</span><p className="font-medium mt-1">{new Date(task.lastUpdated).toLocaleString('th-TH')}</p></div>
                                    </div>

                                    {task.labels && task.labels.length > 0 && <div><span className="text-gray-500 text-sm">Labels</span><div className="flex flex-wrap gap-2 mt-2">{task.labels.map(label => (<span key={label} className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-800">{label}</span>))}</div></div>}
                                    
                                    {(task.slackLink || (task.figmaLinks && task.figmaLinks.length > 0)) && (
                                        <div>
                                            <span className="text-gray-500 text-sm">Related Links</span>
                                            <div className="mt-2 flex flex-row flex-wrap gap-2">
                                                {task.slackLink && (<a href={task.slackLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium">💬 Open in Slack</a>)}
                                                {task.figmaLinks && task.figmaLinks.map((link, index) => (<a key={index} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 text-sm font-medium">🎨 {link.text || `Figma File #${index + 1}`}</a>))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <span className="text-gray-500 text-sm">Description</span>
                                        <div className="mt-2 text-gray-800 bg-gray-50 p-3 rounded-md border prose prose-sm max-w-none break-words" dangerouslySetInnerHTML={{__html: task.description || '<p>No description available.</p>'}} />
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <h5 className="text-gray-500 text-sm flex items-center"><History className="w-4 h-4 mr-2" />Activity Feed</h5>
                                            <div className="flex items-center space-x-1 bg-gray-200 p-1 rounded-full text-xs">
                                                <button onClick={() => setActivityFilter('all')} className={`px-2 py-0.5 rounded-full ${activityFilter === 'all' ? 'bg-white shadow' : ''}`}>All</button>
                                                <button onClick={() => setActivityFilter('history')} className={`px-2 py-0.5 rounded-full ${activityFilter === 'history' ? 'bg-white shadow' : ''}`}>History</button>
                                                <button onClick={() => setActivityFilter('comments')} className={`px-2 py-0.5 rounded-full ${activityFilter === 'comments' ? 'bg-white shadow' : ''}`}>Comments</button>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {activityFeed.map((item, index) => (
                                                <div key={index} className="flex space-x-3 text-sm">
                                                    <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2">
                                                            <p className="font-medium">{item.author}</p>
                                                            <p className="text-xs text-gray-500">{item.displayDate || item.created.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                        </div>
                                                        {item.type === 'history' ? (
                                                            <div className="mt-1 bg-gray-50 border rounded-lg p-2 space-y-1">
                                                                {item.data.map((change, idx) => (
                                                                    <div key={idx} className="text-xs text-gray-600">
                                                                        <span className="font-semibold capitalize">{change.field}: </span>
                                                                        {change.from && <span className="line-through text-gray-400">{change.from}</span>}
                                                                        <span className="mx-1">→</span>
                                                                        <span className="font-semibold text-gray-800">{change.to}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1 text-gray-800 bg-blue-50 border-l-2 border-blue-200 p-3 rounded-r-lg prose prose-sm max-w-none break-words" dangerouslySetInnerHTML={{__html: item.data}} />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {activeTab === 'actions' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Change Status</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {transitions.map(trans => (
                                                <button key={trans.id} 
                                                    // EDITED: Added deselect logic
                                                    onClick={() => setSelectedTransitionId(prevId => prevId === trans.id ? null : trans.id)}
                                                    className={`px-3 py-1 text-sm rounded-full border-2 ${selectedTransitionId === trans.id ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-gray-100 hover:bg-gray-200'}`}
                                                >
                                                    {trans.name}
                                                </button>
                                            ))}
                                            {(transitions.length === 0 && !error) && <p className="text-sm text-gray-500 mt-2">No available transitions.</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Change Priority (current: {task.priority})</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {priorities.map(p => (
                                                <button key={p} 
                                                    // EDITED: Added deselect logic
                                                    onClick={() => setNewPriority(prev => prev === p ? null : p)} 
                                                    disabled={p === task.priority} className={`px-3 py-1 text-sm rounded-full border-2 ${newPriority === p ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-gray-100 hover:bg-gray-200 disabled:opacity-50'}`}>
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Change BI Category (current: {task.biCategory})</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {allBiCategories.map(cat => (
                                                <button key={cat} 
                                                    // EDITED: Added deselect logic
                                                    onClick={() => setNewBiCategory(prev => prev === cat ? null : cat)} 
                                                    disabled={cat === task.biCategory} className={`px-3 py-1 text-sm rounded-full border-2 ${newBiCategory === cat ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-gray-100 hover:bg-gray-200 disabled:opacity-50'}`}>
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="comment" className="block text-sm font-medium text-gray-700">Add Comment (Optional)</label>
                                        <textarea id="comment" value={newComment} onChange={e => setNewComment(e.target.value)} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"></textarea>
                                    </div>
                                    
                                    {error && <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm">{error}</div>}

                                    <div className="mt-6 border-t pt-6">
                                        <button onClick={handleUpdate} disabled={!canUpdate} className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                            {isUpdating ? 'Updating...' : 'Update Task'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TaskDetailDrawer;