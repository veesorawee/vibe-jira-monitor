import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, ChevronDown, ChevronUp, Square, Send, XCircle } from 'lucide-react';
import { deriveCurrentAction, LogEntry, MarkdownResult } from '../utils/agentUtils';

const AgentDock = ({ agents, onStop, onRemove, onMarkNotified, onPostResult, onDenyResult }) => {
    const [expandedId, setExpandedId] = useState(null);
    const [showLog, setShowLog] = useState(false);
    const [comment, setComment] = useState('');
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState('');
    const logRef = useRef(null);

    const expandedAgent = agents.find(a => a.id === expandedId);

    // Auto-scroll log
    useEffect(() => {
        if (logRef.current && showLog) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [expandedAgent?.logs?.length, showLog]);

    // Close panel if agent was removed
    useEffect(() => {
        if (expandedId && !agents.find(a => a.id === expandedId)) {
            setExpandedId(null);
        }
    }, [agents, expandedId]);

    // Reset comment when switching agents
    useEffect(() => {
        setComment('');
        setPostError('');
        setPosting(false);
    }, [expandedId]);

    if (agents.length === 0) return null;

    const handleChipClick = (agent) => {
        if (expandedId === agent.id) {
            setExpandedId(null);
        } else {
            setExpandedId(agent.id);
            setShowLog(false);
            if (!agent.notified) onMarkNotified(agent.id);
        }
    };

    const handlePost = async () => {
        if (!expandedAgent) return;
        setPosting(true);
        setPostError('');
        try {
            await onPostResult(expandedAgent.id, comment);
            setComment('');
        } catch (e) {
            setPostError(e.message || 'Failed to post');
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3" style={{ pointerEvents: 'auto' }}>
            {/* Expanded panel */}
            {expandedAgent && (
                <div
                    className="bg-[#0d0d12] border border-[#1a1a2e] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    style={{ width: '440px', maxHeight: '70vh' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-[#0f0f1a] border-b border-[#1a1a2e] flex-shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <Bot size={14} className={
                                expandedAgent.status === 'running' ? 'text-blue-400' :
                                expandedAgent.status === 'done'    ? 'text-green-400' : 'text-red-400'
                            } />
                            <span className="text-xs font-bold text-gray-200">{expandedAgent.task.id}</span>
                            <span className="text-xs text-gray-500 truncate">{expandedAgent.task.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {expandedAgent.status === 'running' && (
                                <button onClick={() => onStop(expandedAgent.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg font-bold hover:bg-red-500/30 transition-colors">
                                    <Square size={10} /> Stop
                                </button>
                            )}
                            <button onClick={() => setExpandedId(null)} className="text-gray-600 hover:text-gray-400 p-1 transition-colors rounded">
                                <ChevronDown size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Status row */}
                    {(() => {
                        const action = deriveCurrentAction(expandedAgent.logs, expandedAgent.status === 'running');
                        if (!action) return null;
                        return (
                            <div className={`flex items-center gap-2 px-4 py-2 border-b border-[#1a1a2e] flex-shrink-0 text-xs font-medium ${
                                action.phase === 'running' ? 'text-blue-300' :
                                action.phase === 'done'    ? 'text-green-300' : 'text-red-300'
                            }`}>
                                {action.phase === 'running' && (
                                    <span className="relative flex-shrink-0 h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400"></span>
                                    </span>
                                )}
                                {action.phase === 'done'  && <span className="text-green-400 flex-shrink-0">✓</span>}
                                {action.phase === 'error' && <span className="text-red-400 flex-shrink-0">✗</span>}
                                <span className="truncate">{action.label}</span>
                                {action.phase === 'done' && expandedAgent.result?.cost != null && (
                                    <span className="ml-auto text-[10px] text-gray-600">${expandedAgent.result.cost.toFixed(4)}</span>
                                )}
                                {action.phase === 'done' && expandedAgent.result?.duration != null && (
                                    <span className="text-[10px] text-gray-600">{(expandedAgent.result.duration / 1000).toFixed(1)}s</span>
                                )}
                            </div>
                        );
                    })()}

                    {/* Scrollable body */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {/* Result box */}
                        {expandedAgent.result && (
                            <div className="p-4 border-b border-[#1a1a2e]">
                                <div className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">Analysis Result</div>
                                <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                                    <MarkdownResult text={expandedAgent.result.text} dark={true} />
                                </div>
                            </div>
                        )}

                        {/* Action section */}
                        {expandedAgent.result && !expandedAgent.posted && !expandedAgent.denied && (
                            <div className="p-4 border-b border-[#1a1a2e] space-y-2.5">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Post to Jira ticket</div>
                                <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder="Add a comment (optional)…"
                                    rows={2}
                                    className="w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded-xl px-3 py-2 text-xs text-gray-300 placeholder-gray-700 outline-none focus:border-blue-500/40 resize-none"
                                />
                                {postError && <p className="text-xs text-red-400">{postError}</p>}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePost}
                                        disabled={posting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 border border-blue-500/40 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={11} /> {posting ? 'Posting…' : 'Post to Jira'}
                                    </button>
                                    <button
                                        onClick={() => onDenyResult(expandedAgent.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#1e1e38] border border-[#2a2a3e] text-gray-400 text-xs font-bold rounded-xl transition-colors"
                                    >
                                        <XCircle size={11} /> Deny
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Posted / denied state */}
                        {expandedAgent.posted && (
                            <div className="px-4 py-3 border-b border-[#1a1a2e] flex items-center gap-2 text-xs text-green-400 font-semibold">
                                <span>✓</span> Posted to Jira ticket
                            </div>
                        )}
                        {expandedAgent.denied && (
                            <div className="px-4 py-3 border-b border-[#1a1a2e] flex items-center gap-2 text-xs text-gray-600 font-semibold">
                                <XCircle size={12} /> Dismissed
                            </div>
                        )}

                        {/* Log toggle */}
                        <div>
                            <button
                                onClick={() => setShowLog(s => !s)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                            >
                                {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {showLog ? 'Hide' : 'Show'} activity log
                                <span className="ml-auto text-[10px] text-gray-700">{expandedAgent.logs.length} events</span>
                            </button>
                            {showLog && (
                                <div ref={logRef} className="p-3 font-mono space-y-2 overflow-y-auto" style={{ maxHeight: '180px' }}>
                                    {expandedAgent.logs.map((log, i) => <LogEntry key={i} log={log} />)}
                                    {expandedAgent.status === 'running' && (
                                        <span className="inline-block text-blue-400 text-sm animate-pulse">▋</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Chips */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
                {agents.map(agent => {
                    const isRunning  = agent.status === 'running';
                    const isDone     = agent.status === 'done';
                    const isExpanded = expandedId === agent.id;
                    const hasNew     = !agent.notified && !isRunning;

                    return (
                        <div key={agent.id} className="flex items-center gap-1">
                            <button
                                onClick={() => handleChipClick(agent)}
                                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-lg ${
                                    isExpanded ? 'ring-2 ring-offset-1 ring-offset-[#0d0d12]' : ''
                                } ${
                                    isRunning ? 'bg-blue-500/20 border-blue-500/40 text-blue-200 ring-blue-500' :
                                    isDone    ? 'bg-green-500/20 border-green-500/40 text-green-200 ring-green-500' :
                                               'bg-red-500/20 border-red-500/40 text-red-200 ring-red-500'
                                }`}
                            >
                                {isRunning && (
                                    <span className="relative flex-shrink-0 h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                                    </span>
                                )}
                                {!isRunning && isDone  && <span className="text-green-400">✓</span>}
                                {!isRunning && !isDone && <span className="text-red-400">✗</span>}
                                <span>{agent.task.id}</span>
                                {agent.posted && <span className="text-[9px] font-normal text-green-500 opacity-80">posted</span>}
                                {hasNew && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400 border-2 border-[#0d0d12] animate-pulse"></span>
                                )}
                            </button>
                            {!isRunning && (
                                <button onClick={() => onRemove(agent.id)} className="text-gray-700 hover:text-gray-400 transition-colors p-1 rounded" title="Dismiss">
                                    <X size={11} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgentDock;
