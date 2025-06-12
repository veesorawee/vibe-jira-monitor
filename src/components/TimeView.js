import React, { useMemo } from 'react';
import { formatAssigneeName } from '../utils/helpers';
import { Clock, Edit3, AlertCircle } from 'lucide-react';
import IconBadge from './IconBadge';

const TimeTaskCard = ({ task, onTaskClick, columnType, assigneeColors }) => {
    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const timestampToShow = columnType === 'created' ? task.startTimestamp : task.lastUpdated;
    const showOverlay = (columnType === 'updated') && task.lastUpdateDetail;

    return (
        <div 
            className="relative bg-white rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors duration-200 cursor-pointer flex flex-col gap-2"
            onClick={() => onTaskClick(task)}
        >
            {/* Row 1: Key and Icon Badges */}
            <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-gray-500">{task.id}</span>
                <div className="flex items-center space-x-1.5">
                    <IconBadge type="priority" task={task} />
                    <IconBadge type="timeliness" task={task} />
                    <IconBadge type="status" task={task} />
                </div>
            </div>

            {/* Row 2: Title */}
            <div>
                <p className="font-semibold text-gray-800 leading-tight">{task.title}</p>
            </div>

            {/* Row 3: Department & Label */}
            <div className="text-xs text-gray-500 truncate">
                 <span>{task.department || 'N/A'}</span>
                 {task.labels && task.labels.length > 0 && <span className="ml-1">&middot; {task.labels[0]}</span>}
            </div>

            {/* Row 4: Assignee and Timestamp */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                 <div className="flex items-center gap-1.5 truncate">
                     <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: assigneeColors[task.assignee] || '#9ca3af' }}></span>
                     <span className="truncate">{formatAssigneeName(task.assignee, task.assigneeEmail)}</span>
                 </div>
                 <div className="flex items-center gap-1.5 flex-shrink-0">
                     <Clock size={12} />
                     <span>{formatDisplayDate(timestampToShow)}</span>
                 </div>
            </div>

            {/* Overlay for status changes */}
            {showOverlay && (
                <div className="absolute inset-0 flex items-center justify-end p-4 pointer-events-none select-none">
                    <div className="text-right">
                        {task.lastUpdateDetail.type === 'fromTo' && (
                            <>
                                <p className="text-lg font-semibold text-gray-900/[.07]">
                                    {task.lastUpdateDetail.from} →
                                </p>
                                <h2 className="text-4xl font-black text-gray-900/[.09] break-words leading-none -mt-1">
                                    {task.lastUpdateDetail.to}
                                </h2>
                            </>
                        )}
                        {task.lastUpdateDetail.type === 'twoLine' && (
                             <>
                                <p className="text-lg font-semibold text-gray-900/[.07] capitalize">
                                    {task.lastUpdateDetail.line1}
                                </p>
                                <h2 className="text-4xl font-black text-gray-900/[.09] break-words leading-none -mt-1">
                                    {task.lastUpdateDetail.line2}
                                </h2>
                            </>
                        )}
                        {task.lastUpdateDetail.type === 'simple' && (
                            <h2 className="text-4xl font-black text-gray-900/[.09] break-words leading-none">
                                {task.lastUpdateDetail.text}
                            </h2>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


const TimeView = ({ tasks, onTaskClick, assigneeColors }) => {
    const sortedByCreated = useMemo(() => {
        return [...tasks].sort((a, b) => new Date(b.startTimestamp) - new Date(a.startTimestamp));
    }, [tasks]);

    const sortedByUpdated = useMemo(() => {
        const updatedTasks = tasks.filter(task => {
            const createdDate = new Date(task.startTimestamp);
            const updatedDate = new Date(task.lastUpdated);
            return (updatedDate.getTime() - createdDate.getTime()) > 120000;
        });
        return updatedTasks.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    }, [tasks]);

    const sortedByNoAction = useMemo(() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const noActionTasks = tasks.filter(task => {
            const status = (task.status || '').toLowerCase();
            const isCompleted = status.includes('done') || status.includes('cancelled');
            const lastUpdateDate = new Date(task.lastUpdated);
            return !isCompleted && lastUpdateDate < sevenDaysAgo;
        });
        return noActionTasks.sort((a, b) => new Date(a.lastUpdated) - new Date(b.lastUpdated));
    }, [tasks]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div>
                <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-blue-500 flex items-center">
                    <Clock className="mr-2" />
                    Recently Created
                </h2>
                <div className="space-y-3 max-h-[1000px] overflow-y-auto pr-2">
                    {sortedByCreated.map(task => (
                        <TimeTaskCard 
                            key={`created-${task.id}`} 
                            task={task} 
                            onTaskClick={onTaskClick} 
                            columnType="created"
                            assigneeColors={assigneeColors}
                        />
                    ))}
                </div>
            </div>
            <div>
                 <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-purple-500 flex items-center">
                    <Edit3 className="mr-2" />
                    Recently Updated
                </h2>
                <div className="space-y-3 max-h-[1000px] overflow-y-auto pr-2">
                    {sortedByUpdated.map(task => (
                        <TimeTaskCard 
                            key={`updated-${task.id}`} 
                            task={task} 
                            onTaskClick={onTaskClick} 
                            columnType="updated"
                            assigneeColors={assigneeColors}
                        />
                    ))}
                </div>
            </div>
            <div>
                 <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-red-500 flex items-center">
                    <AlertCircle className="mr-2" />
                    No Action (> 7 days)
                </h2>
                <div className="space-y-3 max-h-[1000px] overflow-y-auto pr-2">
                    {sortedByNoAction.length > 0 ? (
                        sortedByNoAction.map(task => (
                            <TimeTaskCard 
                                key={`noaction-${task.id}`} 
                                task={task} 
                                onTaskClick={onTaskClick} 
                                columnType="noAction"
                                assigneeColors={assigneeColors}
                            />
                        ))
                    ) : (
                        <p className="text-gray-500 p-4 text-center">No stale tasks found. Great job!</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimeView;