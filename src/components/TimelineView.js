import React, { useMemo, useState } from 'react';
import { formatAssigneeName, parseDate } from '../utils/helpers';
import { Users, User, ArrowRight } from 'lucide-react';

// hierarchy: Overdue (red) > Hold (slate) > Active (blue) > Close (green)
const EVENT_CONFIG = {
    NEW:    { label: 'NEW',    color: 'text-[#60a5fa]' },  // ฟ้า — เพิ่งเปิด/กำลังทำ
    UPDATE: { label: 'UPDATE', color: 'text-[#e2e8f0]' },  // ขาวเทา — อัปเดต neutral
    CLOSE:  { label: 'CLOSE',  color: 'text-[#4ade80]' },  // เขียว — เสร็จแล้ว
};

const EventCard = ({ ev, isMerged, assigneeColors }) => {
    const resolvedType = ev.type === 'COMMENT' ? 'UPDATE' : ev.type;
    const cfg = EVENT_CONFIG[resolvedType] || EVENT_CONFIG.UPDATE;

    const renderUpdateLine = () => {
        const d = ev.detail;
        if (!d) return null;
        if (d.type === 'fromTo') {
            return (
                <div className="flex items-center gap-1 text-[11px] font-medium text-[color:var(--muted)]">
                    <span>{d.from || '—'}</span>
                    <ArrowRight size={9} className="flex-shrink-0 opacity-40" />
                    <span className="font-bold text-[color:var(--text)]">{d.to || '—'}</span>
                </div>
            );
        }
        if (d.type === 'twoLine') {
            return (
                <div className="text-[11px] text-[color:var(--muted)]">
                    {d.line1} <span className="font-bold text-[color:var(--text)]">{d.line2}</span>
                </div>
            );
        }
        if (d.type === 'simple') {
            return <div className="text-[11px] font-bold text-[color:var(--text)]">{d.text}</div>;
        }
        if (d.type === 'comment') {
            return (
                <div className="text-[11px] text-[color:var(--muted)] italic truncate max-w-[200px]">
                    "{d.preview}"
                </div>
            );
        }
        return null;
    };

    const updateLine = renderUpdateLine();

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-[color:var(--border)] font-medium">/</span>
                <span className="text-[10px] font-bold text-[color:var(--muted)] tracking-wide">{ev.task.id}</span>
            </div>
            {updateLine && <div>{updateLine}</div>}
            {isMerged && (
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: assigneeColors?.[ev.assignee] || '#ccc' }} />
                    <span className="text-[10px] font-bold text-[color:var(--muted)] truncate">{formatAssigneeName(ev.assignee)}</span>
                </div>
            )}
        </div>
    );
};

const TimelineRow = ({ data, title, color, onClickTitle, assigneeColors, isMerged, onTaskClick, openTaskDrawer }) => {
    return (
        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center gap-3 mb-2 sticky left-0 z-20">
                {isMerged ? (
                    <div className="w-8 h-8 rounded-full bg-[color:var(--surface2)] flex items-center justify-center border border-[color:var(--border)] text-[color:var(--accent)]">
                        <Users size={16} />
                    </div>
                ) : (
                    <span className="w-4 h-4 rounded-full shadow-inner flex-shrink-0" style={{ backgroundColor: color }}></span>
                )}

                <h3
                    onClick={onClickTitle}
                    className={`text-lg font-bold text-[color:var(--text)] font-syne transition-all ${onClickTitle ? 'cursor-pointer hover:underline decoration-2 underline-offset-4' : ''}`}
                    style={{ textDecorationColor: color || 'var(--muted)' }}
                    title={onClickTitle ? `View ${title}'s task summary` : title}
                >
                    {title}
                </h3>

                <div className="flex items-center gap-2 ml-2">
                    {/* 🚀 Active: ฟ้าสด (#60a5fa) */}
                    <button
                        onClick={() => openTaskDrawer && openTaskDrawer(`Active Tasks - ${title}`, data.activeTasksList)}
                        disabled={data.activeCount === 0}
                        className="text-[10px] font-bold text-white bg-[#60a5fa] px-2 py-1 rounded-lg uppercase tracking-widest shadow-sm whitespace-nowrap transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Active: {data.activeCount}
                    </button>

                    {/* 🚀 Hold: เทา (#64748b) */}
                    <button
                        onClick={() => openTaskDrawer && openTaskDrawer(`On Hold Tasks - ${title}`, data.holdTasksList)}
                        disabled={data.holdCount === 0}
                        className="text-[10px] font-bold text-white bg-[#64748b] px-2 py-1 rounded-lg uppercase tracking-widest shadow-sm whitespace-nowrap transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Hold: {data.holdCount}
                    </button>

                    {/* 🚀 Overdue: แดง (#f87171) */}
                    {data.overdueCount > 0 && (
                        <button
                            onClick={() => openTaskDrawer && openTaskDrawer(`Overdue Tasks - ${title}`, data.overdueTasksList)}
                            className="text-[10px] font-bold text-white bg-[#f87171] px-2 py-1 rounded-lg uppercase tracking-widest shadow-sm whitespace-nowrap transition-transform hover:-translate-y-0.5 cursor-pointer"
                        >
                            Overdue: {data.overdueCount}
                        </button>
                    )}

                    <span className="text-[10px] font-bold text-[color:var(--muted)] bg-[color:var(--surface2)] px-2 py-1 rounded-lg border border-[color:var(--border)] uppercase tracking-widest hidden sm:inline-block cursor-default">
                        {data.totalEvents} Act. (14D)
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto pb-4 cursor-grab active:cursor-grabbing scrollbar-hide">
                <div className="flex relative min-w-max pl-20 pr-12 pt-12">
                    <div className="absolute top-[55px] left-10 right-0 h-[1.5px] bg-[color:var(--border)] z-0"></div>
                    {data.nodes.map((node) => (
                        <div key={node.key} className={`relative z-10 flex flex-col shrink-0 group ${node.type === 'empty' ? 'w-24' : 'w-72'}`}>
                            <div className="h-4 relative">
                                {(node.type === 'empty' || node.isFirstHourOfDay) ? (
                                    <div className="absolute left-0 -translate-x-[7px] flex flex-col items-center">
                                        <span className="text-[11px] font-bold text-[color:var(--muted)] absolute -top-8 whitespace-nowrap">{node.dateStr}</span>
                                        <div className={`w-3.5 h-3.5 rounded-full border-2 z-10 ${node.type === 'empty' ? 'bg-[color:var(--surface)] border-[color:var(--border)]' : 'bg-[color:var(--surface2)] border-[color:var(--muted)]'}`}></div>
                                    </div>
                                ) : (
                                    <div className="absolute left-0 -translate-x-[3px] top-[4px]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--muted)] z-10"></div>
                                    </div>
                                )}
                            </div>
                            {node.type === 'hour' && (
                                <div className="border-l border-[color:var(--border)] ml-[0.5px] pl-5 pt-3 pb-2 flex flex-col gap-4">
                                    <div className="text-2xl font-medium text-[color:var(--text)] font-syne tracking-tight leading-none mb-1">
                                        {node.timeStr}
                                    </div>
                                    {node.events.map((ev, i) => (
                                        <div key={i} className="cursor-pointer group/item hover:bg-[color:var(--surface2)] p-2 -ml-2 rounded-lg transition-colors border border-transparent hover:border-[color:var(--border)]" onClick={() => onTaskClick(ev.task)}>
                                            <EventCard ev={ev} isMerged={isMerged} assigneeColors={assigneeColors} />
                                            <div className="mt-1.5 text-sm text-[color:var(--muted)] line-clamp-2 pr-2 group-hover/item:text-[color:var(--text)] transition-colors font-medium leading-snug">
                                                {ev.task.title}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TimelineView = ({ tasks, uniqueAssignees, assigneeColors, onTaskClick, openAssigneeDrawer, openTaskDrawer }) => {
    const [viewMode, setViewMode] = useState('individual');

    const buildEventsFromTask = (task, person) => {
        const events = [];
        const sLower = (task.status || '').toLowerCase();
        const isClose = sLower.includes('done') || sLower.includes('cancel');

        const cDate = task.created ? new Date(task.created) : null;
        if (cDate && !isNaN(cDate)) events.push({ type: 'NEW', time: cDate, task, assignee: person, detail: null });

        const rDate = isClose && task.resolutiondate ? new Date(task.resolutiondate) : null;
        if (rDate && !isNaN(rDate)) events.push({ type: 'CLOSE', time: rDate, task, assignee: person, detail: null });

        if (Array.isArray(task.fullChangeHistory)) {
            task.fullChangeHistory.forEach(entry => {
                const eTime = entry.created ? new Date(entry.created) : null;
                if (!eTime || isNaN(eTime)) return;

                const tooCloseToCreated = cDate && Math.abs(eTime - cDate) < 30000;
                const tooCloseToResolved = rDate && Math.abs(eTime - rDate) < 30000;
                if (tooCloseToCreated || tooCloseToResolved) return;

                let detail = null;
                const statusChange = entry.changes?.find(c => c.field?.toLowerCase() === 'status');
                const priorityChange = entry.changes?.find(c => c.field?.toLowerCase() === 'priority');
                const firstChange = entry.changes?.[0];

                if (statusChange) {
                    const toVal = (statusChange.to || '').toLowerCase();
                    const isStatusClose = toVal.includes('done') || toVal.includes('cancel');
                    if (isStatusClose) {
                        events.push({ type: 'CLOSE', time: eTime, task, assignee: person, detail: null });
                        return;
                    }
                    detail = { type: 'fromTo', from: statusChange.from, to: statusChange.to };
                } else if (priorityChange) {
                    detail = { type: 'fromTo', from: priorityChange.from, to: priorityChange.to };
                } else if (firstChange) {
                    const fieldName = firstChange.field.charAt(0).toUpperCase() + firstChange.field.slice(1);
                    detail = { type: 'twoLine', line1: 'change', line2: fieldName };
                }

                events.push({ type: 'UPDATE', time: eTime, task, assignee: person, detail });
            });
        }

        if (Array.isArray(task.comments)) {
            task.comments.forEach(comment => {
                const cTime = comment.createdTimestamp ? new Date(comment.createdTimestamp) : null;
                if (!cTime || isNaN(cTime)) return;
                const plainText = (comment.body || '').replace(/<[^>]+>/g, '').trim();
                const preview = plainText.length > 50 ? plainText.slice(0, 50) + '…' : plainText;
                events.push({ type: 'COMMENT', time: cTime, task, assignee: person, detail: { type: 'comment', preview, author: comment.author } });
            });
        }

        return events;
    };

    const processTimelineData = (eventsList) => {
        const now = new Date();
        const nodes = [];
        let totalEvents = 0;

        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 14);
        const filtered = eventsList.filter(ev => ev.time >= cutoff && ev.time <= now);

        const eventsByDate = {};
        filtered.forEach(ev => {
            const dateKey = ev.time.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
            eventsByDate[dateKey].push(ev);
        });

        for (let i = 0; i <= 14; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            const displayDate = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' });

            if (!eventsByDate[dateKey] || eventsByDate[dateKey].length === 0) {
                nodes.push({ type: 'empty', key: `empty-${dateKey}`, dateStr: displayDate });
            } else {
                const hourBuckets = {};
                eventsByDate[dateKey].forEach(ev => {
                    const h = ev.time.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false });
                    if (!hourBuckets[h]) {
                        hourBuckets[h] = { type: 'hour', key: `hour-${dateKey}-${h}`, dateStr: displayDate, timeStr: `${h}.00`, events: [], sortHour: parseInt(h, 10) };
                    }
                    hourBuckets[h].events.push(ev);
                    totalEvents++;
                });

                const sortedHours = Object.values(hourBuckets).sort((a, b) => b.sortHour - a.sortHour);
                sortedHours.forEach((bucket, idx) => {
                    bucket.events.sort((a, b) => b.time.getTime() - a.time.getTime());
                    bucket.isFirstHourOfDay = (idx === 0);
                    nodes.push(bucket);
                });
            }
        }
        return { nodes, totalEvents };
    };

    const individualTimelines = useMemo(() => {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const personDataMap = {};

        uniqueAssignees.forEach(person => {
            if (person !== 'Unassigned') {
                personDataMap[person] = { name: person, events: [], activeCount: 0, holdCount: 0, overdueCount: 0, activeTasksList: [], holdTasksList: [], overdueTasksList: [] };
            }
        });

        tasks.forEach(task => {
            const person = task.assignee;
            if (!person || person === 'Unassigned' || !personDataMap[person]) return;

            const sLower = (task.status || '').toLowerCase();
            const isClose = sLower.includes('done') || sLower.includes('cancel');
            const isHold = sLower.includes('on hold') || sLower.includes('pending user review');
            const isActive = !isClose && !isHold;

            if (isHold) { 
                personDataMap[person].holdCount++; 
                personDataMap[person].holdTasksList.push(task); 
            } else if (isActive) { 
                personDataMap[person].activeCount++; 
                personDataMap[person].activeTasksList.push(task); 
            }

            // 🚀 Overdue จะหาจากงานที่ Active เท่านั้น (ไม่นับ Hold)
            if (isActive) {
                const dueDate = parseDate(task.dueDate);
                if (dueDate && dueDate < todayStart) { 
                    personDataMap[person].overdueCount++; 
                    personDataMap[person].overdueTasksList.push(task); 
                }
            }

            buildEventsFromTask(task, person).forEach(ev => personDataMap[person].events.push(ev));
        });

        return Object.values(personDataMap).map(pd => {
            const processed = processTimelineData(pd.events);
            return { ...pd, nodes: processed.nodes, totalEvents: processed.totalEvents };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [tasks, uniqueAssignees]);

    const mergedTimeline = useMemo(() => {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const allEvents = [];
        let activeCount = 0, holdCount = 0, overdueCount = 0;
        const activeTasksList = [], holdTasksList = [], overdueTasksList = [];

        tasks.forEach(task => {
            const person = task.assignee;
            if (!person || person === 'Unassigned') return;

            const sLower = (task.status || '').toLowerCase();
            const isClose = sLower.includes('done') || sLower.includes('cancel');
            const isHold = sLower.includes('on hold') || sLower.includes('pending user review');
            const isActive = !isClose && !isHold;

            if (isHold) { holdCount++; holdTasksList.push(task); }
            else if (isActive) { activeCount++; activeTasksList.push(task); }

            // 🚀 Overdue จะหาจากงานที่ Active เท่านั้น (ไม่นับ Hold)
            if (isActive) {
                const dueDate = parseDate(task.dueDate);
                if (dueDate && dueDate < todayStart) { overdueCount++; overdueTasksList.push(task); }
            }

            buildEventsFromTask(task, person).forEach(ev => allEvents.push(ev));
        });

        const processed = processTimelineData(allEvents);
        return { nodes: processed.nodes, totalEvents: processed.totalEvents, activeCount, holdCount, overdueCount, activeTasksList, holdTasksList, overdueTasksList };
    }, [tasks]);

    if (individualTimelines.length === 0) {
        return <div className="p-12 text-center text-[color:var(--muted)] font-medium font-syne text-lg bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl mt-2">No timeline activity found.</div>;
    }

    return (
        <div className="font-sans mt-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 mt-2">
                <div className="font-syne">
                    <h2 className="text-xl font-bold text-[color:var(--text)]">Activity Timeline</h2>
                    <p className="text-xs text-[color:var(--muted)] mt-1 font-sans font-medium">Tracking events from the last 14 days</p>
                </div>
                <div className="bg-[color:var(--surface)] p-1 rounded-xl flex text-xs font-bold border border-[color:var(--border)] shadow-sm">
                    <button onClick={() => setViewMode('individual')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${viewMode === 'individual' ? 'bg-[color:var(--surface2)] shadow-sm text-[color:var(--text)] border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}><User size={14} /> Individual Track</button>
                    <button onClick={() => setViewMode('merged')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${viewMode === 'merged' ? 'bg-[color:var(--accent)] shadow-sm text-[color:var(--bg)] border border-[color:var(--accent)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}><Users size={14} /> Merged View</button>
                </div>
            </div>
            <div className="space-y-6">
                {viewMode === 'individual' ? (
                    individualTimelines.map((personData) => (
                        <TimelineRow key={personData.name} data={personData} title={formatAssigneeName(personData.name)} color={assigneeColors[personData.name]} onClickTitle={() => openAssigneeDrawer && openAssigneeDrawer(personData.name)} assigneeColors={assigneeColors} isMerged={false} onTaskClick={onTaskClick} openTaskDrawer={openTaskDrawer} />
                    ))
                ) : (
                    <div className="animate-in zoom-in-95 duration-300">
                        <TimelineRow data={mergedTimeline} title="Merged Team Activity" color="var(--accent)" onClickTitle={null} assigneeColors={assigneeColors} isMerged={true} onTaskClick={onTaskClick} openTaskDrawer={openTaskDrawer} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(TimelineView);