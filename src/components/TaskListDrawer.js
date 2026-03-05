import React from 'react';
import { X, Calendar } from 'lucide-react';
import Badge from './Badge';
import { formatAssigneeName, parseDate } from '../utils/helpers';

// รับ assigneeColors เข้ามาเพิ่ม
const TaskListDrawer = ({ isOpen, onClose, title, tasks, onTaskClick, assigneeColors }) => {
    return (
        <div className={`fixed inset-0 z-40 transition-opacity ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} font-sans`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${isOpen ? 'bg-opacity-50 backdrop-blur-sm' : 'bg-opacity-0'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full bg-[color:var(--bg)] border-l border-[color:var(--border)] w-full max-w-md shadow-2xl transition-transform transform ease-in-out duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className="flex items-center justify-between p-5 border-b border-[color:var(--border)] bg-[color:var(--surface)] flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-[color:var(--text)] truncate font-syne" title={title}>{title}</h3>
                        <p className="text-xs text-[color:var(--muted)] mt-1">{tasks.length} Tasks</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--accent2)] bg-[color:var(--surface2)] rounded-full transition-colors ml-4"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    {tasks.map(task => {
                        const dueDate = parseDate(task.dueDate);
                        const isOverdue = dueDate && dueDate < new Date(new Date().setHours(0,0,0,0)) && !task.status.toLowerCase().includes('done');
                        // ดึงสีของ Assignee คนนี้มา
                        const userColor = assigneeColors ? assigneeColors[task.assignee] : '#ccc';

                        return (
                            <div 
                                key={task.id} 
                                className="border border-[color:var(--border)] rounded-2xl p-4 cursor-pointer hover:border-[color:var(--accent)] bg-[color:var(--surface)] hover:bg-[color:var(--surface2)] shadow-sm transition-all group" 
                                onClick={() => onTaskClick(task)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-[color:var(--accent3)]">{task.id}</span>
                                    <Badge type="priority" task={task} />
                                </div>
                                
                                <p className="text-sm text-[color:var(--text)] mb-4 font-medium line-clamp-2 leading-snug group-hover:text-[color:var(--accent)] transition-colors">
                                    {task.title}
                                </p>
                                
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col gap-2">
                                        <Badge type="status" task={task} />
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--muted)]">
                                            {/* ส่งสีเข้าไปที่ UserIcon */}
                                            <UserIcon name={task.assignee} color={userColor} />
                                            <span className="truncate max-w-[100px]">{formatAssigneeName(task.assignee, task.assigneeEmail)}</span>
                                        </div>
                                    </div>
                                    
                                    {task.dueDate && (
                                        <div className={`flex items-center gap-1 text-[11px] font-bold ${isOverdue ? 'text-[color:var(--accent2)]' : 'text-[color:var(--muted)]'}`}>
                                            <Calendar size={12} />
                                            {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {tasks.length === 0 && <div className="text-center text-[color:var(--muted)] mt-10 text-sm">No tasks in this list.</div>}
                </div>
            </div>
        </div>
    );
};

// ปรับ UserIcon ให้รับสีมาเป็น Background
const UserIcon = ({ name, color }) => (
    <div 
        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-inner text-[color:var(--bg)]"
        style={{ backgroundColor: color }}
    >
        {name && name !== 'Unassigned' ? name.substring(0, 2).toUpperCase() : '?'}
    </div>
);

export default TaskListDrawer;