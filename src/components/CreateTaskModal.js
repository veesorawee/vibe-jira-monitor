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
            setSummary(''); setDescription(''); setPriority('Medium');
            setDueDate(''); setBiCategory(''); setDepartment('');
            setErrors({}); setIsSubmitting(false);
            if (currentUser) {
                setAssigneeId(currentUser.accountId);
            }
        }
    }, [isOpen, currentUser]);

    const validateForm = () => { return true; };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSubmitting(true);
        setErrors({});

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
                assignee: { accountId: assigneeId || currentUser?.accountId },
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
        <div className="fixed inset-0 flex items-center justify-center z-50 transition-opacity ease-in-out duration-200 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col transition-all ease-in-out duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-[color:var(--border)]">
                    <h3 className="text-xl font-bold text-[color:var(--text)] font-syne">Create New Task in <span className="text-[color:var(--accent)]">"{projectKey}"</span></h3>
                    <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--accent2)] bg-[color:var(--surface2)] rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-x-6 gap-y-5 overflow-y-auto">
                    <div className="col-span-2">
                        <label htmlFor="summary" className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">Summary (Title) *</label>
                        <input id="summary" type="text" value={summary} onChange={(e) => setSummary(e.target.value)} className={`w-full p-3 border bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl outline-none focus:border-[color:var(--accent)] transition-colors ${errors.summary ? 'border-[color:var(--accent2)]' : 'border-[color:var(--border)]'}`} />
                    </div>
                    <div className="col-span-2">
                        <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">Description *</label>
                        <textarea id="description" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} className={`w-full p-3 border bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl outline-none focus:border-[color:var(--accent)] transition-colors ${errors.description ? 'border-[color:var(--accent2)]' : 'border-[color:var(--border)]'}`} />
                    </div>
                    <div>
                        <label htmlFor="assignee" className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">Assignee</label>
                        <select id="assignee" value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full p-3 border border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl outline-none focus:border-[color:var(--accent)] transition-colors appearance-none">
                            {currentUser && <option value={currentUser.accountId}>Myself ({currentUser.displayName})</option>}
                            {(assignableUsers || []).filter(u => u.accountId !== currentUser?.accountId).map(user => <option key={user.accountId} value={user.accountId}>{user.displayName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="duedate" className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">Due Date *</label>
                        <input id="duedate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`w-full p-3 border bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl outline-none focus:border-[color:var(--accent)] transition-colors [color-scheme:dark] ${errors.dueDate ? 'border-[color:var(--accent2)]' : 'border-[color:var(--border)]'}`} />
                    </div>
                     <div className="col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-3">Priority *</label>
                        <div className={`flex flex-wrap gap-2 rounded-xl ${errors.priority ? 'p-1 border border-[color:var(--accent2)]' : ''}`}>
                            {priorities.map(p => (<button type="button" key={p} onClick={() => setPriority(p)} className={`px-4 py-2 text-sm font-bold rounded-xl border transition-all ${priority === p ? 'border-[color:var(--accent3)] bg-[color:var(--accent3)] text-white' : 'border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)] hover:border-[color:var(--muted)]'}`}>{p}</button>))}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="department" className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">Department *</label>
                        <select id="department" value={department} onChange={e => setDepartment(e.target.value)} className={`w-full p-3 border bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl outline-none focus:border-[color:var(--accent)] transition-colors appearance-none ${errors.department ? 'border-[color:var(--accent2)]' : 'border-[color:var(--border)]'}`} required>
                            <option value="" disabled>Select a department</option>
                            {(departmentOptions || []).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="biCategory" className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">BI Category *</label>
                         <select id="biCategory" value={biCategory} onChange={e => setBiCategory(e.target.value)} className={`w-full p-3 border bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl outline-none focus:border-[color:var(--accent)] transition-colors appearance-none ${errors.biCategory ? 'border-[color:var(--accent2)]' : 'border-[color:var(--border)]'}`} required>
                            <option value="" disabled>Select a category</option>
                            {(biCategoryOptions || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    {errors.submit && (<div className="col-span-2 bg-[color:var(--alert-bg)] border border-[color:var(--alert-border)] text-[color:var(--accent2)] p-4 rounded-xl text-sm font-bold">{errors.submit}</div>)}
                </form>
                <div className="flex justify-end space-x-3 p-6 border-t border-[color:var(--border)] bg-[color:var(--surface)] rounded-b-3xl">
                    <button type="button" onClick={onClose} className="bg-[color:var(--surface2)] border border-[color:var(--border)] text-[color:var(--text)] font-bold px-6 py-2.5 rounded-xl hover:bg-[color:var(--border)] transition-colors">Cancel</button>
                    <button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-[color:var(--accent)] text-[color:var(--bg)] font-bold px-6 py-2.5 rounded-xl hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Creating...' : 'Create Task'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTaskModal;