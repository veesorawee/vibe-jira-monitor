import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import { parseDate, formatDateFull } from '../utils/helpers';

const LabelChartDrawer = ({ isOpen, onClose, labelName, tasks, biCategoryColors, onTaskClick }) => {
    const [stackBy, setStackBy] = useState('total');

    const chartData = useMemo(() => {
        if (!tasks || tasks.length === 0) return { data: [], keys: [], colors: {} };
        const getMonday = (d) => { d = new Date(d); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const monday = new Date(d.setDate(diff)); monday.setHours(0, 0, 0, 0); return monday; };
        const allDates = tasks.map(t => parseDate(t.startDate || t.created)).filter(Boolean);
        if (allDates.length === 0) return { data: [], keys: [], colors: {} };
        const minDate = new Date(Math.min.apply(null, allDates)); const maxDate = new Date(Math.max.apply(null, allDates));
        const uniqueBiCategories = [...new Set(tasks.map(t => t.biCategory || 'N/A'))].sort();
        const weeklyBuckets = new Map();
        let currentMonday = getMonday(minDate);
        while (currentMonday <= maxDate) {
            const weekKey = currentMonday.toISOString().split('T')[0];
            const dataPoint = { name: formatDateFull(new Date(weekKey)) };
            if (stackBy === 'total') { dataPoint['Total'] = 0; } else { uniqueBiCategories.forEach(cat => { dataPoint[cat] = 0; }); }
            weeklyBuckets.set(weekKey, dataPoint);
            currentMonday.setDate(currentMonday.getDate() + 7);
        }
        tasks.forEach(task => {
            const startDate = parseDate(task.startDate || task.created);
            if (!startDate) return;
            const weekKey = getMonday(startDate).toISOString().split('T')[0];
            if (weeklyBuckets.has(weekKey)) {
                if (stackBy === 'total') { weeklyBuckets.get(weekKey)['Total']++; } 
                else { const category = task.biCategory || 'N/A'; if (uniqueBiCategories.includes(category)) { weeklyBuckets.get(weekKey)[category]++; } }
            }
        });
        const data = Array.from(weeklyBuckets.values());
        const keys = stackBy === 'total' ? ['Total'] : uniqueBiCategories;
        const colors = stackBy === 'total' ? { 'Total': 'var(--accent)' } : biCategoryColors;
        return { data, keys, colors };
    }, [tasks, stackBy, biCategoryColors]);

    return (
        <div className={`fixed inset-0 z-50 transition-opacity ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} font-sans`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${isOpen ? 'bg-opacity-50 backdrop-blur-sm' : 'bg-opacity-0'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full bg-[color:var(--bg)] border-l border-[color:var(--border)] w-full max-w-4xl shadow-2xl transition-transform transform ease-in-out duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                 <div className="flex items-center justify-between p-5 border-b border-[color:var(--border)] bg-[color:var(--surface)] flex-shrink-0">
                     <h3 className="text-xl font-bold text-[color:var(--text)] truncate font-syne" title={labelName}>Task Summary for: <span className="text-[color:var(--accent)]">{labelName}</span></h3>
                     <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--accent2)] bg-[color:var(--surface2)] rounded-full transition-colors"><X className="w-5 h-5" /></button>
                 </div>
                 <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="flex justify-center">
                        <div className="bg-[color:var(--surface2)] border border-[color:var(--border)] p-1 rounded-xl shadow-inner inline-flex items-center">
                            <button onClick={() => setStackBy('total')} className={`px-4 py-2 rounded-lg transition-colors text-sm font-bold ${stackBy === 'total' ? 'bg-[color:var(--surface)] text-[color:var(--accent)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>Total</button>
                            <button onClick={() => setStackBy('biCategory')} className={`px-4 py-2 rounded-lg transition-colors text-sm font-bold ${stackBy === 'biCategory' ? 'bg-[color:var(--surface)] text-[color:var(--accent)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>By BI Category</button>
                        </div>
                    </div>
                    <div className="bg-[color:var(--surface)] p-6 rounded-3xl border border-[color:var(--border)]">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="name" tick={{fill: 'var(--muted)'}} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{fill: 'var(--muted)'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'var(--surface2)'}} contentStyle={{backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', borderRadius: '12px'}} />
                                <Legend wrapperStyle={{paddingTop: '20px'}} />
                                {chartData.keys.map(key => (
                                    <Bar key={key} dataKey={key} stackId="a" fill={chartData.colors[key] || 'var(--muted)'} radius={[4, 4, 0, 0]} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="border-t border-[color:var(--border)] pt-6">
                        <h4 className="text-lg font-bold text-[color:var(--text)] mb-4 font-syne">Task List ({tasks.length})</h4>
                        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl overflow-hidden">
                            <div className="max-h-64 overflow-y-auto w-full">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] sticky top-0 uppercase tracking-wider text-xs font-bold">
                                        <tr>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Task Key</th>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Create Date</th>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Due Date</th>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">BI Category</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--border)]">
                                        {tasks.sort((a,b) => parseDate(a.created || a.startDate) - parseDate(b.created || b.startDate)).map(task => (
                                            <tr key={task.id} className="hover:bg-[color:var(--surface2)] cursor-pointer transition-colors text-[color:var(--text)]" onClick={() => onTaskClick(task)}>
                                                <td className="px-5 py-3 font-bold text-[color:var(--accent3)]">{task.id}</td>
                                                <td className="px-5 py-3 font-medium">{task.created ? new Date(task.created).toLocaleDateString('en-GB') : (task.startDate || '-')}</td>
                                                <td className="px-5 py-3 font-medium">{task.dueDate || 'N/A'}</td>
                                                <td className="px-5 py-3 font-medium">{task.biCategory}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {tasks.length === 0 && <div className="p-8 text-center text-[color:var(--muted)]">No tasks available.</div>}
                            </div>
                        </div>
                    </div>
                 </div>
             </div>
         </div>
    );
};

export default LabelChartDrawer;