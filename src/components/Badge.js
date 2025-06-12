import React from 'react';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, Flame, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseDate, getStatusColor } from '../utils/helpers';

const Badge = ({ type, task }) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border";

    if (type === 'priority') {
        const priority = task.priority || 'Low';
        let icon, color, text;
        switch (priority) {
            case 'Highest':
                icon = <ChevronsUp size={14} className="text-red-900" />;
                color = 'bg-red-200 text-red-900 border-red-300';
                text = 'H+';
                break;
            case 'High':
                icon = <ChevronUp size={14} className="text-orange-900" />;
                color = 'bg-orange-200 text-orange-900 border-orange-300';
                text = 'Hi';
                break;
            case 'Medium':
                icon = <Minus size={14} className="text-yellow-900" />;
                color = 'bg-yellow-200 text-yellow-900 border-yellow-300';
                text = 'Med';
                break;
            default: // Low
                icon = <ChevronDown size={14} className="text-green-900" />;
                color = 'bg-green-200 text-green-900 border-green-300';
                text = 'Low';
                break;
        }
        return <span title={priority} className={`${baseClasses} ${color}`}>{icon}{text}</span>;
    }

    // EDITED: Updated timeliness badge logic to 3 states
    if (type === 'timeliness') {
        const dueDate = parseDate(task.dueDate);

        // Case 1: No due date is set for the task.
        if (!dueDate) {
            return <span title="No Due Date" className={`${baseClasses} bg-gray-200 text-gray-800 border-gray-300`}><AlertTriangle size={14} /> No Due</span>;
        }

        // Case 2: Due date exists, check if it's overdue.
        const resolutionDate = parseDate(task.resolutiondate);
        let isOverdue;

        if (resolutionDate) {
            // If resolved, compare resolution date to due date.
            isOverdue = resolutionDate > dueDate;
        } else {
            // If not resolved, compare today's date to due date.
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Compare date part only
            isOverdue = today > dueDate;
        }
        
        if (isOverdue) {
            return <span title="Overdue" className={`${baseClasses} bg-red-500 text-white border-red-600`}><Flame size={14} /> Overdue</span>;
        } else {
            return <span title="On Time" className={`${baseClasses} bg-green-200 text-green-900 border-green-300`}><CheckCircle2 size={14} /> On Time</span>;
        }
    }

    if (type === 'status') {
        return <span className={`${baseClasses} ${getStatusColor(task.status)}`}>{task.status}</span>;
    }

    return null;
};

export default Badge;