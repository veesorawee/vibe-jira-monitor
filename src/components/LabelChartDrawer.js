import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Sankey, Layer, Rectangle } from 'recharts';
import { X, Network } from 'lucide-react';
import { parseDate, formatDateFull, formatAssigneeName } from '../utils/helpers';

// 🚀 1. กำหนดหมวดหมู่หลัก และ ชื่อย่อสำหรับแสดงผล
const FOCUS_CATEGORIES = [
    'Product Spec. Tracking [D]',
    'Product Analysis [D]',
    'Product Report/Ad-Hoc [D]',
    'Product Investigation [D]',
    'Initiation/Idea [D]'
];

const CATEGORY_DISPLAY_MAP = {
    'Product Spec. Tracking [D]': 'Spec',
    'Product Analysis [D]': 'Analysis',
    'Product Report/Ad-Hoc [D]': 'Report',
    'Product Investigation [D]': 'Investigate',
    'Initiation/Idea [D]': 'Idea',
    'Other': 'Other'
};

const LabelChartDrawer = ({ isOpen, onClose, labelName, tasks, biCategoryColors, assigneeColors, departmentColors, onTaskClick }) => {
    const [stackBy, setStackBy] = useState('total');

    const chartData = useMemo(() => {
        if (!tasks || tasks.length === 0) return { data: [], keys: [], colors: {} };
        const getMonday = (d) => { d = new Date(d); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const monday = new Date(d.setDate(diff)); monday.setHours(0, 0, 0, 0); return monday; };
        const allDates = tasks.map(t => parseDate(t.startDate || t.created)).filter(Boolean);
        if (allDates.length === 0) return { data: [], keys: [], colors: {} };
        
        const minDate = new Date(Math.min.apply(null, allDates)); const maxDate = new Date(Math.max.apply(null, allDates));
        
        // Map category ลง Bar Chart ด้วย
        const uniqueBiCategories = [...new Set(tasks.map(t => FOCUS_CATEGORIES.includes(t.biCategory) ? t.biCategory : 'Other'))].sort();
        
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
                if (stackBy === 'total') { 
                    weeklyBuckets.get(weekKey)['Total']++; 
                } else { 
                    const category = FOCUS_CATEGORIES.includes(task.biCategory) ? task.biCategory : 'Other'; 
                    if (uniqueBiCategories.includes(category)) { weeklyBuckets.get(weekKey)[category]++; } 
                }
            }
        });
        
        const data = Array.from(weeklyBuckets.values());
        const keys = stackBy === 'total' ? ['Total'] : uniqueBiCategories;
        const colors = stackBy === 'total' ? { 'Total': 'var(--accent)' } : biCategoryColors;
        return { data, keys, colors };
    }, [tasks, stackBy, biCategoryColors]);

    const sankeyData = useMemo(() => {
        if (!tasks || tasks.length === 0) return null;

        const depts = {};
        const categories = {};
        const catToAsg = {}; 
        const deptToCat = {};

        tasks.forEach(t => {
            const dept = t.department || 'Unknown Dept';
            const assignee = t.assignee || 'Unassigned';

            // ยุบ Category
            const rawCat = t.biCategory || 'Uncategorized';
            const cat = FOCUS_CATEGORIES.includes(rawCat) ? rawCat : 'Other';

            depts[dept] = (depts[dept] || 0) + 1;
            categories[cat] = (categories[cat] || 0) + 1;
            
            const link1 = `${dept}|${cat}`;
            deptToCat[link1] = (deptToCat[link1] || 0) + 1;

            const link2 = `${cat}|${assignee}`;
            catToAsg[link2] = (catToAsg[link2] || 0) + 1; 
        });

        const nodes = [];
        const nodeMap = {};
        let nodeIndex = 0;

        const addNode = (name, color) => {
            if (nodeMap[name] === undefined) {
                nodes.push({ name, color });
                nodeMap[name] = nodeIndex++;
            }
        };

        const reqNodeName = `Req: ${labelName}`;

        addNode(reqNodeName, 'var(--accent)');
        
        // 🚀 เรียงลำดับ Node ให้เส้นที่ใหญ่สุดอยู่ข้างบน
        const sortDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(e => e[0]);

        sortDesc(depts).forEach(dept => addNode(`Dept: ${dept}`, departmentColors?.[dept] || '#f472b6'));
        sortDesc(categories).forEach(cat => addNode(`Cat: ${cat}`, cat === 'Other' ? '#94a3b8' : (biCategoryColors?.[cat] || '#8884d8')));
        
        // สำหรับ Assignee (ขวาสุด) ถ้าเรียงตาม count ของ catToAsg
        const assigneeCounts = {};
        Object.entries(catToAsg).forEach(([key, val]) => {
            const asg = key.split('|')[1];
            assigneeCounts[asg] = (assigneeCounts[asg] || 0) + val;
        });
        sortDesc(assigneeCounts).forEach(assignee => addNode(`Asg: ${assignee}`, assigneeColors?.[assignee] || '#82ca9d'));

        const links = [];

        Object.entries(depts).forEach(([dept, val]) => {
            links.push({ source: nodeMap[reqNodeName], target: nodeMap[`Dept: ${dept}`], value: val });
        });

        Object.entries(deptToCat).forEach(([key, val]) => {
            const [dept, cat] = key.split('|');
            links.push({ source: nodeMap[`Dept: ${dept}`], target: nodeMap[`Cat: ${cat}`], value: val });
        });

        Object.entries(catToAsg).forEach(([key, val]) => {
            const [cat, assignee] = key.split('|');
            links.push({ source: nodeMap[`Cat: ${cat}`], target: nodeMap[`Asg: ${assignee}`], value: val });
        });

        return { nodes, links };
    }, [tasks, labelName, biCategoryColors, assigneeColors, departmentColors]);

    const CustomSankeyNode = ({ x, y, width, height, index, payload }) => {
        const isReq = payload.name.startsWith('Req:');
        const isAsg = payload.name.startsWith('Asg:');

        let rawName = payload.name.replace(/^(Dept|Req|Cat|Asg): /, '');
        const isCat = payload.name.startsWith('Cat:');
        let displayName = isCat ? (CATEGORY_DISPLAY_MAP[rawName] || rawName) : rawName;

        let textAnchor = 'start';
        let xPos = 0;
        let yPos = y + height / 2;
        let dy = 4;

        if (isReq) {
            textAnchor = 'start'; xPos = x + width + 8;
        } else if (isAsg) {
            textAnchor = 'end'; xPos = x - 8;
        } else {
            textAnchor = 'middle'; xPos = x + width / 2; yPos = y - 8; dy = 0;
        }

        return (
            <Layer key={`CustomNode${index}`}>
                <Rectangle x={x} y={y} width={width} height={height} fill={payload.color || 'var(--accent)'} fillOpacity="1" rx={2} />
                <text 
                    textAnchor={textAnchor} x={xPos} y={yPos} dy={dy} 
                    fontSize="11" fill="var(--text)" fontWeight="600" className="font-sans"
                    style={{ textShadow: '0px 2px 4px rgba(0,0,0,0.8)' }}
                >
                    {displayName} ({payload.value})
                </text>
            </Layer>
        );
    };

    return (
        <div className={`fixed inset-0 z-50 transition-opacity ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} font-sans`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${isOpen ? 'bg-opacity-50 backdrop-blur-sm' : 'bg-opacity-0'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full bg-[color:var(--bg)] border-l border-[color:var(--border)] w-full max-w-6xl shadow-2xl transition-transform transform ease-in-out duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                 <div className="flex items-center justify-between p-5 border-b border-[color:var(--border)] bg-[color:var(--surface)] flex-shrink-0">
                     <div>
                         <h3 className="text-xl font-bold text-[color:var(--text)] truncate font-syne" title={labelName}>
                             Insight for Requester: <span className="text-[color:var(--accent)]">{labelName}</span>
                         </h3>
                         <p className="text-xs text-[color:var(--muted)] mt-1 font-medium">Total {tasks.length} tasks requested</p>
                     </div>
                     <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--accent2)] bg-[color:var(--surface2)] rounded-full transition-colors"><X className="w-5 h-5" /></button>
                 </div>
                 
                 <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    
                    {sankeyData && sankeyData.nodes.length > 1 && (
                        <div className="bg-[color:var(--surface)] p-6 rounded-3xl border border-[color:var(--border)] shadow-sm">
                            <h4 className="text-sm font-bold text-[color:var(--text)] mb-6 font-syne flex items-center gap-2 uppercase tracking-widest">
                                <Network size={16} className="text-[color:var(--accent3)]" /> 
                                Task Assignment Flow
                            </h4>
                            
                            <div className="flex justify-between text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-widest mb-4 px-2">
                                <span className="w-1/4 text-left">1. Requester</span>
                                <span className="w-1/4 text-center pr-8">2. Department</span>
                                <span className="w-1/4 text-center pl-8">3. Task Type</span>
                                <span className="w-1/4 text-right">4. Assignee</span>
                            </div>

                            <div className="h-[350px] w-full mt-2 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <Sankey
                                        data={sankeyData}
                                        node={<CustomSankeyNode />}
                                        nodePadding={30}
                                        nodeWidth={12}
                                        margin={{ left: 10, right: 10, top: 20, bottom: 20 }}
                                        link={{ stroke: 'var(--muted)', strokeOpacity: 0.45 }} // 🚀 เส้นสีเทา ทึบขึ้น
                                    >
                                        <RechartsTooltip 
                                            content={({ payload }) => {
                                                if (payload && payload.length) {
                                                    const data = payload[0];
                                                    let rawName = data.name.replace(/^(Dept|Req|Cat|Asg): /, '');
                                                    const cleanName = data.name.startsWith('Cat:') ? (CATEGORY_DISPLAY_MAP[rawName] || rawName) : rawName;
                                                    return (
                                                        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] p-3 rounded-xl shadow-lg font-sans text-sm">
                                                            <p className="font-bold text-[color:var(--text)]">{cleanName}</p>
                                                            <p className="text-[color:var(--muted)] mt-1">Flow Count: <span className="font-bold text-[color:var(--text)]">{data.value} tasks</span></p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                    </Sankey>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* กราฟแท่ง Timeline แบบเดิม */}
                    <div className="bg-[color:var(--surface)] p-6 rounded-3xl border border-[color:var(--border)] shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-sm font-bold text-[color:var(--text)] font-syne uppercase tracking-widest">Task Timeline</h4>
                            <div className="bg-[color:var(--surface2)] border border-[color:var(--border)] p-1 rounded-xl shadow-inner inline-flex items-center">
                                <button onClick={() => setStackBy('total')} className={`px-4 py-2 rounded-lg transition-colors text-sm font-bold ${stackBy === 'total' ? 'bg-[color:var(--surface)] text-[color:var(--accent)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>Total</button>
                                <button onClick={() => setStackBy('biCategory')} className={`px-4 py-2 rounded-lg transition-colors text-sm font-bold ${stackBy === 'biCategory' ? 'bg-[color:var(--surface)] text-[color:var(--accent)] shadow' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>By Category</button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={chartData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="name" tick={{fill: 'var(--muted)', fontSize: 11}} axisLine={false} tickLine={false} dy={10} />
                                <YAxis allowDecimals={false} tick={{fill: 'var(--muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{fill: 'var(--surface2)'}} contentStyle={{backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', borderRadius: '12px'}} />
                                <Legend wrapperStyle={{paddingTop: '20px', fontSize: '12px'}} iconType="circle" />
                                {chartData.keys.map(key => (
                                    <Bar key={key} dataKey={key} stackId="a" fill={key === 'Other' ? '#94a3b8' : (chartData.colors[key] || 'var(--muted)')} radius={[4, 4, 0, 0]} maxBarSize={40} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ตาราง Task List แบบเดิม */}
                    <div>
                        <h4 className="text-sm font-bold text-[color:var(--text)] mb-4 font-syne uppercase tracking-widest">Task List</h4>
                        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl overflow-hidden shadow-sm">
                            <div className="max-h-64 overflow-y-auto w-full scrollbar-hide">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] sticky top-0 uppercase tracking-wider text-xs font-bold z-10">
                                        <tr>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Task Key</th>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Assignee</th>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Create Date</th>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">Due Date</th>
                                            <th className="px-5 py-3 border-b border-[color:var(--border)]">BI Category</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--border)]">
                                        {tasks.sort((a,b) => parseDate(b.created || b.startDate) - parseDate(a.created || a.startDate)).map(task => (
                                            <tr key={task.id} className="hover:bg-[color:var(--surface2)] cursor-pointer transition-colors text-[color:var(--text)]" onClick={() => onTaskClick(task)}>
                                                <td className="px-5 py-3 font-bold text-[color:var(--accent3)] whitespace-nowrap">{task.id}</td>
                                                <td className="px-5 py-3 font-medium whitespace-nowrap flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: assigneeColors?.[task.assignee] || '#ccc'}}></span>
                                                    {formatAssigneeName(task.assignee, task.assigneeEmail)}
                                                </td>
                                                <td className="px-5 py-3 font-medium whitespace-nowrap">{task.created ? new Date(task.created).toLocaleDateString('en-GB') : (task.startDate || '-')}</td>
                                                <td className="px-5 py-3 font-medium whitespace-nowrap">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : '-'}</td>
                                                <td className="px-5 py-3 font-medium whitespace-nowrap">{task.biCategory}</td>
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