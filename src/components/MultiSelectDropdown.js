import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatAssigneeName } from '../utils/helpers';

const MultiSelectDropdown = ({ options, selected, onChange, placeholder = "Select...", colors, tasks }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isOptionChecked = (option) => {
        if (selected.length === 0) return true;
        return selected.includes(option);
    };

    const handleSelect = (option) => {
        const isCurrentlyAllSelected = selected.length === 0;
        let newSelected = [];

        if (isCurrentlyAllSelected) {
            newSelected = options.filter(item => item !== option);
        } else {
            if (selected.includes(option)) {
                newSelected = selected.filter(item => item !== option);
            } else {
                newSelected = [...selected, option];
            }
        }
        if (newSelected.length === options.length) {
            onChange([]);
        } else {
            onChange(newSelected);
        }
    };
    
    const getButtonLabel = () => {
        if (!selected || selected.length === 0) return placeholder;
        if (selected.length === 1) {
            if (tasks) {
                const task = tasks.find(t => t.assignee === selected[0]);
                return task ? formatAssigneeName(task.assignee, task.assigneeEmail) : selected[0];
            }
            return selected[0];
        }
        if (options && selected.length === options.length) return `All (${options.length})`;
        return `${selected.length} Selected`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2.5 border rounded-xl text-left flex justify-between items-center transition-all bg-[color:var(--surface2)] border-[color:var(--border)] text-[color:var(--text)] focus:border-[color:var(--accent)] outline-none">
                <span className="truncate text-sm font-medium">{getButtonLabel()}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto shadow-2xl rounded-xl border bg-[color:var(--surface)] border-[color:var(--border)]">
                    {options.map(option => (
                        <label key={option} className="flex items-center p-3 cursor-pointer hover:bg-[color:var(--surface2)] transition-colors text-[color:var(--text)] border-b border-[color:var(--border)] last:border-0">
                            <input 
                                type="checkbox" 
                                checked={isOptionChecked(option)} 
                                onChange={() => handleSelect(option)} 
                                className="mr-3 h-4 w-4 accent-[color:var(--accent)] rounded cursor-pointer" 
                            />
                            {colors && <span className="w-3 h-3 rounded-full mr-3 shadow-inner flex-shrink-0" style={{backgroundColor: colors[option]}}></span>}
                            <span className="text-sm truncate">
                                {tasks ? formatAssigneeName(option, tasks.find(t => t.assignee === option)?.assigneeEmail) : option}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;