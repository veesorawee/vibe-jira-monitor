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

    // EDITED: New function to determine the visual "checked" state
    // An option is checked if the `selected` array is empty (meaning "All") OR if it's explicitly included.
    const isOptionChecked = (option) => {
        if (selected.length === 0) return true;
        return selected.includes(option);
    };

    // EDITED: New handler logic to correctly manage selecting/deselecting from an "All" state
    const handleSelect = (option) => {
        const isCurrentlyAllSelected = selected.length === 0;
        let newSelected = [];

        if (isCurrentlyAllSelected) {
            // If "All" was selected, clicking one item means we now select all *except* that one.
            newSelected = options.filter(item => item !== option);
        } else {
            // If a specific set of items was selected...
            if (selected.includes(option)) {
                // ... and we click an already selected item, we remove it.
                newSelected = selected.filter(item => item !== option);
            } else {
                // ... and we click a new item, we add it to the selection.
                newSelected = [...selected, option];
            }
        }

        // If, after all logic, the number of selected items equals the total number of options,
        // it's equivalent to selecting "All", so we reset the state to an empty array.
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
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-left flex justify-between items-center">
                <span className="truncate">{getButtonLabel()}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-30 w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
                    {options.map(option => (
                        <label key={option} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={isOptionChecked(option)} // Use new checked logic
                                onChange={() => handleSelect(option)} // Use new handler logic
                                className="mr-3 h-4 w-4 rounded text-blue-600 focus:ring-blue-500" 
                            />
                            {colors && <span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: colors[option]}}></span>}
                            {tasks ? formatAssigneeName(option, tasks.find(t => t.assignee === option)?.assigneeEmail) : option}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;