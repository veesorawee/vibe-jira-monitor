import { useState, useRef, useCallback } from 'react';
import { CLAUDE_API, HISTORY_API, deriveAgentStatus, extractResult } from '../utils/agentUtils';

const saveHistory = (task, result) => {
    fetch(HISTORY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, result }),
    }).catch(err => console.warn('[History] Failed to save:', err.message));
};

const useAgents = () => {
    const [agents, setAgents] = useState([]);
    const abortRefs = useRef({});
    const logsRef   = useRef({}); // mirrors log arrays synchronously so finally can read them

    const runAgent = useCallback(async (task) => {
        const id = `${task.id}-${Date.now()}`;

        logsRef.current[id] = [];

        setAgents(prev => [...prev, {
            id,
            taskId: task.id,
            task,
            logs: [],
            status: 'running',
            result: null,
            notified: true,
            posted: false,
            denied: false,
            startedAt: Date.now(),
        }]);

        const abortController = new AbortController();
        abortRefs.current[id] = abortController;

        try {
            const response = await fetch(CLAUDE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task }),
                signal: abortController.signal,
            });

            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    for (const line of part.split('\n')) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                // Keep logsRef in sync so finally can read without waiting for state
                                logsRef.current[id] = [...(logsRef.current[id] || []), data];
                                setAgents(prev => prev.map(a => {
                                    if (a.id !== id) return a;
                                    const newLogs = [...a.logs, data];
                                    const newStatus = deriveAgentStatus(newLogs);
                                    const result = newStatus !== 'running' ? extractResult(newLogs) : a.result;
                                    const notified = (a.status === 'running' && newStatus !== 'running') ? false : a.notified;
                                    return { ...a, logs: newLogs, status: newStatus, result, notified };
                                }));
                            } catch {}
                        }
                    }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setAgents(prev => prev.map(a => {
                    if (a.id !== id) return a;
                    return {
                        ...a,
                        logs: [...a.logs, { type: 'error', text: err.message }],
                        status: 'error',
                        notified: false,
                    };
                }));
            }
        } finally {
            delete abortRefs.current[id];

            // Save history if agent completed successfully
            const finalLogs = logsRef.current[id] || [];
            delete logsRef.current[id];
            const finalResult = extractResult(finalLogs);
            if (finalResult) {
                saveHistory(task, finalResult);
            }

            setAgents(prev => prev.map(a => {
                if (a.id !== id || a.status !== 'running') return a;
                return { ...a, status: 'error', notified: false };
            }));
        }
    }, []);

    const stopAgent = useCallback((id) => {
        const ctrl = abortRefs.current[id];
        if (ctrl) {
            ctrl.abort();
            delete abortRefs.current[id];
        }
        setAgents(prev => prev.map(a => a.id !== id ? a : {
            ...a,
            logs: [...a.logs, { type: 'error', text: 'Stopped by user.' }],
            status: 'error',
            notified: false,
        }));
    }, []);

    const removeAgent = useCallback((id) => {
        const ctrl = abortRefs.current[id];
        if (ctrl) {
            ctrl.abort();
            delete abortRefs.current[id];
        }
        setAgents(prev => prev.filter(a => a.id !== id));
    }, []);

    const markNotified = useCallback((id) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, notified: true } : a));
    }, []);

    const markPosted = useCallback((id) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, posted: true, denied: false } : a));
    }, []);

    const markDenied = useCallback((id) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, denied: true, posted: false } : a));
    }, []);

    return { agents, runAgent, stopAgent, removeAgent, markNotified, markPosted, markDenied };
};

export default useAgents;
