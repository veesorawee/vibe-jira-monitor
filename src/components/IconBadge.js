// src/components/IconBadge.js
import React from 'react';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, Flame, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { parseDate, getStatusColor } from '../utils/helpers';

const IconBadge = ({ type, task }) => {
    const baseClasses = "flex items-center justify-center w-5 h-5 rounded-full";

    if (type === 'priority') {
        const priority = task.priority || 'Low';
        let icon, color;
        switch (priority) {
            case 'Highest':
                icon = <ChevronsUp size={14} className="text-red-900" />;
                color = 'bg-red-200';
                break;
            case 'High':
                icon = <ChevronUp size={14} className="text-orange-900" />;
                color = 'bg-orange-200';
                break;
            case 'Medium':
                icon = <Minus size={14} className="text-yellow-900" />;
                color = 'bg-yellow-200';
                break;
            default: // Low
                icon = <ChevronDown size={14} className="text-green-900" />;
                color = 'bg-green-200';
                break;
        }
        return <div title={priority} className={`${baseClasses} ${color}`}>{icon}</div>;
    }

    if (type === 'timeliness') {
        const dueDate = parseDate(task.dueDate);
        if (!dueDate) {
            return <div title="No Due Date" className={`${baseClasses} bg-gray-200`}><AlertTriangle size={14} className="text-gray-600" /></div>;
        }
        const resolutionDate = parseDate(task.resolutiondate);
        let isOverdue;
        if (resolutionDate) {
            isOverdue = resolutionDate > dueDate;
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            isOverdue = today > dueDate;
        }
        if (isOverdue) {
            return <div title="Overdue" className={`${baseClasses} bg-red-500`}><Flame size={14} className="text-white" /></div>;
        } else {
            return <div title="On Time" className={`${baseClasses} bg-green-200`}><CheckCircle2 size={14} className="text-green-900" /></div>;
        }
    }

    if (type === 'status') {
        const colorClass = getStatusColor(task.status).split(' ')[0]; // Get only bg-color
        return <div title={task.status} className={`w-3 h-3 rounded-full ${colorClass}`}></div>;
    }

    return null;
};

export default IconBadge;