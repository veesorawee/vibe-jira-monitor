import React, { useMemo } from 'react';
import Badge from './Badge';
import { formatAssigneeName, parseDate } from '../utils/helpers';
import { Clock, AlertCircle } from 'lucide-react';

const BoardView = ({ tasks, onTaskClick, assigneeColors, openAssigneeDrawer }) => {
  const columns = useMemo(() => {
    const cols = {
      'TO DO': [],
      'IN PROGRESS': [],
      'REVIEW / ON HOLD': [],
      'DONE / CANCELLED': []
    };

    tasks.forEach(task => {
      const status = task.status.toUpperCase();
      if (status.includes('DONE') || status.includes('CANCEL')) {
        cols['DONE / CANCELLED'].push(task);
      } else if (status.includes('HOLD') || status.includes('REVIEW') || status.includes('PENDING')) {
        cols['REVIEW / ON HOLD'].push(task);
      } else if (status.includes('PROGRESS')) {
        cols['IN PROGRESS'].push(task);
      } else {
        cols['TO DO'].push(task);
      }
    });

    return cols;
  }, [tasks]);

  const isOverdue = (dateString) => {
    if (!dateString) return false;
    const date = parseDate(dateString);
    const today = new Date();
    today.setHours(0,0,0,0);
    return date && date < today;
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-250px)] min-h-[500px]">
      {Object.entries(columns).map(([colName, colTasks]) => (
        <div key={colName} className="flex-shrink-0 w-[340px] flex flex-col bg-[color:var(--surface2)] border border-[color:var(--border)] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[color:var(--border)] bg-[color:var(--surface)] flex justify-between items-center">
            <h3 className="font-bold text-[color:var(--text)] text-sm">{colName}</h3>
            <span className="bg-[color:var(--surface2)] px-2.5 py-1 rounded-full text-xs font-bold text-[color:var(--muted)] border border-[color:var(--border)] shadow-sm">
              {colTasks.length}
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {colTasks.map(task => {
              // 🚀 Logic: Overdue ใช้ได้แค่ใน To Do และ In Progress เท่านั้น ไม่นับ Done และ Hold
              const overdue = (colName === 'TO DO' || colName === 'IN PROGRESS') && isOverdue(task.dueDate);
              
              return (
                <div 
                  key={task.id} 
                  onClick={() => onTaskClick(task)}
                  className={`bg-[color:var(--surface)] p-4 rounded-xl shadow-sm border cursor-pointer hover:-translate-y-1 transition-transform ${overdue ? 'border-l-4 border-l-[#f87171] border-[#f87171]/40' : 'border-[color:var(--border)] hover:border-l-4 hover:border-l-[color:var(--accent)]'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-[color:var(--muted)]">{task.id}</span>
                    <Badge type="priority" task={task} />
                  </div>
                  
                  <p className="text-sm font-semibold text-[color:var(--text)] mb-4 line-clamp-2 leading-snug">
                    {task.title}
                  </p>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-[color:var(--border)]">
                    <div 
                        className="flex items-center space-x-2 truncate hover:underline decoration-2 underline-offset-2 transition-all cursor-pointer" 
                        style={{ textDecorationColor: assigneeColors[task.assignee] || 'var(--muted)' }}
                        onClick={(e) => { e.stopPropagation(); openAssigneeDrawer(task.assignee); }}
                    >
                      <div className="w-5 h-5 rounded-full flex-shrink-0 shadow-inner" style={{backgroundColor: assigneeColors[task.assignee] || '#ccc'}}></div>
                      <span className="text-xs font-medium text-[color:var(--muted)] truncate max-w-[120px]">
                        {formatAssigneeName(task.assignee, task.assigneeEmail)}
                      </span>
                    </div>

                    {task.dueDate && (
                      <div className={`flex items-center text-[11px] font-bold ${overdue ? 'text-[#f87171]' : 'text-[color:var(--muted)]'}`}>
                        {overdue ? <AlertCircle size={12} className="mr-1"/> : <Clock size={12} className="mr-1"/>}
                        {new Date(task.dueDate).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {colTasks.length === 0 && (
              <div className="h-24 border-2 border-dashed border-[color:var(--border)] rounded-xl flex items-center justify-center text-[color:var(--muted)] font-semibold text-sm">
                No tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(BoardView);