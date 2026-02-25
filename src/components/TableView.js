import React, { useState, useMemo } from 'react';
import Badge from './Badge';
import { formatAssigneeName } from '../utils/helpers';
import { ArrowUpDown, Check, X as CancelIcon, Loader2, UserPlus } from 'lucide-react';

const TableView = ({ tasks, onTaskClick, assigneeColors, onUpdateTask, jiraAPI, isConnected, assignableUsers = [], openAssigneeDrawer }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'lastUpdated', direction: 'desc' });
  const [loadingTask, setLoadingTask] = useState(null);

  const formatBKKTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const sortedTasks = useMemo(() => {
    let sortableTasks = [...tasks];
    if (sortConfig !== null) {
      sortableTasks.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (['dueDate', 'lastUpdated', 'created'].includes(sortConfig.key)) {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableTasks;
  }, [tasks, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const Th = ({ label, sortKey }) => (
    <th className="px-3 py-4 bg-[color:var(--surface2)] text-left text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider cursor-pointer hover:bg-[color:var(--border)] transition-colors border-b border-[color:var(--border)]" onClick={() => requestSort(sortKey)}>
      <div className="flex items-center space-x-2">
        <span>{label}</span><ArrowUpDown size={12} className="opacity-50" />
      </div>
    </th>
  );

  const handleQuickStatus = async (task, targetKeyword) => {
      if (!isConnected) return alert('Cannot update in disconnected mode.');
      setLoadingTask(task.id);
      try {
          const res = await jiraAPI.getTransitions(task.id);
          const transitions = res.transitions || [];
          const target = transitions.find(t => t.name.toLowerCase().includes(targetKeyword));
          
          if (!target) {
              throw new Error(`Cannot move directly to "${targetKeyword.toUpperCase()}". Please check workflow in Jira.`);
          }
          await onUpdateTask(task.id, { statusId: target.id });
      } catch (err) {
          alert(err.message);
      } finally {
          setLoadingTask(null);
      }
  };

  const handleQuickAssign = async (task, accountId) => {
      if (!isConnected) return alert('Cannot update in disconnected mode.');
      setLoadingTask(task.id);
      try {
          await onUpdateTask(task.id, { assigneeId: accountId });
      } catch (err) {
          alert(err.message);
      } finally {
          setLoadingTask(null);
      }
  };

  return (
    <div className="bg-[color:var(--surface)] rounded-2xl shadow-sm border border-[color:var(--border)] overflow-hidden w-full">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left">
          <thead>
            <tr>
              <Th label="Key" sortKey="id" />
              <Th label="Summary" sortKey="title" />
              <Th label="Assignee" sortKey="assignee" />
              <Th label="Status" sortKey="status" />
              <Th label="Priority" sortKey="priority" />
              <Th label="Due Date" sortKey="dueDate" />
              <Th label="Create Date" sortKey="created" />
              <Th label="Last Update" sortKey="lastUpdated" />
              <th className="px-3 py-4 bg-[color:var(--surface2)] text-left text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider border-b border-[color:var(--border)]">
                Quick Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {sortedTasks.map((task) => {
              const isUpdating = loadingTask === task.id;
              const statusLower = (task.status || '').toLowerCase();
              const isFinished = statusLower.includes('done') || statusLower.includes('cancel');

              return (
                <tr key={task.id} onClick={() => onTaskClick(task)} className={`cursor-pointer transition-colors ${isUpdating ? 'bg-[color:var(--surface2)] opacity-70' : 'hover:bg-[color:var(--surface2)] bg-[color:var(--surface)]'} text-[color:var(--text)]`}>
                  
                  <td className="px-3 py-4 font-bold text-[color:var(--accent3)] whitespace-nowrap">{task.id}</td>
                  <td className="px-3 py-4 font-medium max-w-sm truncate" title={task.title}>{task.title}</td>
                  
                  {/* 🚀 กดที่ชื่อใน Table เพื่อเปิด Assignee Drawer */}
                  <td className="px-3 py-4 whitespace-nowrap" onClick={(e) => { e.stopPropagation(); openAssigneeDrawer(task.assignee); }}>
                    <div className="flex items-center space-x-2 cursor-pointer hover:underline decoration-2 underline-offset-2 transition-all" style={{ textDecorationColor: assigneeColors[task.assignee] || 'var(--muted)' }}>
                      <span className="w-3 h-3 rounded-full shadow-inner flex-shrink-0" style={{backgroundColor: assigneeColors[task.assignee] || '#ccc'}}></span>
                      <span className="font-medium">{formatAssigneeName(task.assignee, task.assigneeEmail)}</span>
                    </div>
                  </td>
                  
                  <td className="px-3 py-4 whitespace-nowrap"><Badge type="status" task={task} /></td>
                  <td className="px-3 py-4 whitespace-nowrap"><Badge type="priority" task={task} /></td>
                  
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[color:var(--muted)] font-medium">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                      {task.dueDate && <Badge type="timeliness" task={task} />}
                    </div>
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-[color:var(--muted)] font-medium">
                    {formatBKKTime(task.created || task.startDate)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-[color:var(--muted)] font-medium">
                    {formatBKKTime(task.lastUpdated)}
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {isUpdating ? (
                       <div className="flex items-center justify-center w-8 h-8 text-[color:var(--accent)]">
                           <Loader2 size={16} className="animate-spin" />
                       </div>
                    ) : isFinished ? null : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleQuickStatus(task, 'done')} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[color:var(--accent)] text-[color:var(--accent)] hover:bg-[color:var(--accent)] hover:text-[color:var(--bg)] transition-colors" title="Mark as Done">
                              <Check size={16} strokeWidth={2.5} />
                          </button>

                          <button onClick={() => handleQuickStatus(task, 'cancel')} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[color:var(--accent2)] text-[color:var(--accent2)] hover:bg-[color:var(--accent2)] hover:text-[color:var(--bg)] transition-colors" title="Cancel Task">
                              <CancelIcon size={16} strokeWidth={2.5} />
                          </button>

                          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer" title="Change Assignee">
                              <UserPlus size={16} strokeWidth={2} />
                              <select value="" onChange={(e) => { if (e.target.value) handleQuickAssign(task, e.target.value); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none">
                                  <option value="" disabled hidden>Assign to...</option>
                                  {assignableUsers.map(user => ( <option key={user.accountId} value={user.accountId}>{user.displayName}</option> ))}
                              </select>
                          </div>
                        </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tasks.length === 0 && <div className="p-12 text-center text-[color:var(--muted)] font-medium font-syne text-lg">No tasks found matching your filters.</div>}
      </div>
    </div>
  );
};

export default React.memo(TableView);