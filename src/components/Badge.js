import React from 'react';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, Flame, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseDate } from '../utils/helpers';

const Badge = ({ type, task }) => {
    // 🚀 ปรับ Base Classes ให้พอดีกับ Icon อย่างเดียว ถ้าไม่มี Text
    const baseClasses = "inline-flex items-center justify-center font-bold rounded-md border";

    if (type === 'priority') {
        const priority = task.priority || 'Low';
        let icon, color, text;
        switch (priority) {
            case 'Highest':
                icon = <ChevronsUp size={14} />; color = 'bg-red-500/10 text-red-500 border-red-500/30'; text = 'H+';
                break;
            case 'High':
                icon = <ChevronUp size={14} />; color = 'bg-orange-500/10 text-orange-500 border-orange-500/30'; text = 'Hi';
                break;
            case 'Medium':
                icon = <Minus size={14} />; color = 'bg-blue-500/10 text-blue-500 border-blue-500/30'; text = 'Med';
                break;
            default:
                icon = <ChevronDown size={14} />; color = 'bg-green-500/10 text-green-500 border-green-500/30'; text = 'Low';
                break;
        }
        return <span title={priority} className={`${baseClasses} px-2 py-0.5 text-xs gap-1 ${color}`}>{icon}{text}</span>;
    }

    if (type === 'timeliness') {
        const dueDate = parseDate(task.dueDate);
        
        // 🚀 ถ้าไม่มี Due Date โชว์แค่ Icon สีเทา
        if (!dueDate) {
            return (
                <span title="No Due Date" className={`${baseClasses} w-6 h-6 bg-gray-500/10 text-gray-400 border-gray-500/30`}>
                    <AlertTriangle size={14} />
                </span>
            );
        }
        
        const resolutionDate = parseDate(task.resolutiondate);
        let isOverdue = resolutionDate ? resolutionDate > dueDate : (new Date().setHours(0,0,0,0) > dueDate);
        
        // 🚀 โชว์แค่ Icon เปล่าๆ พร้อม Tooltip อธิบายเวลาเอาเมาส์ชี้
        if (isOverdue) {
            return (
                <span title="Overdue (เลยกำหนดเวลาแล้ว)" className={`${baseClasses} w-6 h-6 bg-red-500/20 text-red-500 border-red-500/50`}>
                    <Flame size={14} />
                </span>
            );
        }
        
        return (
            <span title="On Time (ยังไม่เกินกำหนด)" className={`${baseClasses} w-6 h-6 bg-green-500/10 text-green-500 border-green-500/30`}>
                <CheckCircle2 size={14} />
            </span>
        );
    }

    if (type === 'status') {
        return <span className={`${baseClasses} px-2 py-0.5 text-xs bg-[color:var(--surface2)] text-[color:var(--text)] border-[color:var(--border)]`}>{task.status}</span>;
    }

    return null;
};

export default Badge;