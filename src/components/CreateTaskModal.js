import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CreateTaskModal = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    projectKey, 
    assignableUsers = [], 
    currentUser = null,
    biCategoryOptions = [], 
    departmentOptions = [] 
}) => {
    const [summary, setSummary] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [dueDate, setDueDate] = useState('');
    const [biCategory, setBiCategory] = useState('');
    const [department, setDepartment] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const priorities = ['Highest', 'High', 'Medium', 'Low'];

    useEffect(() => {
        if (isOpen) {
            // Reset form when modal opens
            setSummary(''); setDescription(''); setPriority('Medium');
            setDueDate(''); setBiCategory(''); setDepartment('');
            setErrors({}); setIsSubmitting(false);
            // Default assignee to the current user
            if (currentUser) {
                setAssigneeId(currentUser.accountId);
            }
        }
    }, [isOpen, currentUser]);

    const validateForm = () => { /* ... validation logic unchanged ... */ return true; };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSubmitting(true);
        setErrors({});

        // EDITED: Construct the full, correct payload here in the frontend
           const issueData = {
            fields: {
                project: { key: projectKey },
                summary: summary,
                description: { 
                    type: "doc", 
                    version: 1, 
                    content: [
                        { 
                            type: "paragraph", 
                            content: [
                                { 
                                    type: "text", 
                                    text: description || "Task Description: " + (description || "No additional details provided")
                                }
                            ] 
                        }
                    ] 
                },
                issuetype: { name: "Task" },
                priority: { name: priority },
                duedate: dueDate,
                customfield_10307: biCategory,
                customfield_10306: department,
                
                // Set assignee to the selected user, or default to the current user if "Unassigned" is chosen
                assignee: { accountId: assigneeId || currentUser?.accountId },
                
                // Set reporter to the current user
                /*reporter: { accountId: currentUser?.accountId },*/

                // Set labels to be the current user's email
                labels: currentUser?.emailAddress ? [currentUser.emailAddress] : []
            }
        };

        try {
            await onSubmit(issueData);
            onClose();
        } catch (err) {
            setErrors({ submit: err.message || 'An unknown error occurred.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 transition-opacity ease-in-out duration-200 bg-black bg-opacity-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col transition-all ease-in-out duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">Create New Task in "{projectKey}"</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-x-6 gap-y-4 overflow-y-auto">
                    <div className="col-span-2">
                        <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">Summary (Title) *</label>
                        <input id="summary" type="text" value={summary} onChange={(e) => setSummary(e.target.value)} className={`w-full p-2 border rounded-lg ${errors.summary ? 'border-red-500' : 'border-gray-300'}`} />
                    </div>
                    <div className="col-span-2">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                        <textarea id="description" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} className={`w-full p-2 border rounded-lg ${errors.description ? 'border-red-500' : 'border-gray-300'}`} />
                    </div>
                    <div>
                        <label htmlFor="assignee" className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                        <select id="assignee" value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full p-2 border rounded-lg bg-white border-gray-300">
                            {/* Option for the current user is the default */}
                            {currentUser && <option value={currentUser.accountId}>Myself ({currentUser.displayName})</option>}
                            {/* Other assignable users */}
                            {(assignableUsers || []).filter(u => u.accountId !== currentUser?.accountId).map(user => <option key={user.accountId} value={user.accountId}>{user.displayName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="duedate" className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                        <input id="duedate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`w-full p-2 border rounded-lg ${errors.dueDate ? 'border-red-500' : 'border-gray-300'}`} />
                    </div>
                     <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                        <div className={`flex flex-wrap gap-2 rounded-lg ${errors.priority ? 'p-1 border border-red-500' : ''}`}>
                            {priorities.map(p => (<button type="button" key={p} onClick={() => setPriority(p)} className={`px-3 py-1 text-sm rounded-full border-2 ${priority === p ? 'border-blue-500 bg-blue-100' : 'bg-gray-100 hover:bg-gray-200'}`}>{p}</button>))}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                        <select id="department" value={department} onChange={e => setDepartment(e.target.value)} className={`w-full p-2 border rounded-lg bg-white ${errors.department ? 'border-red-500' : 'border-gray-300'}`} required>
                            <option value="" disabled>Select a department</option>
                            {(departmentOptions || []).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="biCategory" className="block text-sm font-medium text-gray-700 mb-1">BI Category *</label>
                         <select id="biCategory" value={biCategory} onChange={e => setBiCategory(e.target.value)} className={`w-full p-2 border rounded-lg bg-white ${errors.biCategory ? 'border-red-500' : 'border-gray-300'}`} required>
                            <option value="" disabled>Select a category</option>
                            {(biCategoryOptions || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    {errors.submit && (<div className="col-span-2 bg-red-100 text-red-700 p-3 rounded-md text-sm"><strong>Error:</strong> {errors.submit}</div>)}
                </form>
                <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-wait">
                        {isSubmitting ? 'Creating...' : 'Create Task'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTaskModal;