import React from 'react';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, Flame, AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react';
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
            default:
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

        // 🚀 บังคับ End of Day
        dueDate.setHours(23, 59, 59, 999);

        const statusLower = (task.status || '').toLowerCase();
        const isDone = statusLower.includes('done') || statusLower.includes('cancel');
        const isHold = statusLower.includes('hold') || statusLower.includes('pending user review');
        
        if (isHold) {
            return <div title="On Hold" className={`${baseClasses} bg-slate-200`}><PauseCircle size={14} className="text-slate-600" /></div>;
        }

        const resolutionDate = task.resolutiondate ? new Date(task.resolutiondate) : null;
        let isOverdue = isDone ? (resolutionDate && resolutionDate > dueDate) : (new Date() > dueDate);
        
        if (isOverdue) {
            return <div title="Overdue" className={`${baseClasses} bg-red-500`}><Flame size={14} className="text-white" /></div>;
        } else {
            return <div title="On Time" className={`${baseClasses} bg-green-200`}><CheckCircle2 size={14} className="text-green-900" /></div>;
        }
    }

    if (type === 'status') {
        const colorClass = getStatusColor(task.status).split(' ')[0]; 
        return <div title={task.status} className={`w-3 h-3 rounded-full ${colorClass}`}></div>;
    }

    return null;
};

export default IconBadge;