import React from 'react';
import { X } from 'lucide-react';
import Badge from './Badge';

const TaskListDrawer = ({ isOpen, onClose, title, tasks, onTaskClick }) => {
    return (
        <div className={`fixed inset-0 z-40 transition-opacity ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} font-sans`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${isOpen ? 'bg-opacity-50 backdrop-blur-sm' : 'bg-opacity-0'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full bg-[color:var(--bg)] border-l border-[color:var(--border)] w-full max-w-md shadow-2xl transition-transform transform ease-in-out duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
                    <h3 className="text-lg font-bold text-[color:var(--text)] truncate font-syne" title={title}>{title}</h3>
                    <button onClick={onClose} className="text-[color:var(--muted)] hover:text-[color:var(--accent2)] flex-shrink-0 ml-4 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto">
                    {tasks.map(task => {
                        return (
                            <div key={task.id} className="border border-[color:var(--border)] rounded-xl p-4 cursor-pointer hover:border-[color:var(--accent)] bg-[color:var(--surface)] hover:bg-[color:var(--surface2)] shadow-sm transition-all" onClick={() => onTaskClick(task)}>
                                <p className="text-sm text-[color:var(--text)] mb-3 font-medium">{task.title}</p>
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center flex-wrap gap-2">
                                        <Badge type="priority" task={task} />
                                        <Badge type="timeliness" task={task} />
                                        <Badge type="status" task={task} />
                                    </div>
                                    <span className="text-xs font-bold text-[color:var(--muted)] bg-[color:var(--bg)] px-2 py-1 rounded-md">{task.storyPoints || 0} pts</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TaskListDrawer;