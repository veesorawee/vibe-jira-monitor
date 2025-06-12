import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import { parseDate, formatDateFull } from '../utils/helpers';

const AssigneeChartDrawer = ({ isOpen, onClose, assigneeName, tasks, departmentColors, biCategoryColors, onTaskClick }) => {
    const [stackBy, setStackBy] = useState('department');

    const chartData = useMemo(() => {
        if (!tasks || tasks.length === 0) return { data: [], keys: [], colors: {} };
        const getMonday = (d) => {
            d = new Date(d);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            return monday;
        };
        const allDates = tasks.map(t => parseDate(t.startDate)).filter(Boolean);
        if (allDates.length === 0) return { data: [], keys: [], colors: {} };
        const minDate = new Date(Math.min.apply(null, allDates));
        const maxDate = new Date(Math.max.apply(null, allDates));
        const stackByKey = stackBy === 'department' ? 'department' : 'biCategory';
        const stackColors = stackBy === 'department' ? departmentColors : biCategoryColors;
        const uniqueStackKeys = [...new Set(tasks.map(t => t[stackByKey] || 'N/A'))].sort();
        const weeklyBuckets = new Map();
        let currentMonday = getMonday(minDate);
        while (currentMonday <= maxDate) {
            const weekKey = currentMonday.toISOString().split('T')[0];
            const dataPoint = { name: formatDateFull(new Date(weekKey)) };
            uniqueStackKeys.forEach(key => { dataPoint[key] = 0; });
            weeklyBuckets.set(weekKey, dataPoint);
            currentMonday.setDate(currentMonday.getDate() + 7);
        }
        tasks.forEach(task => {
            const startDate = parseDate(task.startDate);
            if (!startDate) return;
            const weekKey = getMonday(startDate).toISOString().split('T')[0];
            if (weeklyBuckets.has(weekKey)) {
                const category = task[stackByKey] || 'N/A';
                if (uniqueStackKeys.includes(category)) {
                   weeklyBuckets.get(weekKey)[category]++;
                }
            }
        });
        const data = Array.from(weeklyBuckets.values());
        return { data, keys: uniqueStackKeys, colors: stackColors };
    }, [tasks, stackBy, departmentColors, biCategoryColors]);

    return (
        <div className={`fixed inset-0 z-50 transition-opacity ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full bg-white w-full max-w-4xl shadow-xl transition-transform transform ease-in-out duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                    <h3 className="text-lg font-semibold truncate" title={assigneeName}>{assigneeName}'s Task Summary</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto">
                    <div className="flex justify-center">
                        <div className="bg-gray-100 p-1 rounded-lg shadow-inner inline-flex items-center">
                            <button onClick={() => setStackBy('department')} className={`px-3 py-1 rounded-md transition-colors text-sm ${stackBy === 'department' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>By Department</button>
                            <button onClick={() => setStackBy('biCategory')} className={`px-3 py-1 rounded-md transition-colors text-sm ${stackBy === 'biCategory' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>By BI Category</button>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            {chartData.keys.map(key => (
                                <Bar key={key} dataKey={key} stackId="a" fill={chartData.colors[key] || '#cccccc'} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="border-t pt-4">
                        <h4 className="text-md font-semibold mb-2">Task List ({tasks.length})</h4>
                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-200 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Task Key</th>
                                        <th className="px-4 py-2">Create Date</th>
                                        <th className="px-4 py-2">Due Date</th>
                                        <th className="px-4 py-2">BI Category</th>
                                        <th className="px-4 py-2">Story Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks.sort((a,b) => parseDate(a.startDate) - parseDate(b.startDate)).map(task => (
                                        <tr key={task.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => onTaskClick(task)}>
                                            <td className="px-4 py-2 font-mono">{task.id}</td>
                                            <td className="px-4 py-2">{task.startDate}</td>
                                            <td className="px-4 py-2">{task.dueDate || 'N/A'}</td>
                                            <td className="px-4 py-2">{task.biCategory}</td>
                                            <td className="px-4 py-2 text-center">{task.storyPoints || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssigneeChartDrawer;