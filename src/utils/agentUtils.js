import React from 'react';

export const CLAUDE_API   = 'http://localhost:4000/api/claude/run-task';
export const HISTORY_API  = 'http://localhost:4000/api/agent-history';

export const getToolMeta = (toolName) => {
    const n = (toolName || '').toLowerCase();
    if (n.includes('write')) return { label: 'WRITE', color: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30' };
    if (n.includes('bash'))  return { label: 'RUN',   color: 'text-orange-300 bg-orange-500/15 border-orange-500/30' };
    if (n.includes('read'))  return { label: 'READ',  color: 'text-blue-300 bg-blue-500/15 border-blue-500/30' };
    if (n.includes('edit'))  return { label: 'EDIT',  color: 'text-purple-300 bg-purple-500/15 border-purple-500/30' };
    if (n.includes('glob') || n.includes('grep') || n.includes('search')) return { label: 'FIND', color: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30' };
    return { label: 'TOOL', color: 'text-gray-300 bg-gray-500/15 border-gray-500/30' };
};

export const getToolDescription = (toolName, input) => {
    const n = (toolName || '').toLowerCase();
    if (!input) return toolName;
    if (n.includes('write')) return input.file_path || input.path || 'file';
    if (n.includes('bash')) {
        const cmd = input.command || input.cmd || '';
        return cmd.length > 140 ? cmd.substring(0, 140) + '…' : cmd;
    }
    if (n.includes('read'))  return input.file_path || input.path || 'file';
    if (n.includes('edit'))  return input.file_path || input.path || 'file';
    if (n.includes('glob'))  return input.pattern || '';
    if (n.includes('grep'))  return `"${input.pattern || ''}" in ${input.path || '.'}`;
    return Object.values(input)[0] || toolName;
};

export const deriveCurrentAction = (logs, isRunning) => {
    if (!logs.length) return isRunning ? { phase: 'running', label: 'Starting up…' } : null;
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if (log.type === 'done') {
            return log.exitCode === 0
                ? { phase: 'done', label: 'Analysis complete' }
                : { phase: 'error', label: `Exited (${log.exitCode != null ? `code ${log.exitCode}` : log.signal || 'unknown'})` };
        }
        if (log.type === 'error') return { phase: 'error', label: log.text?.split('\n')[0] || 'Error' };
        if (log.type === 'claude_event') {
            const e = log.event;
            if (e.type === 'result') return e.subtype === 'success' ? { phase: 'done', label: 'Analysis complete' } : { phase: 'error', label: 'Error during execution' };
            if (e.type === 'user' && e.message?.content?.some(b => b.type === 'tool_result')) return { phase: 'running', label: 'Processing output…' };
            if (e.type === 'assistant' && e.message?.content) {
                const lastTool = [...e.message.content].reverse().find(b => b.type === 'tool_use');
                if (lastTool) {
                    const { label } = getToolMeta(lastTool.name);
                    return { phase: 'running', label: `${label}: ${getToolDescription(lastTool.name, lastTool.input)}` };
                }
                if (e.message.content.some(b => b.type === 'text' && b.text)) return { phase: 'running', label: 'Analyzing requirements…' };
            }
            if (e.type === 'system') return { phase: 'running', label: 'Connected to Claude…' };
        }
        if (log.type === 'start') return { phase: 'running', label: 'Starting up…' };
    }
    return isRunning ? { phase: 'running', label: 'Working…' } : null;
};

export const extractResult = (logs) => {
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if (log.type === 'claude_event' && log.event?.type === 'result' && log.event?.subtype === 'success') {
            return {
                text: log.event.result || '',
                cost: log.event.total_cost_usd,
                duration: log.event.duration_ms,
            };
        }
    }
    return null;
};

export const deriveAgentStatus = (logs) => {
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if (log.type === 'done') return log.exitCode === 0 ? 'done' : 'error';
        if (log.type === 'error') return 'error';
        if (log.type === 'claude_event') {
            const e = log.event;
            if (e.type === 'result') return e.subtype === 'success' ? 'done' : 'error';
        }
    }
    return 'running';
};

// ── Markdown result renderer ──────────────────────────────────────────────────

const renderInline = (text) => {
    if (!text) return null;
    const parts = [];
    const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
    let last = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        if (m[1] != null) parts.push(<strong key={m.index} className="font-bold">{m[1]}</strong>);
        else if (m[2] != null) parts.push(<em key={m.index}>{m[2]}</em>);
        else if (m[3] != null) parts.push(<code key={m.index} className="bg-black/20 px-1 py-0.5 rounded font-mono text-[10px]">{m[3]}</code>);
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 && typeof parts[0] === 'string' ? text : parts;
};

export const MarkdownResult = ({ text, dark = false }) => {
    if (!text?.trim()) return null;
    const t = dark ? 'text-gray-300' : 'text-[color:var(--text)]';
    const tBold = dark ? 'text-white' : 'text-[color:var(--text)]';
    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.trimStart().startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            elements.push(
                <pre key={i} className={`rounded-lg p-2.5 text-[11px] font-mono overflow-x-auto my-2 whitespace-pre ${dark ? 'bg-black/40 text-emerald-300 border border-white/5' : 'bg-black/5 text-emerald-700 border border-black/8'}`}>
                    {codeLines.join('\n')}
                </pre>
            );
            i++; continue;
        }

        const h1 = line.match(/^# (.+)/);
        if (h1) { elements.push(<p key={i} className={`font-bold text-sm mt-3 mb-0.5 ${tBold}`}>{renderInline(h1[1])}</p>); i++; continue; }
        const h2 = line.match(/^## (.+)/);
        if (h2) { elements.push(<p key={i} className={`font-bold text-xs mt-2.5 mb-0.5 ${tBold}`}>{renderInline(h2[1])}</p>); i++; continue; }
        const h3 = line.match(/^### (.+)/);
        if (h3) { elements.push(<p key={i} className={`font-semibold text-xs mt-2 mb-0.5 ${dark ? 'text-gray-200' : 'text-[color:var(--text)]'}`}>{renderInline(h3[1])}</p>); i++; continue; }

        if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/)) {
            elements.push(<hr key={i} className={`my-2 border-0 border-t ${dark ? 'border-white/10' : 'border-black/10'}`} />);
            i++; continue;
        }

        if (line.match(/^[-*] /)) {
            const items = [];
            while (i < lines.length && lines[i].match(/^[-*] /)) {
                const k = i;
                items.push(<li key={k} className={`text-xs leading-relaxed ${t}`}>{renderInline(lines[i].replace(/^[-*] /, ''))}</li>);
                i++;
            }
            elements.push(<ul key={i} className="list-disc ml-4 my-1 space-y-0.5">{items}</ul>);
            continue;
        }

        if (line.match(/^\d+\. /)) {
            const items = [];
            while (i < lines.length && lines[i].match(/^\d+\. /)) {
                const k = i;
                items.push(<li key={k} className={`text-xs leading-relaxed ${t}`}>{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>);
                i++;
            }
            elements.push(<ol key={i} className="list-decimal ml-4 my-1 space-y-0.5">{items}</ol>);
            continue;
        }

        if (!line.trim()) { i++; continue; }

        elements.push(<p key={i} className={`text-xs leading-relaxed ${t}`}>{renderInline(line)}</p>);
        i++;
    }

    return <div className="space-y-1">{elements}</div>;
};

// ── Shared terminal log renderer ──────────────────────────────────────────────

const ToolBadge = ({ label, color }) => (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border tracking-wider flex-shrink-0 ${color}`}>
        {label}
    </span>
);

export const LogEntry = ({ log }) => {
    if (log.type === 'start') return <div className="text-[#4a7fbf] text-xs">→ {log.message}</div>;
    if (log.type === 'error') return <div className="text-red-400 whitespace-pre-wrap text-xs">✗ {log.text}</div>;
    if (log.type === 'stderr') return <div className="text-orange-400 whitespace-pre-wrap text-xs opacity-60">{log.text}</div>;
    if (log.type === 'raw') return <div className="text-gray-600 whitespace-pre-wrap text-xs">{log.text}</div>;
    if (log.type === 'done') {
        if (log.exitCode === 0) return null;
        const detail = log.exitCode != null ? `code ${log.exitCode}` : log.signal ? `signal ${log.signal}` : 'unknown';
        return <div className="text-red-400 text-xs">Process exited ({detail})</div>;
    }
    if (log.type === 'claude_event') {
        const event = log.event;
        if (event.type === 'system' && event.subtype === 'init') {
            return <div className="text-[#3a3a5a] text-xs flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#3a3a5a]"></span>Session · {event.model || 'Claude'}</div>;
        }
        if (event.type === 'system') return null;
        if (event.type === 'assistant' && event.message?.content) {
            return (
                <div className="space-y-2">
                    {event.message.content.map((block, i) => {
                        if (block.type === 'text' && block.text) return (
                            <div key={i} className="flex items-start gap-2">
                                <ToolBadge label="THINK" color="text-violet-300 bg-violet-500/15 border-violet-500/30" />
                                <div className="text-gray-200 whitespace-pre-wrap text-xs leading-relaxed">{block.text}</div>
                            </div>
                        );
                        if (block.type === 'tool_use') {
                            const meta = getToolMeta(block.name);
                            return (
                                <div key={i} className="flex items-start gap-2">
                                    <ToolBadge label={meta.label} color={meta.color} />
                                    <span className="text-gray-100 whitespace-pre-wrap text-xs">{getToolDescription(block.name, block.input)}</span>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            );
        }
        if (event.type === 'user' && event.message?.content) {
            const results = event.message.content.filter(b => b.type === 'tool_result');
            if (!results.length) return null;
            return (
                <div className="space-y-2">
                    {results.map((r, i) => {
                        const content = typeof r.content === 'string' ? r.content
                            : Array.isArray(r.content) ? r.content.map(c => c.text || JSON.stringify(c)).join('\n')
                            : JSON.stringify(r.content);
                        if (!content?.trim()) return null;
                        const truncated = content.length > 3000 ? content.substring(0, 3000) + '\n… (truncated)' : content;
                        return (
                            <div key={i} className="flex items-start gap-2">
                                <ToolBadge label="OUT" color="text-green-300 bg-green-500/15 border-green-500/30" />
                                <div className="text-green-300 whitespace-pre-wrap text-xs leading-relaxed">{truncated}</div>
                            </div>
                        );
                    })}
                </div>
            );
        }
        if (event.type === 'result' && event.subtype === 'success') return null; // shown in result box
        if (event.type === 'result') return <div className="text-red-400 text-xs">✗ {event.result || 'Error'}</div>;
        return null;
    }
    return null;
};
