import React, { useMemo } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseDate } from '../utils/helpers';

export default function ManagerDashboard({ tasks, openDrawer, assigneeColors, uniqueAssignees = [], openAssigneeDrawer }) {
  // ... (ฟังก์ชัน insights และ const ต่างๆ เหมือนเดิมทุกอย่าง)
  const insights = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeTasksList = [];
    const createdTodayList = [];
    const resolvedTodayList = [];
    const overdueTasksList = [];
    const highPriorityTasksList = [];
    const staleTasksList = [];

    const assignees = {};
    const departments = {};
    const categories = {};

    uniqueAssignees.forEach(person => {
        if (person !== 'Unassigned') assignees[person] = { name: person, tasks: [], overdue: 0 };
    });

    tasks.forEach(task => {
      const s = (task.status || '').toLowerCase();
      const isDone = s.includes('done') || s.includes('cancel');
      
      const createdDate = task.created ? new Date(task.created) : parseDate(task.startDate);
      const resolvedDate = isDone ? (task.resolutiondate ? new Date(task.resolutiondate) : parseDate(task.lastUpdated)) : null;
      const dueDate = parseDate(task.dueDate);

      if (createdDate && createdDate >= todayStart && createdDate <= todayEnd) createdTodayList.push(task);
      if (isDone && resolvedDate && resolvedDate >= todayStart && resolvedDate <= todayEnd) resolvedTodayList.push(task);

      if (!isDone) {
        activeTasksList.push(task);
        
        let isTaskOverdue = false;
        if (dueDate && dueDate < todayStart) {
            overdueTasksList.push(task);
            isTaskOverdue = true;
        }
        if (new Date(task.lastUpdated) < sevenDaysAgo) staleTasksList.push(task);
        if (task.priority === 'Highest' || task.priority === 'High') highPriorityTasksList.push(task);

        const person = task.assignee || 'Unassigned';
        if (!assignees[person]) assignees[person] = { name: person, tasks: [], overdue: 0 };
        assignees[person].tasks.push(task);
        if (isTaskOverdue) assignees[person].overdue++;

        const dept = task.department || 'Unknown Dept';
        if (!departments[dept]) departments[dept] = { name: dept, tasks: [] };
        departments[dept].tasks.push(task);

        const cat = task.biCategory || 'Uncategorized';
        if (!categories[cat]) categories[cat] = { name: cat, tasks: [] };
        categories[cat].tasks.push(task);
      }
    });

    const chartData = [];
    const chartStartDate = new Date(todayStart);
    chartStartDate.setDate(chartStartDate.getDate() - 30);

    for (let d = new Date(chartStartDate); d <= todayStart; d.setDate(d.getDate() + 1)) {
        const currentIterStart = new Date(d); currentIterStart.setHours(0,0,0,0);
        const currentIterEnd = new Date(d); currentIterEnd.setHours(23,59,59,999);

        let created = 0, resolved = 0, netActive = 0, netOverdue = 0;

        tasks.forEach(task => {
            const isFinished = (task.status || '').toLowerCase().includes('done') || (task.status || '').toLowerCase().includes('cancel');
            
            const cDate = task.created ? new Date(task.created) : parseDate(task.startDate);
            const rDate = isFinished ? (task.resolutiondate ? new Date(task.resolutiondate) : parseDate(task.lastUpdated)) : null;
            const dDate = parseDate(task.dueDate);

            if (cDate && cDate >= currentIterStart && cDate <= currentIterEnd) created++;
            if (isFinished && rDate && rDate >= currentIterStart && rDate <= currentIterEnd) resolved++;

            if (cDate && cDate <= currentIterEnd) {
                if (!isFinished || (rDate && rDate > currentIterEnd)) {
                    netActive++;
                    if (dDate && dDate < currentIterStart) netOverdue++;
                }
            }
        });

        chartData.push({
            displayDate: currentIterStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            'Created': created,
            'Resolved': resolved,
            'Net Active': netActive,
            'Net Overdue': netOverdue
        });
    }

    return { 
      activeTasksList, createdTodayList, resolvedTodayList, overdueTasksList, staleTasksList, highPriorityTasksList,
      assignees: Object.values(assignees).sort((a, b) => b.tasks.length - a.tasks.length), 
      departments: Object.values(departments).sort((a, b) => b.tasks.length - a.tasks.length).slice(0, 5), 
      categories: Object.values(categories).sort((a, b) => b.tasks.length - a.tasks.length).slice(0, 5),
      chartData
    };
  }, [tasks, uniqueAssignees]);

  const getInitials = (name) => {
    if (!name || name === 'Unassigned') return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const getShortName = (name) => {
    if (!name || name === 'Unassigned') return 'Unassigned';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : name;
  };

  const colorMap = {
      active: 'var(--accent)',       
      overdue: 'var(--accent2)',     
      created: 'var(--accent3)',     
      resolved: 'var(--accent4)',    
      priority: '#c084fc',           
      stale: '#9ca3af'               
  };

  return (
    <div className="w-full">
      <div className="font-syne mt-2 mb-6">
        <h1 className="text-4xl font-extrabold text-[color:var(--text)] m-0">Overview <span className="text-[color:var(--accent)]">Dashboard</span></h1>
        <p className="text-[color:var(--muted)] mt-1 font-sans text-sm font-medium">Live tracking of active workload and task distributions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        <div className="lg:col-span-2 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-3xl p-6 shadow-sm flex flex-col h-full min-h-[400px]">
            <h3 className="text-sm font-syne uppercase tracking-widest text-[color:var(--text)] font-bold mb-6">30-Day Trend Overview</h3>
            <div className="flex-1 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={insights.chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="displayDate" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)' }} dy={10} />
                        <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)' }} />
                        <Tooltip cursor={{fill: 'var(--surface2)'}} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} itemStyle={{ color: 'var(--text)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} />
                        <Line type="monotone" dataKey="Created" name="Created (New)" stroke={colorMap.created} strokeWidth={2.5} dot={false} activeDot={{r: 4, strokeWidth: 0}} />
                        <Line type="monotone" dataKey="Resolved" name="Resolved (Done/Cancel)" stroke={colorMap.resolved} strokeWidth={2.5} dot={false} activeDot={{r: 4, strokeWidth: 0}} />
                        <Line type="monotone" dataKey="Net Active" name="Net Active (Open)" stroke={colorMap.active} strokeWidth={2.5} dot={false} activeDot={{r: 4, strokeWidth: 0}} />
                        <Line type="monotone" dataKey="Net Overdue" name="Net Overdue" stroke={colorMap.overdue} strokeWidth={2.5} dot={false} activeDot={{r: 4, strokeWidth: 0}} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="lg:col-span-1 grid grid-cols-2 gap-4 h-full">
            <div onClick={() => openDrawer && openDrawer('Net Active Tasks', insights.activeTasksList)} className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 relative overflow-hidden transition-transform hover:-translate-y-1 cursor-pointer hover:shadow-lg group flex flex-col justify-center">
                <div className="absolute top-0 left-0 right-0 h-1" style={{backgroundColor: colorMap.active}}></div>
                <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold mb-2 group-hover:text-[color:var(--text)] transition-colors">Net Active</div>
                <div className="text-4xl font-syne font-black mb-1" style={{color: colorMap.active}}>{insights.activeTasksList.length}</div>
                <div className="text-xs text-[color:var(--muted)] line-clamp-1">งานเปิดอยู่ทั้งหมด</div>
            </div>
            <div onClick={() => openDrawer && openDrawer('Net Overdue Tasks', insights.overdueTasksList)} className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 relative overflow-hidden transition-transform hover:-translate-y-1 cursor-pointer hover:shadow-lg group flex flex-col justify-center">
                <div className="absolute top-0 left-0 right-0 h-1" style={{backgroundColor: colorMap.overdue}}></div>
                <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold mb-2 group-hover:text-[color:var(--text)] transition-colors">Net Overdue</div>
                <div className="text-4xl font-syne font-black mb-1" style={{color: colorMap.overdue}}>{insights.overdueTasksList.length}</div>
                <div className="text-xs text-[color:var(--accent2)] font-medium line-clamp-1">งานที่ไฟไหม้</div>
            </div>
            <div onClick={() => openDrawer && openDrawer('Created Today', insights.createdTodayList)} className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 relative overflow-hidden transition-transform hover:-translate-y-1 cursor-pointer hover:shadow-lg group flex flex-col justify-center">
                <div className="absolute top-0 left-0 right-0 h-1" style={{backgroundColor: colorMap.created}}></div>
                <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold mb-2 group-hover:text-[color:var(--text)] transition-colors">Created Today</div>
                <div className="text-4xl font-syne font-black mb-1" style={{color: colorMap.created}}>{insights.createdTodayList.length}</div>
                <div className="text-xs text-[color:var(--muted)] line-clamp-1">งานเข้านี้</div>
            </div>
            <div onClick={() => openDrawer && openDrawer('Resolved Today', insights.resolvedTodayList)} className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 relative overflow-hidden transition-transform hover:-translate-y-1 cursor-pointer hover:shadow-lg group flex flex-col justify-center">
                <div className="absolute top-0 left-0 right-0 h-1" style={{backgroundColor: colorMap.resolved}}></div>
                <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold mb-2 group-hover:text-[color:var(--text)] transition-colors">Resolved Today</div>
                <div className="text-4xl font-syne font-black mb-1" style={{color: colorMap.resolved}}>{insights.resolvedTodayList.length}</div>
                <div className="text-xs text-[color:var(--muted)] line-clamp-1">เคลียร์จบวันนี้</div>
            </div>
            <div onClick={() => openDrawer && openDrawer('High Priority (Active)', insights.highPriorityTasksList)} className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 relative overflow-hidden transition-transform hover:-translate-y-1 cursor-pointer hover:shadow-lg group flex flex-col justify-center">
                <div className="absolute top-0 left-0 right-0 h-1" style={{backgroundColor: colorMap.priority}}></div>
                <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold mb-2 group-hover:text-[color:var(--text)] transition-colors">High Priority</div>
                <div className="text-4xl font-syne font-black mb-1" style={{color: colorMap.priority}}>{insights.highPriorityTasksList.length}</div>
                <div className="text-xs text-[color:var(--muted)] line-clamp-1">ความสำคัญสูงสุด</div>
            </div>
            <div onClick={() => openDrawer && openDrawer('Stale Tasks (> 7 Days)', insights.staleTasksList)} className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-5 relative overflow-hidden transition-transform hover:-translate-y-1 cursor-pointer hover:shadow-lg group flex flex-col justify-center">
                <div className="absolute top-0 left-0 right-0 h-1" style={{backgroundColor: colorMap.stale}}></div>
                <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold mb-2 group-hover:text-[color:var(--text)] transition-colors">Stale (&gt; 7D)</div>
                <div className="text-4xl font-syne font-black mb-1" style={{color: colorMap.stale}}>{insights.staleTasksList.length}</div>
                <div className="text-xs text-[color:var(--muted)] line-clamp-1">นิ่งเกินสัปดาห์</div>
            </div>
        </div>

      </div>

      <h2 className="text-sm font-syne uppercase tracking-widest font-bold text-[color:var(--muted)] mt-10 mb-5">Current Workload by Assignee</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 font-sans">
        {insights.assignees.map((person) => {
          const color = assigneeColors[person.name] || 'var(--accent)';
          return (
            <div 
              key={person.name} 
              // 🚀 แก้ให้ใช้ openAssigneeDrawer แทน openDrawer เพื่อเปิดเป็นกราฟสรุปงานรายคน
              className={`bg-[color:var(--surface)] border rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-lg ${person.overdue > 0 ? 'border-[color:var(--alert-border)] bg-[color:var(--alert-bg)] cursor-pointer' : (person.tasks.length === 0 ? 'border-[color:var(--border)] opacity-60' : 'border-[color:var(--border)] cursor-pointer')}`}
              onClick={() => { if(person.tasks.length > 0 && openAssigneeDrawer) openAssigneeDrawer(person.name); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-[#0d0d12] shadow-inner font-syne" style={{backgroundColor: color}}>
                  {getInitials(person.name)}
                </div>
                <div className="font-semibold text-[color:var(--text)] truncate text-sm">{getShortName(person.name)}</div>
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase">Active</div>
                  <div className="text-3xl font-syne font-black leading-none mt-1" style={{color: person.overdue > 0 ? 'var(--text)' : (person.tasks.length === 0 ? 'var(--muted)' : color)}}>{person.tasks.length}</div>
                </div>
                {person.overdue > 0 && (
                  <div className="text-right">
                    <div className="text-[11px] text-[color:var(--accent2)] font-bold uppercase">Overdue</div>
                    <div className="text-xl font-syne font-black text-[color:var(--accent2)] leading-none mt-1">{person.overdue}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 font-sans mb-4">
        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-6">
          <h3 className="text-xs font-syne uppercase tracking-widest text-[color:var(--muted)] font-bold mb-5">Top Departments (Origin)</h3>
          <div>
            {insights.departments.map((dept, idx) => {
              const percentage = (dept.tasks.length / insights.totalActive) * 100;
              const barColor = ['var(--accent)', 'var(--accent3)', 'var(--accent4)', '#c084fc', '#fb7185'][idx];
              return (
                <div key={dept.name} className="flex items-center gap-4 py-3 border-b border-[color:var(--border)] last:border-0 cursor-pointer hover:pl-2 transition-all" onClick={() => openDrawer && openDrawer(`งานจาก ${dept.name}`, dept.tasks)}>
                  <div className="flex-1 font-semibold text-sm text-[color:var(--text)]">{dept.name}</div>
                  <div className="w-24 h-1.5 bg-[color:var(--surface2)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width: `${percentage}%`, backgroundColor: barColor}}></div>
                  </div>
                  <div className="w-8 text-right font-syne font-black text-lg text-[color:var(--text)]">{dept.tasks.length}</div>
                </div>
              );
            })}
            {insights.departments.length === 0 && <div className="text-[color:var(--muted)] text-sm">No active tasks.</div>}
          </div>
        </div>

        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl p-6">
          <h3 className="text-xs font-syne uppercase tracking-widest text-[color:var(--muted)] font-bold mb-5">Top Task Types (BI Category)</h3>
          <div>
            {insights.categories.map((cat, idx) => {
              const percentage = (cat.tasks.length / insights.totalActive) * 100;
              const barColor = ['var(--accent)', 'var(--accent3)', 'var(--accent4)', '#c084fc', '#fb7185'][idx];
              return (
                <div key={cat.name} className="flex items-center gap-4 py-3 border-b border-[color:var(--border)] last:border-0 cursor-pointer hover:pl-2 transition-all" onClick={() => openDrawer && openDrawer(`งานประเภท ${cat.name}`, cat.tasks)}>
                  <div className="flex-1 font-semibold text-sm text-[color:var(--text)]">{cat.name}</div>
                  <div className="w-24 h-1.5 bg-[color:var(--surface2)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width: `${percentage}%`, backgroundColor: barColor}}></div>
                  </div>
                  <div className="w-8 text-right font-syne font-black text-lg text-[color:var(--text)]">{cat.tasks.length}</div>
                </div>
              );
            })}
            {insights.categories.length === 0 && <div className="text-[color:var(--muted)] text-sm">No active tasks.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}