import React, { useMemo, useRef, useEffect } from 'react';
import Badge from './Badge';
import IconBadge from './IconBadge';
import { parseDate, formatDateFull, isWeekend } from '../utils/helpers';

// Helper function to calculate working days
const addWorkingDays = (startDate, daysToAdd) => {
    if (!startDate) return null;
    const newDate = new Date(startDate);
    let addedDays = 0;
    while (addedDays < daysToAdd) {
        newDate.setDate(newDate.getDate() + 1);
        const dayOfWeek = newDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            addedDays++;
        }
    }
    return newDate;
};


const GanttChart = ({ tasks, minDate, maxDate, isCompactMode, onTaskClick, assigneeColors, currentDate }) => {
    const dayWidth = 30;
    const taskColumnWidth = 300;
    const ganttRef = useRef(null);

    useEffect(() => {
        const ganttContainer = ganttRef.current;
        if (!ganttContainer || !minDate) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIndex = Math.floor((today - minDate) / (1000 * 60 * 60 * 24));

        if (todayIndex > -1) {
            const scrollTarget = (todayIndex * dayWidth) - (ganttContainer.clientWidth / 2) + (dayWidth / 2);
            ganttContainer.scrollLeft = scrollTarget;
        }
    }, [minDate, tasks]);

    const { dates, monthHeaders } = useMemo(() => {
        if (!minDate || !maxDate) return { dates: [], monthHeaders: [] };
        const dateArr = [];
        const monthArr = [];
        let currentMonth = null;
        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(minDate);
            date.setDate(date.getDate() + i);
            dateArr.push(date);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (monthKey !== currentMonth) {
                currentMonth = monthKey;
                monthArr.push({ month: monthKey, label: new Date(date.getFullYear(), date.getMonth(), 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), days: 0 });
            }
            monthArr[monthArr.length - 1].days++;
        }
        return { dates: dateArr, monthHeaders: monthArr };
    }, [minDate, maxDate]);

    const timelineWidth = dates.length * dayWidth;

    const getTaskBarStyle = (task) => {
        const startDate = parseDate(task.startDate);
        if (!startDate || !minDate) return { display: 'none' };
        
        let endDate;
        const status = (task.status || '').toLowerCase();
        const isCompleted = status.includes('done') || status.includes('cancelled');
        const today = new Date();

        if (isCompleted) {
            const resolutionDate = parseDate(task.resolutiondate);
            endDate = resolutionDate ? resolutionDate : new Date(task.lastUpdated);
        } else {
            const dueDate = parseDate(task.dueDate);
            if (dueDate) {
                endDate = today;
            } else {
                const defaultEndDate = new Date(startDate);
                defaultEndDate.setDate(defaultEndDate.getDate() + 7);
                endDate = today > defaultEndDate ? today : defaultEndDate;
            }
        }

        const finalEndDate = (!endDate || endDate < startDate) ? startDate : endDate;

        const startDay = Math.floor((startDate - minDate) / (1000 * 60 * 60 * 24));
        const endDay = Math.floor((finalEndDate - minDate) / (1000 * 60 * 60 * 24));
        const duration = Math.max(1, endDay - startDay + 1);

        return { 
            left: `${startDay * dayWidth}px`, 
            width: `${duration * dayWidth}px`, 
            backgroundColor: assigneeColors[task.assignee] || '#9ca3af' 
        };
    };
    
    if (tasks.length === 0) {
        return <div className="bg-white rounded-lg shadow text-center p-8 text-gray-500">No tasks to display.</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-x-auto" ref={ganttRef}>
            <div style={{ width: `${taskColumnWidth + timelineWidth}px` }} className="relative">
                {/* Header Section */}
                <div className="sticky top-0 z-20">
                    <div className="flex bg-gray-100">
                        <div className="sticky left-0 font-medium border-b border-r bg-gray-100 z-30" style={{ width: taskColumnWidth, flexShrink: 0 }}></div>
                        {monthHeaders.map((month) => (<div key={month.month} className="text-center text-sm p-2 border-b border-r font-semibold" style={{ width: `${month.days * dayWidth}px` }}>{month.label}</div>))}
                    </div>
                    <div className="flex bg-gray-50">
                        <div className="sticky left-0 p-3 border-b border-r font-medium bg-gray-50 z-30" style={{ width: taskColumnWidth, flexShrink: 0 }}>Task</div>
                        {dates.map((date, index) => (<div key={index} className={`text-center text-xs py-2 border-b border-r ${date.toDateString() === currentDate.toDateString() ? 'bg-blue-200 text-blue-900 font-bold' : isWeekend(date) ? 'bg-red-50' : ''}`} style={{ minWidth: dayWidth, width: dayWidth }} title={formatDateFull(date)}>{date.getDate()}</div>))}
                    </div>
                </div>

                {/* Body Section */}
                {tasks.map((task) => {
                    const dueDate = parseDate(task.dueDate);
                    const dueDay = (dueDate && minDate) ? Math.floor((dueDate - minDate) / (1000 * 60 * 60 * 24)) : -1;
                    return (
                        <div key={task.id} className="flex border-b">
                            {/* Sticky Task Column */}
                            <div className="sticky left-0 bg-white hover:bg-gray-50 border-r py-3 px-3 cursor-pointer z-10" style={{ width: taskColumnWidth, flexShrink: 0 }} onClick={() => onTaskClick(task)}>
                                
                                {/* EDITED: Added back the conditional rendering for Compact Mode */}
                                {isCompactMode ? (
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center space-x-2 truncate">
                                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: assigneeColors[task.assignee]}}></span>
                                            <p className="font-medium text-sm truncate" title={task.title}>{task.id}</p>
                                        </div>
                                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                                            <IconBadge type="priority" task={task} />
                                            <IconBadge type="timeliness" task={task} />
                                            <IconBadge type="status" task={task} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="min-w-0">
                                        <div className="flex items-start space-x-2">
                                            <span className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{backgroundColor: assigneeColors[task.assignee]}}></span>
                                            <p className="font-medium text-sm whitespace-normal break-words" title={task.title}>{task.title}</p>
                                        </div>
                                        <div className="pl-5 mt-2 flex items-center flex-wrap gap-2">
                                            <IconBadge type="priority" task={task} />
                                            <IconBadge type="timeliness" task={task} />
                                            <IconBadge type="status" task={task} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Timeline Column */}
                            <div className="relative" style={{ width: timelineWidth, flexShrink: 0 }}>
                                <div className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm cursor-pointer hover:opacity-80 transition-opacity flex items-center" style={getTaskBarStyle(task)} onClick={() => onTaskClick(task)} title={task.title}></div>
                                
                                {dueDay >= 0 && dueDay < dates.length && (
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                                        style={{ left: `${(dueDay + 1) * dayWidth - 1}px` }} 
                                        title={`Due: ${task.dueDate}`}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GanttChart;