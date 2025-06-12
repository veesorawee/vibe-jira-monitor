import { useState, useEffect, useMemo, useCallback } from 'react';
import JiraAPI from '../services/JiraAPI';
import { getDynamicMockTasks } from '../utils/mockData';

const useJira = () => {
    const mockTasks = useMemo(() => getDynamicMockTasks(), []);
    const [allTasks, setAllTasks] = useState(mockTasks);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    
    // NEW: State to track the last refresh timestamp
    const [lastRefreshTime, setLastRefreshTime] = useState(null);

    const [jiraConfig, setJiraConfig] = useState({
        projectKey: localStorage.getItem('jira_project') || '',
        assigneeEmails: localStorage.getItem('jira_assignees') || ''
    });

    const jiraAPI = useMemo(() => new JiraAPI(), []);

    useEffect(() => {
        jiraAPI.projectKey = jiraConfig.projectKey;
    }, [jiraConfig.projectKey, jiraAPI]);

    const loadJiraData = useCallback(async (isAutoRefresh = false) => {
        if (!jiraConfig.projectKey) {
            if (!isAutoRefresh) {
                setError('Please set your Jira Project Key in the Config.');
            }
            setAllTasks(mockTasks);
            setIsConnected(false);
            return;
        }
        
        try {
            if (!isAutoRefresh) {
                setLoading(true);
            }
            setError(null);
            
            const emailList = jiraConfig.assigneeEmails ? jiraConfig.assigneeEmails.split(',').map(email => email.trim()).filter(Boolean) : [];
            const issues = await jiraAPI.getProjectIssues(emailList);
            
            setAllTasks(issues);
            setIsConnected(true);
            // NEW: Set the refresh time upon successful data fetch
            setLastRefreshTime(new Date());
            
        } catch (err) {
            setError(err.message); 
            setIsConnected(false); 
            setAllTasks(mockTasks); 
        } finally {
            if (!isAutoRefresh) {
                setLoading(false);
            }
        }
    }, [jiraAPI, jiraConfig.projectKey, jiraConfig.assigneeEmails, mockTasks]);

    const saveJiraConfig = (config) => {
        localStorage.setItem('jira_project', config.projectKey);
        localStorage.setItem('jira_assignees', config.assigneeEmails);
        setJiraConfig(prev => ({ ...prev, ...config }));
    };
    
    useEffect(() => {
        if (!jiraConfig.projectKey) {
            loadJiraData();
            return;
        }

        const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

        loadJiraData();

        const intervalId = setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();
            if (currentHour >= 8 && currentHour < 19) {
                console.log(`Working hours auto-refresh at ${now.toLocaleTimeString('th-TH')}`);
                loadJiraData(true);
            } else {
                console.log(`Skipping auto-refresh outside of working hours at ${now.toLocaleTimeString('th-TH')}`);
            }
        }, REFRESH_INTERVAL_MS);

        return () => {
            clearInterval(intervalId);
        };
    }, [loadJiraData, jiraConfig.projectKey]);

    return {
        allTasks,
        setAllTasks,
        loading,
        error,
        isConnected,
        lastRefreshTime, // EDITED: Export the new state
        jiraConfig,
        saveJiraConfig,
        loadJiraData,
        jiraAPI
    };
};

export default useJira;