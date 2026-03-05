import React, { useMemo, useState } from 'react';
import { formatAssigneeName, parseDate } from '../utils/helpers';
import { Swords, Building2, CheckCircle2, Zap, LayoutList, AlertCircle, X, Clock, PauseCircle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Radar as RadarArea } from 'recharts';

const CATEGORY_MAP = {
    'Product Spec. Tracking [D]': 'Spec',
    'Product Analysis [D]': 'Analysis',
    'Product Report/Ad-Hoc [D]': 'Report',
    'Product Investigation [D]': 'Investigate',
    'Initiation/Idea [D]': 'Idea',
    'Other': 'Other'
};

const FOCUS_CATEGORIES = Object.keys(CATEGORY_MAP).filter(k => k !== 'Other');
const ALL_AXES = [...FOCUS_CATEGORIES, 'Other'];

const TeamView = ({ groupedByTeam, assigneeColors, openAssigneeDrawer, onTaskClick }) => {
    
    const [speedLogModal, setSpeedLogModal] = useState({ isOpen: false, assigneeName: '', logs: [] });

    const playerStats = useMemo(() => {
        return groupedByTeam.map(([person, {tasks, email}]) => {
            const catStats = {};
            const deptCount = {};
            
            let tasksWithDue = 0;
            let tasksOnTime = 0;
            let totalPuncDays = 0;
            let completedWithDue = 0;
            
            let currentActive = 0;
            let currentHold = 0;
            let currentOverdue = 0;

            const speedLogs = [];

            ALL_AXES.forEach(cat => catStats[cat] = { count: 0, overdue: 0, doneCount: 0 });

            tasks.forEach(t => {
                const rawCat = t.biCategory;
                const cat = FOCUS_CATEGORIES.includes(rawCat) ? rawCat : 'Other';
                const statusLower = (t.status || '').toLowerCase();
                
                const isDone = statusLower.includes('done') || statusLower.includes('cancel');
                const isHold = statusLower.includes('on hold') || statusLower.includes('pending user review');
                const isActive = !isDone && !isHold;
                
                const dDate = t.dueDate ? new Date(t.dueDate) : null;
                const rDate = isDone ? (t.resolutiondate ? new Date(t.resolutiondate) : (t.lastUpdated ? new Date(t.lastUpdated) : null)) : null;
                const today = new Date(); today.setHours(0,0,0,0);

                const dept = t.department || 'N/A';
                deptCount[dept] = (deptCount[dept] || 0) + 1;

                catStats[cat].count++;
                if (isDone) catStats[cat].doneCount++;
                
                if (isHold) {
                    currentHold++;
                } else if (isActive) {
                    currentActive++;
                    if (dDate && !isNaN(dDate) && today > dDate) {
                        currentOverdue++;
                    }
                }

                if (dDate && !isNaN(dDate)) {
                    tasksWithDue++;
                    
                    if (isDone) {
                        if (rDate && !isNaN(rDate)) {
                            if (rDate <= dDate) tasksOnTime++;
                            const diffDays = (dDate.getTime() - rDate.getTime()) / 86400000;
                            if (Math.abs(diffDays) <= 100) {
                                totalPuncDays += diffDays;
                                completedWithDue++;
                            }
                        }
                    } else if (today <= dDate) {
                        tasksOnTime++;
                    }

                    if (isDone && rDate && rDate > dDate) catStats[cat].overdue++;
                    else if (isActive && today > dDate) catStats[cat].overdue++;
                }

                if (isDone) {
                    let speedD = null;
                    let isOverD = null;

                    if (dDate && !isNaN(dDate) && rDate && !isNaN(rDate)) {
                        const diffDays = (dDate.getTime() - rDate.getTime()) / 86400000;
                        if (Math.abs(diffDays) <= 100) {
                            speedD = parseFloat(diffDays.toFixed(1));
                            isOverD = diffDays < 0;
                        }
                    }

                    speedLogs.push({
                        taskKey: t.id,
                        title: t.title,
                        dueDate: dDate,
                        resolvedDate: rDate,
                        speedDays: speedD,
                        isOverdue: isOverD,
                        fullTask: t // เก็บข้อมูลเต็มไว้ใช้กดเปิด Drawer
                    });
                }
            });

            speedLogs.sort((a, b) => {
                if (!a.resolvedDate) return 1;
                if (!b.resolvedDate) return -1;
                return b.resolvedDate - a.resolvedDate;
            });

            const radarData = ALL_AXES.map(cat => {
                const s = catStats[cat];
                if (s.count === 0) return { subject: CATEGORY_MAP[cat], fullSubject: cat, A: 0, effectiveTasks: 0 };
                const effectiveTasks = s.count - s.overdue;
                const score = Math.max(0, Math.min(100, effectiveTasks * 10));
                return { subject: CATEGORY_MAP[cat], fullSubject: cat, A: score, effectiveTasks: effectiveTasks };
            });

            const topSkill = radarData.reduce((prev, current) => (prev.effectiveTasks > current.effectiveTasks) ? prev : current);

            const maxDeptTask = Math.max(...Object.values(deptCount), 1);
            const sortedDepts = Object.entries(deptCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, count]) => {
                    const scale = count / maxDeptTask;
                    const weightOptions = [400, 500, 600, 700, 800, 900];
                    const weightIndex = Math.min(Math.floor(scale * 6), 5);
                    return { name, count, fontSize: 0.8 + (scale * 0.8), fontWeight: weightOptions[weightIndex] };
                });

            return {
                person, email, tasks, radarData, speedLogs,
                currentActive, currentHold, currentOverdue,
                onTimePercent: tasksWithDue > 0 ? Math.round((tasksOnTime / tasksWithDue) * 100) : null,
                avgDaysPunc: completedWithDue > 0 ? (totalPuncDays / completedWithDue).toFixed(1) : null,
                mainClass: topSkill.effectiveTasks > 0 ? CATEGORY_MAP[topSkill.fullSubject] : 'N/A',
                deptSupport: sortedDepts
            };
        }).sort((a, b) => b.tasks.length - a.tasks.length);

    }, [groupedByTeam]);

    const handleSpeedLogClick = (e, player) => {
        e.stopPropagation();
        setSpeedLogModal({
            isOpen: true,
            assigneeName: formatAssigneeName(player.person, player.email),
            logs: player.speedLogs
        });
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 font-sans pb-10">
                {playerStats.map((player) => {
                    const color = assigneeColors[player.person] || 'var(--accent)';
                    const isAtRisk = player.currentOverdue > 0;
                    const isGoodPerf = player.onTimePercent !== null && player.onTimePercent >= 80;
                    
                    return (
                        <div 
                            key={player.person} 
                            className="bg-[color:var(--surface)] rounded-[24px] shadow-sm hover:shadow-xl border border-[color:var(--border)] overflow-hidden flex flex-col transition-all duration-300 group cursor-pointer hover:border-[color:var(--accent)]/40"
                            onClick={() => openAssigneeDrawer && openAssigneeDrawer(player.person)}
                        >
                            {/* Header */}
                            <div className="px-5 py-4 bg-[color:var(--surface2)]/50 flex justify-between items-center">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[color:var(--bg)] font-syne text-xl shadow-inner flex-shrink-0" style={{backgroundColor: color}}>
                                        {player.person.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-[color:var(--text)] font-syne truncate group-hover:text-[color:var(--accent)] transition-colors">
                                            {formatAssigneeName(player.person, player.email)}
                                        </h3>
                                        <p className="text-[10px] text-[color:var(--muted)] font-medium truncate mt-0.5 uppercase tracking-wider">
                                            Capability Profile · {player.tasks.length} tasks total
                                        </p>
                                    </div>
                                </div>

                                {isAtRisk && (
                                    <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/30">
                                        <AlertCircle size={9} /> At Risk
                                    </span>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-5 gap-0 bg-[color:var(--bg)]/40 px-2 py-2">
                                
                                <div className="p-2 text-center flex flex-col items-center justify-center">
                                    <LayoutList size={14} className="text-[#60a5fa] mb-1" />
                                    <p className="text-[16px] font-black font-syne text-[#60a5fa] leading-none">{player.currentActive}</p>
                                    <p className="text-[8px] font-bold text-[color:var(--muted)] uppercase mt-1">Active</p>
                                </div>

                                <div className="p-2 text-center flex flex-col items-center justify-center">
                                    <PauseCircle size={14} className="text-[#64748b] mb-1" />
                                    <p className="text-[16px] font-black font-syne text-[#64748b] leading-none">{player.currentHold}</p>
                                    <p className="text-[8px] font-bold text-[color:var(--muted)] uppercase mt-1">Hold</p>
                                </div>

                                <div className={`p-2 text-center flex flex-col items-center justify-center rounded-xl transition-colors ${player.currentOverdue > 0 ? 'bg-[#f87171]/10' : ''}`}>
                                    <AlertCircle size={14} className={`mb-1 ${player.currentOverdue > 0 ? 'text-[#f87171]' : 'text-[color:var(--muted)]'}`} />
                                    <p className={`text-[16px] font-black font-syne leading-none ${player.currentOverdue > 0 ? 'text-[#f87171]' : 'text-[color:var(--muted)]'}`}>{player.currentOverdue}</p>
                                    <p className={`text-[8px] font-bold uppercase mt-1 ${player.currentOverdue > 0 ? 'text-[#f87171]' : 'text-[color:var(--muted)]'}`}>Overdue</p>
                                </div>

                                <div className="p-2 text-center flex flex-col items-center justify-center">
                                    <CheckCircle2 size={14} className={`mb-1 ${isGoodPerf ? 'text-[#4ade80]' : 'text-[#f87171]'}`} />
                                    <p className={`text-[16px] font-black font-syne leading-none ${isGoodPerf ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                                        {player.onTimePercent !== null ? `${player.onTimePercent}%` : '-'}
                                    </p>
                                    <p className="text-[8px] font-bold text-[color:var(--muted)] uppercase mt-1">On-Time</p>
                                </div>
                                
                                <div 
                                    className="p-2 text-center flex flex-col items-center justify-center cursor-pointer hover:bg-[color:var(--surface2)] rounded-xl transition-colors group/speed relative z-10"
                                    onClick={(e) => handleSpeedLogClick(e, player)}
                                    title="Click to view detailed speed logs"
                                >
                                    <Zap size={14} className={`mb-1 group-hover/speed:scale-110 transition-transform ${parseFloat(player.avgDaysPunc) >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`} />
                                    <p className={`text-[16px] font-black font-syne leading-none ${parseFloat(player.avgDaysPunc) >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                                        {player.avgDaysPunc !== null ? (parseFloat(player.avgDaysPunc) > 0 ? `+${player.avgDaysPunc}` : `${player.avgDaysPunc}`) : '-'}
                                    </p>
                                    <p className="text-[8px] font-bold text-[color:var(--muted)] uppercase mt-1">Avg Speed</p>
                                </div>
                            </div>

                            {/* Radar + Side Info */}
                            <div className="flex flex-row px-5 pb-6 pt-4 gap-2 items-center flex-1">
                                <div className="w-7/12 h-56 relative -ml-6">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={player.radarData}>
                                            <PolarGrid stroke="var(--border)" strokeWidth={1} />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted)', fontSize: 9, fontWeight: 700 }} />
                                            <RadarArea name={player.person} dataKey="A" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.25} animationDuration={800} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="w-5/12 flex flex-col gap-5 z-10 pl-2">
                                    <div>
                                        <span className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                            <Swords size={12} className="text-[#c084fc]" /> Expertise
                                        </span>
                                        <span className="inline-block text-sm font-bold px-3 py-1.5 rounded-xl bg-[color:var(--surface2)] text-[color:var(--text)] border border-[color:var(--border)] shadow-sm">
                                            {player.mainClass}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                            <Building2 size={12} className="text-[color:var(--accent4)]" /> Support Area
                                        </span>
                                        <div className="flex flex-col items-start justify-start gap-y-1">
                                            {player.deptSupport.length > 0 ? player.deptSupport.map((dept) => (
                                                <span 
                                                    key={dept.name} 
                                                    className="font-syne tracking-tight text-[color:var(--text)] transition-colors hover:text-[color:var(--accent)] cursor-default leading-none"
                                                    style={{ 
                                                        fontSize: `${dept.fontSize}rem`, 
                                                        fontWeight: dept.fontWeight,
                                                        opacity: Math.max(0.4, (dept.count / player.deptSupport[0].count))
                                                    }}
                                                    title={`${dept.count} tasks`}
                                                >
                                                    {dept.name}
                                                </span>
                                            )) : <span className="text-xs text-[color:var(--muted)] font-medium">No data</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {speedLogModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans transition-opacity" onClick={() => setSpeedLogModal({ isOpen: false, assigneeName: '', logs: [] })}>
                    <div className="bg-[color:var(--bg)] border border-[color:var(--border)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        
                        <div className="flex items-center justify-between p-5 border-b border-[color:var(--border)] bg-[color:var(--surface)] rounded-t-2xl">
                            <div>
                                <h3 className="text-lg font-bold text-[color:var(--text)] font-syne flex items-center gap-2">
                                    <Zap size={18} className="text-[#4ade80]" /> 
                                    Completed Tasks Details
                                </h3>
                                <p className="text-xs text-[color:var(--muted)] mt-1">
                                    Completed Tasks for <span className="font-bold text-[color:var(--text)]">{speedLogModal.assigneeName}</span>
                                </p>
                            </div>
                            <button onClick={() => setSpeedLogModal({ isOpen: false, assigneeName: '', logs: [] })} className="p-2 text-[color:var(--muted)] hover:text-[#f87171] hover:bg-[#f87171]/10 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1 bg-[color:var(--bg)]">
                            {speedLogModal.logs.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] sticky top-0 text-xs uppercase tracking-wider font-bold z-10 border-b border-[color:var(--border)]">
                                        <tr>
                                            <th className="px-5 py-3">Task Key</th>
                                            <th className="px-5 py-3">Title</th>
                                            <th className="px-5 py-3">Due Date</th>
                                            <th className="px-5 py-3">Resolved</th>
                                            <th className="px-5 py-3 text-center">Speed (Days)</th>
                                            <th className="px-5 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--border)]">
                                        {speedLogModal.logs.map((log, index) => (
                                            <tr 
                                                key={index} 
                                                className="hover:bg-[color:var(--surface2)] transition-colors text-[color:var(--text)] cursor-pointer group"
                                                onClick={() => {
                                                    if (onTaskClick && log.fullTask) {
                                                        onTaskClick(log.fullTask);
                                                    }
                                                }}
                                            >
                                                <td className="px-5 py-3 font-bold text-[color:var(--accent3)] whitespace-nowrap group-hover:underline underline-offset-2">{log.taskKey}</td>
                                                <td className="px-5 py-3 font-medium truncate max-w-[250px] group-hover:text-[color:var(--accent)] transition-colors" title={log.title}>{log.title}</td>
                                                <td className="px-5 py-3 text-[color:var(--muted)] whitespace-nowrap">
                                                    {log.dueDate && !isNaN(log.dueDate) ? log.dueDate.toLocaleDateString('en-GB') : '-'}
                                                </td>
                                                <td className="px-5 py-3 text-[color:var(--muted)] whitespace-nowrap">
                                                    {log.resolvedDate && !isNaN(log.resolvedDate) ? log.resolvedDate.toLocaleDateString('en-GB') : '-'}
                                                </td>
                                                <td className={`px-5 py-3 font-black text-center whitespace-nowrap ${log.speedDays !== null ? (log.speedDays >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]') : 'text-[color:var(--muted)]'}`}>
                                                    {log.speedDays !== null ? (log.speedDays > 0 ? `+${log.speedDays}` : log.speedDays) : '-'}
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    {log.isOverdue === null ? (
                                                        <span className="text-[color:var(--muted)] font-bold">-</span>
                                                    ) : log.isOverdue ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/30">
                                                            <AlertCircle size={10} /> OVERDUE
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/30">
                                                            <CheckCircle2 size={10} /> ON-TIME
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-[color:var(--muted)] h-full">
                                    <Clock size={48} className="mb-4 opacity-20" />
                                    <p className="font-bold">No completed tasks found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default React.memo(TeamView);