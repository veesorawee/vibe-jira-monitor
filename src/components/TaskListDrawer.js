import React from 'react';
import { X } from 'lucide-react';
import Badge from './Badge';

const TaskListDrawer = ({ isOpen, onClose, title, tasks, onTaskClick }) => {
    return (
        <div className={`fixed inset-0 z-40 transition-opacity ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div className={`absolute inset-0 bg-black transition-opacity ease-in-out duration-300 ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full bg-gray-50 w-full max-w-md shadow-xl transition-transform transform ease-in-out duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between p-4 border-b bg-white">
                    <h3 className="text-lg font-semibold truncate" title={title}>{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 flex-shrink-0 ml-4"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto">
                    {tasks.map(task => {
                        return (
                            <div key={task.id} className="border rounded-lg p-3 cursor-pointer hover:bg-white bg-white shadow-sm transition-colors" onClick={() => onTaskClick(task)}>
                                <p className="text-sm text-gray-900 mb-2 font-medium">{task.title}</p>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <div className="flex items-center flex-wrap gap-2">
                                        <Badge type="priority" task={task} />
                                        <Badge type="timeliness" task={task} />
                                        <Badge type="status" task={task} />
                                    </div>
                                    <span className="text-xs text-gray-500">{task.storyPoints || 0} pts</span>
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