import React, { useMemo, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Briefcase, Users, LayoutList, PauseCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { parseDate } from '../utils/helpers';

const AssigneeChartDrawer = ({ isOpen, onClose, assigneeName, tasks = [], departmentColors, biCategoryColors, onTaskClick }) => {
    const [activeTab, setActiveTab] = useState('active');

    const insights = useMemo(() => {
        const todayStart = new Date(); 
        todayStart.setHours(0, 0, 0, 0);

        const activeTasks = [];
        const holdTasks = [];
        const completedTasks = [];
        let overdueCount = 0;

        const catCount = {};
        const deptCount = {};

        tasks.forEach(task => {
            const statusLower = (task.status || '').toLowerCase();
            const isDone = statusLower.includes('done') || statusLower.includes('cancel');
            const isHold = statusLower.includes('on hold') || statusLower.includes('pending user review');
            const isActive = !isDone && !isHold;
            
            if (isDone) {
                completedTasks.push(task);
            } else if (isHold) {
                holdTasks.push(task);
            } else if (isActive) {
                activeTasks.push(task);
                // 🚀 Logic: Overdue นับเฉพาะ Active
                const dueDate = parseDate(task.dueDate);
                if (dueDate && dueDate < todayStart) overdueCount++;
            }

            const cat = task.biCategory || 'Uncategorized';
            catCount[cat] = (catCount[cat] || 0) + 1;

            const dept = task.department || 'Unknown';
            deptCount[dept] = (deptCount[dept] || 0) + 1;
        });

        const catData = Object.keys(catCount).map(key => ({
            name: key, value: catCount[key], color: biCategoryColors[key] || '#ccc'
        })).sort((a, b) => b.value - a.value);

        const deptData = Object.keys(deptCount).map(key => ({
            name: key, value: deptCount[key], color: departmentColors[key] || '#ccc'
        })).sort((a, b) => b.value - a.value);

        return {
            activeTasks: activeTasks.sort((a, b) => parseDate(b.created || b.startDate) - parseDate(a.created || a.startDate)),
            holdTasks: holdTasks.sort((a, b) => parseDate(b.created || b.startDate) - parseDate(a.created || a.startDate)),
            completedTasks: completedTasks.sort((a, b) => parseDate(b.resolutiondate || b.lastUpdated) - parseDate(a.resolutiondate || a.lastUpdated)),
            overdueCount,
            catData,
            deptData
        };
    }, [tasks, departmentColors, biCategoryColors]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[color:var(--surface)] border border-[color:var(--border)] p-3 rounded-xl shadow-lg font-sans">
                    <p className="text-sm font-bold text-[color:var(--text)] mb-1">{payload[0].name}</p>
                    <p className="text-xs text-[color:var(--muted)]">Count: <span className="font-bold text-[color:var(--text)]">{payload[0].value}</span></p>
                </div>
            );
        }
        return null;
    };

    const renderTable = (taskList, isCompletedList) => (
        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl overflow-hidden mt-4 shadow-sm">
            <div className="max-h-[40vh] overflow-y-auto w-full scrollbar-hide">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] sticky top-0 uppercase tracking-wider text-xs font-bold z-10">
                        <tr>
                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Key</th>
                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Title</th>
                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Status</th>
                            <th className="px-5 py-3 border-b border-[color:var(--border)]">{isCompletedList ? 'Resolved Date' : 'Due Date'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--border)]">
                        {taskList.map(task => {
                            const statusLower = (task.status || '').toLowerCase();
                            const isHold = statusLower.includes('on hold') || statusLower.includes('pending user review');
                            // ถ้างายเสร็จแล้ว หรือ Hold จะไม่มี Overdue label
                            const isOverdue = !isCompletedList && !isHold && task.dueDate && parseDate(task.dueDate) < new Date(new Date().setHours(0,0,0,0));
                            
                            return (
                                <tr key={task.id} className="hover:bg-[color:var(--surface2)] cursor-pointer transition-colors text-[color:var(--text)]" onClick={() => onTaskClick(task)}>
                                    <td className="px-5 py-3 font-bold text-[color:var(--accent3)] whitespace-nowrap">{task.id}</td>
                                    <td className="px-5 py-3 font-medium truncate max-w-[200px]" title={task.title}>{task.title}</td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-[color:var(--surface2)] border border-[color:var(--border)] uppercase">
                                            {task.status}
                                        </span>
                                    </td>
                                    <td className={`px-5 py-3 font-medium whitespace-nowrap ${isOverdue ? 'text-[#f87171]' : 'text-[color:var(--muted)]'}`}>
                                        {isCompletedList 
                                            ? (task.resolutiondate ? new Date(task.resolutiondate).toLocaleDateString('en-GB') : '-') 
                                            : (task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : '-')}
                                        {isOverdue && <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/30">OVERDUE</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {taskList.length === 0 && <div className="p-12 text-center text-[color:var(--muted)] font-medium">No tasks in this list.</div>}
            </div>
        </div>
    );

    return (
        <div className={`fixed inset-0 z-50 transition-opacity ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} font-sans`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${isOpen ? 'bg-opacity-60 backdrop-blur-sm' : 'bg-opacity-0'}`} onClick={onClose}></div>
            
            <div className={`fixed top-0 right-0 h-full bg-[color:var(--bg)] border-l border-[color:var(--border)] w-full max-w-4xl shadow-2xl transition-transform transform ease-in-out duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className="flex items-center justify-between p-6 border-b border-[color:var(--border)] bg-[color:var(--surface)] flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[color:var(--bg)] font-syne font-bold text-xl shadow-inner">
                            {assigneeName ? assigneeName.substring(0, 2).toUpperCase() : '?'}
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-[color:var(--text)] font-syne tracking-tight leading-none">{assigneeName}</h3>
                            <p className="text-sm text-[color:var(--muted)] font-medium mt-1">Personal Workload Dashboard</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--accent2)] hover:bg-[color:var(--alert-bg)] rounded-full transition-colors"><X className="w-6 h-6" /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    
                    {/* 🌟 METRICS CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#60a5fa]/10 text-[#60a5fa] flex items-center justify-center border border-[#60a5fa]/20"><LayoutList size={20} /></div>
                            <div>
                                <p className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider">Active</p>
                                <p className="text-2xl font-black font-syne text-[#60a5fa]">{insights.activeTasks.length}</p>
                            </div>
                        </div>
                        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#64748b]/10 text-[#64748b] flex items-center justify-center border border-[#64748b]/20"><PauseCircle size={20} /></div>
                            <div>
                                <p className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider">On Hold</p>
                                <p className="text-2xl font-black font-syne text-[#64748b]">{insights.holdTasks.length}</p>
                            </div>
                        </div>
                        <div className={`bg-[color:var(--surface)] border rounded-2xl p-5 shadow-sm flex items-center gap-4 ${insights.overdueCount > 0 ? 'border-[#f87171]/50 bg-[#f87171]/5' : 'border-[color:var(--border)]'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${insights.overdueCount > 0 ? 'bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30' : 'bg-[color:var(--surface2)] text-[color:var(--muted)] border-[color:var(--border)]'}`}><AlertCircle size={20} /></div>
                            <div>
                                <p className={`text-xs font-bold uppercase tracking-wider ${insights.overdueCount > 0 ? 'text-[#f87171]' : 'text-[color:var(--muted)]'}`}>Overdue (Active)</p>
                                <p className={`text-2xl font-black font-syne ${insights.overdueCount > 0 ? 'text-[#f87171]' : 'text-[color:var(--text)]'}`}>{insights.overdueCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* 🌟 CHARTS (FOCUS AREAS) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Chart 1: BI Category */}
                        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
                            <h4 className="text-sm font-bold text-[color:var(--text)] uppercase tracking-widest flex items-center gap-2 mb-4 font-syne">
                                <Briefcase size={16} className="text-[color:var(--accent3)]" /> Task Type Distribution
                            </h4>
                            <div className="flex-1 min-h-[220px] relative">
                                {insights.catData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={insights.catData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                                                {insights.catData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-[color:var(--muted)] text-sm">No data</div>
                                )}
                            </div>
                            <div className="mt-2 space-y-2 max-h-24 overflow-y-auto scrollbar-hide">
                                {insights.catData.map(d => (
                                    <div key={d.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 truncate pr-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: d.color}}></span><span className="text-[color:var(--text)] truncate">{d.name}</span></div>
                                        <span className="font-bold text-[color:var(--muted)]">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chart 2: Department */}
                        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 shadow-sm flex flex-col">
                            <h4 className="text-sm font-bold text-[color:var(--text)] uppercase tracking-widest flex items-center gap-2 mb-4 font-syne">
                                <Users size={16} className="text-[#c084fc]" /> Department Support
                            </h4>
                            <div className="flex-1 min-h-[220px] relative">
                                {insights.deptData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={insights.deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                                                {insights.deptData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-[color:var(--muted)] text-sm">No data</div>
                                )}
                            </div>
                            <div className="mt-2 space-y-2 max-h-24 overflow-y-auto scrollbar-hide">
                                {insights.deptData.map(d => (
                                    <div key={d.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 truncate pr-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: d.color}}></span><span className="text-[color:var(--text)] truncate">{d.name}</span></div>
                                        <span className="font-bold text-[color:var(--muted)]">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 🌟 TASK LIST WITH TABS */}
                    <div className="pt-4">
                        <div className="flex items-center space-x-2 bg-[color:var(--surface2)] border border-[color:var(--border)] p-1 rounded-xl w-max shadow-inner">
                            <button 
                                onClick={() => setActiveTab('active')} 
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'active' ? 'bg-[color:var(--surface)] text-[#60a5fa] shadow border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}
                            >
                                <LayoutList size={16} /> Active ({insights.activeTasks.length})
                            </button>
                            <button 
                                onClick={() => setActiveTab('hold')} 
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'hold' ? 'bg-[color:var(--surface)] text-[#64748b] shadow border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}
                            >
                                <PauseCircle size={16} /> Hold ({insights.holdTasks.length})
                            </button>
                            <button 
                                onClick={() => setActiveTab('completed')} 
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'completed' ? 'bg-[color:var(--surface)] text-[#4ade80] shadow border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}
                            >
                                <CheckCircle2 size={16} /> Done ({insights.completedTasks.length})
                            </button>
                        </div>

                        {activeTab === 'active' && renderTable(insights.activeTasks, false)}
                        {activeTab === 'hold' && renderTable(insights.holdTasks, false)}
                        {activeTab === 'completed' && renderTable(insights.completedTasks, true)}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default React.memo(AssigneeChartDrawer);