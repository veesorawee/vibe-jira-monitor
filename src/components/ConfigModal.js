import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ConfigModal = ({ isOpen, onClose, jiraConfig, saveJiraConfig, isConnected }) => {
    const [configForm, setConfigForm] = useState(jiraConfig);

    useEffect(() => {
        setConfigForm(jiraConfig);
    }, [jiraConfig]);

    if (!isOpen) return null;

    const handleSave = () => {
        saveJiraConfig(configForm);
        onClose();
    };

    const extractFromUrl = (url) => {
        if (!url) return;
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const projectIndex = pathParts.indexOf('projects');
            const projectKey = projectIndex > -1 ? pathParts[projectIndex + 1] : '';
            setConfigForm(prev => ({ ...prev, projectKey: projectKey.toUpperCase() || prev.projectKey }));
        } catch (error) {
            console.error('Invalid URL for parsing project key');
        }
    };

    return (
        <div className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity ease-in-out duration-200 ${isOpen ? 'bg-black/50 backdrop-blur-sm' : 'bg-opacity-0 pointer-events-none'}`} onClick={onClose}>
            <div 
                className={`bg-[color:var(--surface)] border border-[color:var(--border)] rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col transition-all ease-in-out duration-300 ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-[color:var(--border)]">
                    <h3 className="text-xl font-bold text-[color:var(--text)] font-syne">Jira Configuration</h3>
                    <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--accent2)] bg-[color:var(--surface2)] rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className={`p-4 rounded-xl font-bold text-sm border ${isConnected ? 'bg-[color:var(--accent)]/10 text-[color:var(--accent)] border-[color:var(--accent)]/30' : 'bg-[color:var(--alert-bg)] text-[color:var(--accent2)] border-[color:var(--alert-border)]'}`}>
                        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </div>
                    <div className="bg-[color:var(--surface2)] border border-[color:var(--border)] p-5 rounded-xl">
                        <h4 className="font-bold text-[color:var(--text)] mb-2">Quick Setup</h4>
                        <p className="text-sm text-[color:var(--muted)] mb-3">Paste your Jira project URL to auto-fill Project Key:</p>
                        <input type="text" placeholder="https://mycompany.atlassian.net/jira/software/projects/PROJ/boards/1" className="w-full p-3 border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] rounded-xl text-sm focus:border-[color:var(--accent)] outline-none transition-colors" onBlur={(e) => extractFromUrl(e.target.value)} />
                    </div>
                    <div className="space-y-5">
                        <h4 className="font-bold text-[color:var(--text)]">Configuration:</h4>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">Project Key *</label>
                            <input type="text" placeholder="PROJ" className="w-full p-3 border border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl focus:border-[color:var(--accent)] outline-none transition-colors" value={configForm.projectKey} onChange={(e) => setConfigForm(prev => ({ ...prev, projectKey: e.target.value.toUpperCase() }))} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">Assignee Emails (Filter)</label>
                            <input type="text" placeholder="email1@company.com,email2@company.com" className="w-full p-3 border border-[color:var(--border)] bg-[color:var(--surface2)] text-[color:var(--text)] rounded-xl focus:border-[color:var(--accent)] outline-none transition-colors" value={configForm.assigneeEmails} onChange={(e) => setConfigForm(prev => ({ ...prev, assigneeEmails: e.target.value }))} />
                            <p className="text-xs text-[color:var(--muted)] mt-2">Comma-separated emails (leave empty for all)</p>
                        </div>
                    </div>
                </div>
                <div className="flex space-x-3 p-6 border-t border-[color:var(--border)] bg-[color:var(--surface)] rounded-b-3xl">
                    <button onClick={handleSave} className="bg-[color:var(--accent)] text-[color:var(--bg)] font-bold px-6 py-2.5 rounded-xl hover:opacity-80 transition-opacity">Save & Close</button>
                    <button onClick={onClose} className="bg-[color:var(--surface2)] border border-[color:var(--border)] text-[color:var(--text)] font-bold px-6 py-2.5 rounded-xl hover:bg-[color:var(--border)] transition-colors">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default ConfigModal;