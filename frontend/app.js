// API Configuration
const API_HOST = window.location.hostname || 'localhost';
const API_PROTOCOL = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
const API_URL = `${API_PROTOCOL}//${API_HOST}:5001/api`;

// Global State
let currentUser = null;
let currentProject = null;
let projects = [];
let students = [];
let currentPage = 1;
const PROJECTS_PER_PAGE = 6;
let classSocket = null;
let classChatContacts = [];
let activeClassChatRecipientId = null;
let classChatRetryCount = 0;
let activeProjectGroupChatId = null;
let projectChatPollTimer = null;
let classChatPollTimer = null;
let chatFocusRefreshAttached = false;

const PRIMARY_USER_CACHE_KEY = 'user';
const FALLBACK_USER_CACHE_KEY = 'auth_user';

function cacheUser(user) {
    const serialized = JSON.stringify(user);
    localStorage.setItem(PRIMARY_USER_CACHE_KEY, serialized);
    localStorage.setItem(FALLBACK_USER_CACHE_KEY, serialized);
}

function getCachedUser() {
    const candidates = [
        localStorage.getItem(PRIMARY_USER_CACHE_KEY),
        localStorage.getItem(FALLBACK_USER_CACHE_KEY)
    ];

    for (const raw of candidates) {
        if (!raw) continue;
        try {
            return JSON.parse(raw);
        } catch (_) {
            // Ignore malformed cache value and try the next source.
        }
    }

    return null;
}

function clearCachedUser() {
    localStorage.removeItem(PRIMARY_USER_CACHE_KEY);
    localStorage.removeItem(FALLBACK_USER_CACHE_KEY);
}

function safeShowDashboard() {
    try {
        showDashboard();
        return true;
    } catch (error) {
        console.error('Dashboard render failed, keeping authenticated dashboard shell visible:', error);
        // Keep user on dashboard page even if a widget fails to initialize.
        showPage('dashboard-page');
        return false;
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeEventListeners();
    } catch (error) {
        console.error('Startup listener initialization failed:', error);
    }
    checkAuthStatus();
});

// Event Listeners
function initializeEventListeners() {
    const bindById = (id, eventName, handler) => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Missing element #${id}, skipping ${eventName} listener.`);
            return false;
        }
        el.addEventListener(eventName, handler);
        return true;
    };

    // Auth Forms
    bindById('login-form', 'submit', handleLogin);
    bindById('register-form', 'submit', handleRegister);
    bindById('show-register', 'click', (e) => {
        e.preventDefault();
        showPage('register-page');
    });
    bindById('show-login', 'click', (e) => {
        e.preventDefault();
        showPage('login-page');
    });

    // Role-based fields
    bindById('role', 'change', (e) => {
        const facultyFields = document.getElementById('faculty-fields');
        if (!facultyFields) return;
        if (e.target.value === 'faculty') {
            facultyFields.style.display = 'block';
        } else {
            facultyFields.style.display = 'none';
        }
    });

    // Navigation
    bindById('logout-btn', 'click', handleLogout);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.target.dataset.view;
            showView(view);
            
            // Update active state
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Search
    bindById('project-search', 'input', (e) => {
        searchProjects(e.target.value);
    });
    
    bindById('student-search', 'input', (e) => {
        searchStudents(e.target.value);
    });

    // Profile Form
    bindById('profile-form', 'submit', handleProfileUpdate);

    // Create Project Form
    bindById('create-project-form', 'submit', handleCreateProject);

    // Class chat
    const classChatRecipient = document.getElementById('class-chat-recipient');
    const classChatForm = document.getElementById('class-chat-form');
    if (classChatRecipient) {
        classChatRecipient.addEventListener('change', (e) => {
            const recipientId = parseInt(e.target.value);
            if (recipientId) {
                activeClassChatRecipientId = recipientId;
                loadClassChatHistory(recipientId);
            } else {
                activeClassChatRecipientId = null;
                renderClassChatMessages([]);
            }
        });
    }
    if (classChatForm) {
        classChatForm.addEventListener('submit', sendClassChatMessage);
    }

    // Dashboard project group chat
    const projectGroupChatSelect = document.getElementById('project-group-chat-select');
    const projectGroupChatForm = document.getElementById('project-group-chat-form');
    if (projectGroupChatSelect) {
        projectGroupChatSelect.addEventListener('change', (e) => {
            const projectId = parseInt(e.target.value, 10);
            if (!projectId) {
                activeProjectGroupChatId = null;
                document.getElementById('project-group-chat-messages').innerHTML = '<div class="empty-state"><p>Select a project to view messages.</p></div>';
                return;
            }
            activeProjectGroupChatId = projectId;
            loadDashboardProjectGroupMessages(projectId);
        });
    }
    if (projectGroupChatForm) {
        projectGroupChatForm.addEventListener('submit', sendDashboardProjectGroupMessage);
    }

    // Project Modal
    setupProjectModal();
    setupCreateProjectModal();
    setupCreateTaskModal();
    setupCreateMilestoneModal();
    setupCustomProjectsEventListeners();
}


// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            cacheUser(data.user);
            if (!safeShowDashboard()) {
                alert('Login succeeded, but parts of the dashboard failed to load. Please refresh once.');
            }
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        role: document.getElementById('role').value,
    };
    
    if (formData.role === 'faculty') {
        formData.title = document.getElementById('title').value;
    }
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Registration successful! Please login.');
            showPage('login-page');
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred during registration');
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        if (classSocket) {
            classSocket.disconnect();
            classSocket = null;
        }
        
        currentUser = null;
        stopProjectChatAutoRefresh();
        stopClassChatAutoRefresh();
        clearCachedUser();
        localStorage.removeItem('currentView');
        history.replaceState(null, '', window.location.pathname);  // clear the hash
        showPage('login-page');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function checkAuthStatus() {
    const savedUser = getCachedUser();
    if (savedUser) {
        currentUser = savedUser;
        safeShowDashboard();
        // Validate session with server and refresh user data if needed
        validateSessionWithServer();
        return;
    }

    restoreSessionFromServer();
}

async function restoreSessionFromServer() {
    try {
        const response = await fetch(`${API_URL}/current-user`, {
            credentials: 'include'
        });

        if (!response.ok) {
            loadCRNs();
            return;
        }

        const serverUser = await response.json();
        currentUser = serverUser;
        cacheUser(serverUser);
        safeShowDashboard();
    } catch (error) {
        console.warn('Server session restore failed:', error);
        loadCRNs();
    }
}

async function validateSessionWithServer() {
    /**
     * Validate the cached user session against the server.
     * This prevents stale localStorage data from causing UI issues after page refresh.
     */
    try {
        const response = await fetch(`${API_URL}/current-user`, {
            credentials: 'include'
        });

        if (!response.ok) {
            // Do not force logout on refresh validation failure; keep cached session UX stable.
            console.warn('Session validation returned non-OK status, keeping cached session for now.');
            return;
        }

        const serverUser = await response.json();
        
        // Check if server data differs from cached data
        // (important fields: crn, role, first_name, last_name)
        const cacheStale = 
            currentUser.crn !== serverUser.crn ||
            currentUser.role !== serverUser.role ||
            currentUser.first_name !== serverUser.first_name ||
            currentUser.last_name !== serverUser.last_name;

        if (cacheStale) {
            // Update cache with fresh server data
            currentUser = serverUser;
            cacheUser(currentUser);
            
            // Refresh dashboard with updated user data
            showDashboard();
            
            // Reload critical data
            loadClassInfo();
            loadClassChatContacts();
        }
    } catch (error) {
        console.warn('Session validation failed, continuing with cached data:', error);
        // Continue with cached data if validation fails
    }
}

// Dashboard
function getWelcomeDisplayName(user) {
    if (!user) return 'User';

    const firstName = (user.first_name || '').trim();
    const lastName = (user.last_name || '').trim();
    const title = (user.title || '').trim();

    if (user.role === 'faculty') {
        if (title && lastName) return `${title} ${lastName}`;
        if (firstName && lastName) return `${firstName} ${lastName}`;
        if (lastName) return lastName;
        if (firstName) return firstName;
    }

    return firstName || user.username || 'User';
}

function formatChatTimestamp(timestamp) {
    if (!timestamp) return '';

    const hasTimezone = /Z$|[+-]\d\d:\d\d$/.test(timestamp);
    const normalized = hasTimezone ? timestamp : `${timestamp}Z`;
    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }

    return date.toLocaleString();
}

function startProjectChatAutoRefresh() {
    if (projectChatPollTimer) return;

    projectChatPollTimer = setInterval(() => {
        if (!currentUser || document.hidden) return;

        const overviewView = document.getElementById('overview-view');
        const groupSection = document.getElementById('project-group-chat-section');
        if (
            activeProjectGroupChatId &&
            overviewView && overviewView.classList.contains('active') &&
            groupSection && groupSection.style.display !== 'none'
        ) {
            loadDashboardProjectGroupMessages(activeProjectGroupChatId);
        }

        const projectModal = document.getElementById('project-modal');
        const teamMessagesTab = document.getElementById('team-messages-tab');
        if (
            projectModal && projectModal.classList.contains('active') &&
            teamMessagesTab && teamMessagesTab.classList.contains('active') &&
            currentProject && currentProject.id
        ) {
            loadMessages(currentProject.id);
        }
    }, 3000);
}

function stopProjectChatAutoRefresh() {
    if (!projectChatPollTimer) return;
    clearInterval(projectChatPollTimer);
    projectChatPollTimer = null;
}

function startClassChatAutoRefresh() {
    if (classChatPollTimer) return;

    classChatPollTimer = setInterval(() => {
        if (!currentUser || document.hidden || !activeClassChatRecipientId) return;

        const overviewView = document.getElementById('overview-view');
        if (overviewView && overviewView.classList.contains('active')) {
            loadClassChatHistory(activeClassChatRecipientId);
        }
    }, 3000);
}

function stopClassChatAutoRefresh() {
    if (!classChatPollTimer) return;
    clearInterval(classChatPollTimer);
    classChatPollTimer = null;
}

function refreshVisibleChatsNow() {
    if (!currentUser) return;

    const overviewView = document.getElementById('overview-view');
    const overviewActive = overviewView && overviewView.classList.contains('active');

    if (overviewActive && activeClassChatRecipientId) {
        loadClassChatHistory(activeClassChatRecipientId);
    }

    const groupSection = document.getElementById('project-group-chat-section');
    if (
        overviewActive &&
        activeProjectGroupChatId &&
        groupSection &&
        groupSection.style.display !== 'none'
    ) {
        loadDashboardProjectGroupMessages(activeProjectGroupChatId);
    }

    const projectModal = document.getElementById('project-modal');
    const teamMessagesTab = document.getElementById('team-messages-tab');
    if (
        projectModal &&
        projectModal.classList.contains('active') &&
        teamMessagesTab &&
        teamMessagesTab.classList.contains('active') &&
        currentProject &&
        currentProject.id
    ) {
        loadMessages(currentProject.id);
    }
}

function setupChatFocusRefreshTriggers() {
    if (chatFocusRefreshAttached) return;

    const runImmediateRefresh = () => {
        if (document.hidden) return;
        refreshVisibleChatsNow();
    };

    window.addEventListener('focus', runImmediateRefresh);
    document.addEventListener('visibilitychange', runImmediateRefresh);
    chatFocusRefreshAttached = true;
}

function showDashboard() {
    showPage('dashboard-page');
    
    // Update user info
    const userName = [currentUser.first_name, currentUser.last_name]
        .filter(Boolean)
        .join(' ') || currentUser.username || 'User';
    document.getElementById('user-name').textContent = userName;
    document.getElementById('welcome-name').textContent = getWelcomeDisplayName(currentUser);
    
    // Show/hide role-specific elements
    updateRoleVisibility();
    
    // Load initial data
    loadProjects();
    loadMyProjects();
    loadStudents();
    loadUserProfile();
    initializeClassChat();
    startProjectChatAutoRefresh();
    startClassChatAutoRefresh();
    setupChatFocusRefreshTriggers();
    
    // Restore view from URL hash, or localStorage, or default to overview
    _restoreFromHash();
}

function updateRoleVisibility() {
    const studentElements = document.querySelectorAll('.student-only');
    const facultyElements = document.querySelectorAll('.faculty-only');
    
    // Check your browser console (F12) to see this output
    console.log("Updating visibility for role:", currentUser.role);

    if (currentUser.role === 'faculty') {
        // Faculty: Show faculty items, hide student items
        studentElements.forEach(el => {
            // Skip buttons that are dynamically controlled (like join-project-btn)
            if (!el.id || !el.id.includes('project-btn')) {
                el.style.display = 'none';
            }
        });
        facultyElements.forEach(el => {
            // Use inline-flex for buttons so they render correctly in flex containers
            el.style.display = el.tagName === 'BUTTON' ? 'inline-flex' : 'block';
        });
    } else {
        // Students: Show student items, hide faculty items
        studentElements.forEach(el => {
            // Skip buttons that are dynamically controlled
            if (!el.id || !el.id.includes('project-btn')) {
                el.style.display = '';
            }
        });
        facultyElements.forEach(el => el.style.display = 'none');
    }
}

// Views
// Internal view switcher — does NOT touch the hash (prevents infinite loops)
function _activateView(viewName) {
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });

    const requestedView = document.getElementById(`${viewName}-view`);
    if (!requestedView) {
        viewName = 'overview';
    }

    const activeView = document.getElementById(`${viewName}-view`);
    if (!activeView) {
        return;
    }

    activeView.classList.add('active');
    
    // Persist current view for page refresh
    localStorage.setItem('currentView', viewName);
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
    if (activeLink) activeLink.classList.add('active');
    
    // Load data for specific views
    if (viewName === 'projects') {
        loadProjects();
    } else if (viewName === 'students') {
        loadStudents();
    } else if (viewName === 'faculty') {
        loadFaculty();
    } else if (viewName === 'overview') {
        loadMyProjects();
        loadUserStories();
        loadClassInfo();
        loadClassChatContacts();
        refreshVisibleChatsNow();
    }
}

// Public view switcher — pushes a new hash entry so back/forward works
function showView(viewName) {
    const newHash = '#' + viewName;
    if (window.location.hash !== newHash) {
        window.location.hash = newHash;  // triggers hashchange → _onHashChange
    } else {
        _activateView(viewName);  // same hash, just refresh the view
    }
}

// Listen for back/forward button presses
window.addEventListener('hashchange', _onHashChange);

function _onHashChange() {
    if (!currentUser) return;  // not logged in, ignore hash changes
    const hash = window.location.hash.replace('#', '');
    if (!hash) {
        _activateView('overview');
        return;
    }
    _activateView(hash);
}

// Read the current hash on app entry (so refreshing stays on the right view)
function _restoreFromHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        _onHashChange();
    } else {
        // Fall back to localStorage saved view, or default to overview
        const savedView = localStorage.getItem('currentView') || 'overview';
        _activateView(savedView);
    }
}

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    document.getElementById(pageName).classList.add('active');
}

// Projects
async function loadProjects(keyword = '') {
    try {
        const url = keyword 
            ? `${API_URL}/projects?keyword=${encodeURIComponent(keyword)}`
            : `${API_URL}/projects`;
            
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        projects = await response.json();
        currentPage = 1;  // Reset to first page on new search
        displayProjects(projects);
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function displayProjects(projectsList) {
    const grid = document.getElementById('projects-grid');
    
    if (projectsList.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>No projects found</h3><p>Try adjusting your search</p></div>';
        updatePaginationControls(0);
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(projectsList.length / PROJECTS_PER_PAGE);
    const startIndex = (currentPage - 1) * PROJECTS_PER_PAGE;
    const endIndex = startIndex + PROJECTS_PER_PAGE;
    const paginatedProjects = projectsList.slice(startIndex, endIndex);
    
    // Display projects
    grid.innerHTML = paginatedProjects.map(project => {
        const isFull = project.current_members >= project.capacity;
        const statusText = isFull ? 'Full' : 'Open';
        const statusClass = isFull ? 'full' : 'open';
        
        return `
        <div class="project-card" onclick="openProjectModal(${project.id})">
            <div class="project-card-header">
                <div>
                    <h3>${project.name}</h3>
                    <small>${project.course}</small>
                </div>
                <div class="project-card-badges">
                    ${project.team_number ? `<span class="team-number-badge">Team ${project.team_number}</span>` : ''}
                    <span class="project-status status-${statusClass}">${statusText}</span>
                </div>
            </div>
            
            <div class="project-team-members">
                <h4>Team Members (${project.current_members}/${project.capacity})</h4>
                <div id="team-members-${project.id}" class="team-members-list"></div>
            </div>
            
            <p>${project.description}</p>
            
            <div class="project-meta">
                <span>Created by: ${project.creator.name}</span>
            </div>
        </div>
        `;
    }).join('');
    
    updatePaginationControls(totalPages);
}

function updatePaginationControls(totalPages) {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const paginationInfo = document.getElementById('pagination-info');
    
    if (totalPages <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        paginationInfo.textContent = '';
        return;
    }
    
    // Show/hide prev button
    prevBtn.style.display = currentPage > 1 ? 'inline-block' : 'none';
    
    // Show/hide next button
    nextBtn.style.display = currentPage < totalPages ? 'inline-block' : 'none';
    
    // Update page info
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

function nextPage() {
    const totalPages = Math.ceil(projects.length / PROJECTS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        displayProjects(projects);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayProjects(projects);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function searchProjects(keyword) {
    loadProjects(keyword);
}

async function loadMyProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`, {
            credentials: 'include'
        });
        
        const allProjects = await response.json();
        
        // Filter projects where user is a member
        const myProjects = allProjects.filter(p => 
            p.team_members && p.team_members.some(m => m.id === currentUser.id)
        );

        updateDashboardProjectGroupChat(myProjects);
        
        document.getElementById('project-count').textContent = myProjects.length;
        
        const container = document.getElementById('my-projects-list');
        
        if (myProjects.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No projects yet</h3><p>Join a project to get started</p></div>';
            return;
        }
        
        container.innerHTML = myProjects.map(project => `
            <div class="project-card" onclick="openProjectModal(${project.id})">
                <div class="project-card-header">
                    <div>
                        <h3>${project.name}</h3>
                        <small>${project.course}</small>
                    </div>
                    <span class="project-status status-${project.status}">${project.status}</span>
                </div>
                <p>${project.description}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading my projects:', error);
    }
}

function updateDashboardProjectGroupChat(myProjects) {
    const section = document.getElementById('project-group-chat-section');
    const select = document.getElementById('project-group-chat-select');
    const messages = document.getElementById('project-group-chat-messages');
    const input = document.getElementById('project-group-chat-input');
    if (!section || !select || !messages || !input) return;

    if (!currentUser || currentUser.role !== 'student' || !myProjects || myProjects.length === 0) {
        section.style.display = 'none';
        activeProjectGroupChatId = null;
        return;
    }

    section.style.display = 'block';
    select.innerHTML = myProjects.map(project =>
        `<option value="${project.id}">${escapeHtml(project.name)}</option>`
    ).join('');

    if (!activeProjectGroupChatId || !myProjects.some(p => p.id === activeProjectGroupChatId)) {
        activeProjectGroupChatId = myProjects[0].id;
    }

    select.value = String(activeProjectGroupChatId);
    loadDashboardProjectGroupMessages(activeProjectGroupChatId);
}

async function loadDashboardProjectGroupMessages(projectId) {
    const container = document.getElementById('project-group-chat-messages');
    if (!container || !projectId) return;

    try {
        const response = await fetch(`${API_URL}/projects/${projectId}/messages`, {
            credentials: 'include'
        });

        if (!response.ok) {
            container.innerHTML = '<div class="empty-state"><p>Unable to load project messages.</p></div>';
            return;
        }

        const messages = await response.json();
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No project messages yet.</p></div>';
            return;
        }

        container.innerHTML = messages.map(msg => `
            <div class="message">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(msg.sender.name)}</span>
                    <span class="message-time">${formatChatTimestamp(msg.created_at)}</span>
                </div>
                <div class="message-content">${escapeHtml(msg.content)}</div>
            </div>
        `).join('');
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading dashboard project group messages:', error);
        container.innerHTML = '<div class="empty-state"><p>Unable to load project messages.</p></div>';
    }
}

async function sendDashboardProjectGroupMessage(e) {
    e.preventDefault();

    if (!activeProjectGroupChatId) {
        alert('Please select a project first.');
        return;
    }

    const input = document.getElementById('project-group-chat-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    try {
        const response = await fetch(`${API_URL}/projects/${activeProjectGroupChatId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                content,
                message_type: 'group'
            })
        });

        if (!response.ok) {
            const errorPayload = await response.json();
            alert(errorPayload.error || 'Failed to send project group message');
            return;
        }

        input.value = '';
        await loadDashboardProjectGroupMessages(activeProjectGroupChatId);
    } catch (error) {
        console.error('Error sending dashboard project group message:', error);
        alert('An error occurred while sending your project group message.');
    }
}

// Students
async function loadStudents(keyword = '') {
    try {
        const url = keyword 
            ? `${API_URL}/students?keyword=${encodeURIComponent(keyword)}`
            : `${API_URL}/students`;
            
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        students = await response.json();
        displayStudents(students);
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

function displayStudents(studentsList) {
    const grid = document.getElementById('students-grid');
    
    if (studentsList.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>No students found</h3><p>Try adjusting your search</p></div>';
        return;
    }
    
    grid.innerHTML = studentsList.map(student => {
        // Don't show message icon for yourself
        const showMsg = currentUser && student.id !== currentUser.id;
        const classBadge = currentUser && currentUser.role === 'faculty' && student.crn_code
            ? `<span class="tag">CRN ${escapeHtml(student.crn_code)}</span>`
            : '';
        return `
        <div class="student-card">
            <div class="student-card-header">
                <h3>${student.name}</h3>
                ${showMsg ? `<button class="msg-icon-btn" onclick="openDirectMessage(${student.id}, '${escapeHtml(student.name)}')" title="Message ${student.name}" aria-label="Send message to ${student.name}">✉️</button>` : ''}
            </div>
            <p class="student-bio">${student.biography || 'No biography provided'}</p>
            <div class="student-tags">
                ${classBadge}
                ${student.skills ? student.skills.split(',').map(s => 
                    `<span class="tag">${s.trim()}</span>`
                ).join('') : ''}
            </div>
        </div>
    `}).join('');
}

function openDirectMessage(userId, userName) {
    // Switch to dashboard overview where the class chat lives
    showView('overview');
    
    // Update active nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('.nav-link[data-view="overview"]').classList.add('active');
    
    // Wait a tick for the view to render, then select the recipient
    setTimeout(() => {
        const select = document.getElementById('class-chat-recipient');
        if (select) {
            // Try to select the user in the dropdown
            const option = Array.from(select.options).find(o => o.value === String(userId));
            if (option) {
                select.value = String(userId);
                activeClassChatRecipientId = userId;
                loadClassChatHistory(userId);
            }
        }
        
        // Scroll to the chat section
        const chatSection = document.querySelector('.class-chat-section');
        if (chatSection) {
            chatSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Focus the input
        const input = document.getElementById('class-chat-input');
        if (input) input.focus();
    }, 300);
}

function searchStudents(keyword) {
    loadStudents(keyword);
}

// Profile
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/user/profile`, {
            credentials: 'include'
        });
        
        const profile = await response.json();
        
        // Populate view mode
        document.getElementById('profile-display-name').textContent = `${profile.first_name} ${profile.last_name}`;
        document.getElementById('profile-display-email').textContent = profile.email;
        document.getElementById('profile-display-role').textContent = profile.role === 'faculty' ? 'Faculty' : 'Student';
        
        if (profile.title) {
            document.getElementById('profile-display-title').textContent = profile.title;
            document.getElementById('profile-display-title-row').style.display = '';
        }
        
        document.getElementById('profile-display-class').textContent = profile.crn || 'Not assigned';
        
        document.getElementById('profile-display-bio').textContent = profile.biography || 'No biography provided';
        
        const skillsContainer = document.getElementById('profile-display-skills');
        if (profile.skills) {
            skillsContainer.innerHTML = profile.skills.split(',').map(s => 
                `<span class="tag">${s.trim()}</span>`
            ).join('');
        } else {
            skillsContainer.innerHTML = '<span class="profile-empty">No skills listed</span>';
        }
        
        const interestsContainer = document.getElementById('profile-display-interests');
        if (profile.interests) {
            interestsContainer.innerHTML = profile.interests.split(',').map(s => 
                `<span class="tag">${s.trim()}</span>`
            ).join('');
        } else {
            interestsContainer.innerHTML = '<span class="profile-empty">No interests listed</span>';
        }
        
        // Populate edit mode fields
        document.getElementById('profile-name').value = `${profile.first_name} ${profile.last_name}`;
        document.getElementById('profile-email').value = profile.email;
        document.getElementById('profile-bio').value = profile.biography || '';
        document.getElementById('profile-skills').value = profile.skills || '';
        document.getElementById('profile-interests').value = profile.interests || '';
        
        // Display classes for faculty with detailed stats
        if (currentUser.role === 'faculty') {
            loadMyClasses();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function toggleProfileEdit(editing) {
    document.getElementById('profile-view-mode').style.display = editing ? 'none' : '';
    document.getElementById('profile-edit-mode').style.display = editing ? '' : 'none';
}

async function loadMyClasses() {
    try {
        const response = await fetch(`${API_URL}/my-classes`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const classes = await response.json();
            displayFacultyClasses(classes);
        }
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

function displayFacultyClasses(classes) {
    const container = document.getElementById('faculty-classes-list');
    if (!container) return;
    
    if (!classes || classes.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No classes created yet. Click "+ Create Class" to get started.</p></div>';
        return;
    }
    
    container.innerHTML = classes.map(cls => {
        const projectsHtml = cls.projects && cls.projects.length > 0
            ? cls.projects.map(p => `
                <div class="class-project-row">
                    <div class="class-project-info">
                        <span class="class-project-name">${escapeHtml(p.name)}</span>
                        <span class="class-project-members">${p.current_members}/${p.capacity} members</span>
                        <span class="class-project-members">Visible to: ${(p.visible_crn_codes || []).map(code => escapeHtml(code)).join(', ') || 'Not set'}</span>
                    </div>
                    <div class="class-project-team">
                        <label for="team-num-${p.id}">Team #</label>
                        <input type="number" id="team-num-${p.id}" class="team-number-input" 
                            value="${p.team_number || ''}" min="1" max="99" 
                            placeholder="—"
                            onchange="assignTeamNumber(${p.id}, this.value)">
                    </div>
                </div>
            `).join('')
            : '<p class="class-no-projects">No projects in this class yet</p>';
        
        return `
            <div class="faculty-class-card">
                <div class="faculty-class-header" onclick="toggleClassDropdown(this)">
                    <div class="faculty-class-title">
                        <span class="faculty-class-code">${escapeHtml(cls.crn_code)}</span>
                        <span class="faculty-class-name">${escapeHtml(cls.course_name)}</span>
                    </div>
                    <div class="faculty-class-stats">
                        <span>${cls.student_count} students</span>
                        <span>${cls.project_count} projects</span>
                        <span class="dropdown-arrow">▼</span>
                    </div>
                </div>
                <div class="faculty-class-body" style="display:none;">
                    <div class="class-projects-header">
                        <h4>Projects & Team Assignments</h4>
                    </div>
                    <div class="class-projects-list">
                        ${projectsHtml}
                    </div>
                    <div class="faculty-class-actions">
                        <button class="btn btn-sm btn-danger" onclick="deleteCRN(${cls.id})">Delete Class</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleClassDropdown(header) {
    const body = header.nextElementSibling;
    const arrow = header.querySelector('.dropdown-arrow');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    arrow.textContent = isOpen ? '▼' : '▲';
}

async function assignTeamNumber(projectId, teamNumber) {
    const value = teamNumber ? parseInt(teamNumber) : null;
    
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ team_number: value })
        });
        
        if (response.ok) {
            // Brief visual feedback
            const input = document.getElementById(`team-num-${projectId}`);
            if (input) {
                input.style.borderColor = '#22c55e';
                setTimeout(() => { input.style.borderColor = ''; }, 1500);
            }
        } else {
            const error = await response.json();
            alert('Failed to assign team number: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error assigning team number:', error);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const profileData = {
        biography: document.getElementById('profile-bio').value,
        skills: document.getElementById('profile-skills').value,
        interests: document.getElementById('profile-interests').value
    };
    
    try {
        const response = await fetch(`${API_URL}/user/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });
        
        if (response.ok) {
            alert('Profile updated successfully!');
            toggleProfileEdit(false);
            loadUserProfile();
        } else {
            alert('Failed to update profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('An error occurred');
    }
}

// Project Modal
function setupProjectModal() {
    const modal = document.getElementById('project-modal');
    if (!modal) {
        console.warn('Missing #project-modal; skipping modal setup.');
        return;
    }

    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove('active');
        };
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Tab switching — scoped to project modal only so CP modal tabs are not affected
    const projectModal = document.getElementById('project-modal');
    projectModal.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            
            projectModal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            projectModal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load tab-specific data
            if (tabName === 'messages') {
                loadMessages(currentProject.id);
            } else if (tabName === 'tasks') {
                loadTasks(currentProject.id);
            } else if (tabName === 'milestones') {
                loadMilestones(currentProject.id);
            } else if (tabName === 'team-messages') {
                loadMessages(currentProject.id);
            }
        });
    });
    
    // Join/Leave buttons
    const joinBtn = document.getElementById('join-project-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', joinProject);
    }

    const leaveBtn = document.getElementById('leave-project-btn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', leaveProject);
    }
    
    // Message form (legacy modal may not include this form)
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', sendMessage);
    }

    // Project group chat form
    const teamMessageForm = document.getElementById('team-message-form');
    if (teamMessageForm) {
        teamMessageForm.removeEventListener('submit', sendTeamMessage);
        teamMessageForm.addEventListener('submit', sendTeamMessage);
    }
}

async function openProjectModal(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorPayload = await response.json();
            alert(errorPayload.error || 'Failed to load project details');
            return;
        }

        currentProject = await response.json();

        document.getElementById('project-modal-title').textContent = currentProject.name || '';
        document.getElementById('project-course').textContent = currentProject.course || '';
        document.getElementById('project-capacity').textContent = `${currentProject.current_members || 0}/${currentProject.capacity || 0}`;
        document.getElementById('project-status').textContent = currentProject.status || '';
        document.getElementById('project-creator').textContent = currentProject.creator ? currentProject.creator.name : '';
        const visibleCrns = currentProject.visible_crn_codes || (currentProject.crn_code ? [currentProject.crn_code] : []);
        document.getElementById('project-visible-classes').textContent = visibleCrns.length ? visibleCrns.join(', ') : 'Not set';
        document.getElementById('project-description').textContent = currentProject.description || '';

        displayTeamMembers(currentProject.team_members || []);

        const joinBtn = document.getElementById('join-project-btn');
        const leaveBtn = document.getElementById('leave-project-btn');
        const isMember = (currentProject.team_members || []).some(m => m.id === currentUser.id);
        const isFull = currentProject.status === 'full' || (currentProject.current_members || 0) >= (currentProject.capacity || 0);

        if (currentUser.role === 'student') {
            joinBtn.style.display = (!isMember && !isFull) ? 'inline-block' : 'none';
            leaveBtn.style.display = isMember ? 'inline-block' : 'none';
        } else {
            joinBtn.style.display = 'none';
            leaveBtn.style.display = 'none';
        }

        document.getElementById('project-modal').classList.add('active');

        const modal = document.getElementById('project-modal');
        modal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const overviewBtn = modal.querySelector('.tab-btn[data-tab="overview"]');
        if (overviewBtn) overviewBtn.classList.add('active');
        const overviewTab = document.getElementById('overview-tab');
        if (overviewTab) overviewTab.classList.add('active');
    } catch (error) {
        console.error('Error opening project modal:', error);
        alert('An error occurred while loading this project.');
    }
}

function displayTeamMembers(members) {
    const container = document.getElementById('team-members-list');
    if (!container) return;

    if (!members || members.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No team members yet</h3><p>Be the first to join this project.</p></div>';
        return;
    }

    if (currentUser && currentUser.role === 'faculty') {
        const groupedMembers = members.reduce((acc, member) => {
            const key = member.crn_code || 'unassigned';
            if (!acc[key]) acc[key] = [];
            acc[key].push(member);
            return acc;
        }, {});

        container.innerHTML = Object.keys(groupedMembers).sort().map(crn => {
            const groupLabel = crn === 'unassigned' ? 'No CRN' : `CRN ${escapeHtml(crn)}`;
            const group = groupedMembers[crn];
            return `
                <div class="team-crn-group">
                    <div class="team-crn-divider">${groupLabel} (${group.length})</div>
                    ${group.map(member => `
                        <div class="team-member">
                            <h4>${escapeHtml(member.name || 'Unknown member')}</h4>
                            <p>${escapeHtml(member.skills || 'No skills listed')}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
        return;
    }

    container.innerHTML = members.map(member => `
        <div class="team-member">
            <h4>${escapeHtml(member.name || 'Unknown member')}</h4>
            <p>${escapeHtml(member.skills || 'No skills listed')}</p>
        </div>
    `).join('');
}

async function joinProject() {
    if (!currentProject) return;

    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/join`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Failed to join project');
            return;
        }

        await loadProjects();
        await loadMyProjects();
        await openProjectModal(currentProject.id);
    } catch (error) {
        console.error('Error joining project:', error);
        alert('An error occurred while joining the project.');
    }
}

async function leaveProject() {
    if (!currentProject) return;
    if (!confirm('Are you sure you want to leave this project?')) return;

    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/leave`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Failed to leave project');
            return;
        }

        document.getElementById('project-modal').classList.remove('active');
        await loadProjects();
        await loadMyProjects();
    } catch (error) {
        console.error('Error leaving project:', error);
        alert('An error occurred while leaving the project.');
    }
}

// Messages
async function loadMessages(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}/messages`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorPayload = await response.json();
            const container = document.getElementById('team-chat-messages');
            if (container) {
                container.innerHTML = `<div class="empty-state"><p>${escapeHtml(errorPayload.error || 'Error loading messages')}</p></div>`;
            }
            return;
        }

        const messages = await response.json();
        const container = document.getElementById('team-chat-messages');
        if (!container) return;

        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No project messages yet</p></div>';
            return;
        }

        container.innerHTML = messages.map(msg => `
            <div class="message">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(msg.sender.name)}</span>
                    <span class="message-time">${formatChatTimestamp(msg.created_at)}</span>
                </div>
                <div class="message-content">${escapeHtml(msg.content)}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading project messages:', error);
        const container = document.getElementById('team-chat-messages');
        if (container) {
            container.innerHTML = '<p>Error loading messages</p>';
        }
    }
}

function renderClassChatContacts(contacts) {
    const select = document.getElementById('class-chat-recipient');
    const input = document.getElementById('class-chat-input');
    if (!select || !input) return;

    if (contacts.length === 0) {
        const emptyLabel = currentUser && currentUser.role === 'student'
            ? 'No professors available yet'
            : 'No students available yet';
        select.innerHTML = `<option value="">${emptyLabel}</option>`;
        select.disabled = false;
        input.disabled = true;
        renderClassChatMessages([]);

        if (classChatRetryCount < 3) {
            classChatRetryCount += 1;
            setTimeout(() => {
                loadClassChatContacts();
            }, 1200);
        }
        return;
    }

    classChatRetryCount = 0;
    select.disabled = false;
    input.disabled = false;
    select.innerHTML = contacts.map(contact => {
        const roleLabel = contact.role === 'faculty' ? 'Faculty' : 'Student';
        const classLabel = contact.crn_code ? ` - ${escapeHtml(contact.crn_code)}` : '';
        return `<option value="${contact.id}">${escapeHtml(contact.name)}${classLabel} (${roleLabel})</option>`;
    }).join('');

    const selectedId = parseInt(select.value) || contacts[0].id;
    select.value = String(selectedId);
    activeClassChatRecipientId = selectedId;
    loadClassChatHistory(selectedId);
}

function renderStudentChatContactDropdown(contacts) {
    // Show student view, hide faculty view
    const studentDropdownDiv = document.getElementById('student-chat-dropdown');
    const facultyDropdownsDiv = document.getElementById('faculty-chat-dropdowns');
    if (studentDropdownDiv) studentDropdownDiv.style.display = 'block';
    if (facultyDropdownsDiv) facultyDropdownsDiv.style.display = 'none';
    
    // Render the single dropdown for students
    renderClassChatContacts(contacts);
}

function renderClassChatDualDropdownsForFaculty(classes, students) {
    // Show faculty view, hide student view
    const studentDropdownDiv = document.getElementById('student-chat-dropdown');
    const facultyDropdownsDiv = document.getElementById('faculty-chat-dropdowns');
    if (studentDropdownDiv) studentDropdownDiv.style.display = 'none';
    if (facultyDropdownsDiv) facultyDropdownsDiv.style.display = 'block';
    
    // Render class dropdown
    const classSelect = document.getElementById('class-chat-class');
    const studentSelect = document.getElementById('class-chat-student');
    const input = document.getElementById('class-chat-input');
    
    if (!classSelect || !studentSelect || !input) return;
    
    // Populate class dropdown
    classSelect.innerHTML = '<option value="">Select a class...</option>' + 
        classes.map(cls => 
            `<option value="${cls.crn_code}">${cls.crn_code} - ${escapeHtml(cls.course_name)} (${cls.student_count} students)</option>`
        ).join('');
    
    classSelect.disabled = false;
    studentSelect.disabled = true;
    input.disabled = true;
    
    // Store students data grouped by class for quick access
    window.facultyStudentsByClass = {};
    students.forEach(student => {
        const crn = student.crn_code;
        if (!window.facultyStudentsByClass[crn]) {
            window.facultyStudentsByClass[crn] = [];
        }
        window.facultyStudentsByClass[crn].push(student);
    });
    
    // Set up class dropdown change listener
    classSelect.removeEventListener('change', handleClassDropdownChange);
    classSelect.addEventListener('change', handleClassDropdownChange);
    
    // Set up student dropdown change listener
    studentSelect.removeEventListener('change', handleStudentDropdownChange);
    studentSelect.addEventListener('change', handleStudentDropdownChange);
    
    renderClassChatMessages([]);
}

function handleClassDropdownChange(event) {
    const selectedCrn = event.target.value;
    const studentSelect = document.getElementById('class-chat-student');
    const input = document.getElementById('class-chat-input');
    
    if (!selectedCrn) {
        studentSelect.innerHTML = '<option value="">Select a student...</option>';
        studentSelect.disabled = true;
        input.disabled = true;
        renderClassChatMessages([]);
        activeClassChatRecipientId = null;
        return;
    }
    
    // Get students for this class
    const studentsInClass = window.facultyStudentsByClass[selectedCrn] || [];
    
    if (studentsInClass.length === 0) {
        studentSelect.innerHTML = '<option value="">No students in this class</option>';
        studentSelect.disabled = true;
        input.disabled = true;
        renderClassChatMessages([]);
        activeClassChatRecipientId = null;
        return;
    }
    
    // Populate student dropdown
    studentSelect.innerHTML = '<option value="">Select a student...</option>' +
        studentsInClass.map(student =>
            `<option value="${student.id}">${escapeHtml(student.name)}</option>`
        ).join('');
    
    studentSelect.disabled = false;
    renderClassChatMessages([]);
    activeClassChatRecipientId = null;
}

function handleStudentDropdownChange(event) {
    const selectedStudentId = parseInt(event.target.value);
    const input = document.getElementById('class-chat-input');
    
    if (!selectedStudentId) {
        input.disabled = true;
        renderClassChatMessages([]);
        activeClassChatRecipientId = null;
        return;
    }
    
    activeClassChatRecipientId = selectedStudentId;
    input.disabled = false;
    loadClassChatHistory(selectedStudentId);
}

function renderEmptyClassChatUI(message) {
    const studentDropdownDiv = document.getElementById('student-chat-dropdown');
    const facultyDropdownsDiv = document.getElementById('faculty-chat-dropdowns');
    const input = document.getElementById('class-chat-input');
    
    if (currentUser && currentUser.role === 'faculty') {
        if (facultyDropdownsDiv) facultyDropdownsDiv.style.display = 'block';
        if (studentDropdownDiv) studentDropdownDiv.style.display = 'none';
        const classSelect = document.getElementById('class-chat-class');
        if (classSelect) classSelect.innerHTML = `<option value="">${message}</option>`;
    } else {
        if (studentDropdownDiv) studentDropdownDiv.style.display = 'block';
        if (facultyDropdownsDiv) facultyDropdownsDiv.style.display = 'none';
        const select = document.getElementById('class-chat-recipient');
        if (select) select.innerHTML = `<option value="">${message}</option>`;
    }
    
    if (input) input.disabled = true;
    renderClassChatMessages([]);
}

async function initializeClassChat() {
    classChatRetryCount = 0;
    activeClassChatRecipientId = null;
    await loadClassChatContacts();
}

async function loadClassChatContacts() {
    try {
        if (currentUser && currentUser.role === 'faculty') {
            const classesResponse = await fetch(`${API_URL}/my-classes`, {
                credentials: 'include'
            });

            const studentsResponse = await fetch(`${API_URL}/students`, {
                credentials: 'include'
            });

            if (!classesResponse.ok || !studentsResponse.ok) {
                renderEmptyClassChatUI('No class contacts available');
                return;
            }

            const classes = await classesResponse.json();
            const students = await studentsResponse.json();

            if (!classes.length) {
                renderEmptyClassChatUI('No classes available');
                return;
            }

            renderClassChatDualDropdownsForFaculty(classes, students);
            return;
        }

        const response = await fetch(`${API_URL}/class-messages/contacts`, {
            credentials: 'include'
        });

        if (!response.ok) {
            renderEmptyClassChatUI('No contacts available');
            return;
        }

        const contacts = await response.json();
        renderStudentChatContactDropdown(contacts);
    } catch (error) {
        console.error('Error loading class chat contacts:', error);
        renderEmptyClassChatUI('No contacts available');
    }
}

async function loadClassChatHistory(recipientId) {
    try {
        const response = await fetch(`${API_URL}/class-messages/${recipientId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            renderClassChatMessages([]);
            return;
        }

        const messages = await response.json();
        renderClassChatMessages(messages);
    } catch (error) {
        console.error('Error loading class chat history:', error);
        renderClassChatMessages([]);
    }
}

function renderClassChatMessages(messages) {
    const container = document.getElementById('class-chat-messages');
    if (!container) return;

    if (!messages.length) {
        container.innerHTML = '<div class="empty-state"><h3>No messages yet</h3><p>Start a conversation.</p></div>';
        return;
    }

    container.innerHTML = messages.map(message => {
        const isOwn = currentUser && message.sender_id === currentUser.id;
        return `
            <div class="message ${isOwn ? 'message-own' : ''}">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(message.sender_name)}</span>
                    <span class="message-time">${formatChatTimestamp(message.created_at)}</span>
                </div>
                <div class="message-content">${escapeHtml(message.content)}</div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

function appendClassChatMessage(message) {
    const container = document.getElementById('class-chat-messages');
    if (!container) return;

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const isOwn = currentUser && message.sender_id === currentUser.id;
    const node = document.createElement('div');
    node.className = `message ${isOwn ? 'message-own' : ''}`;
    node.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${escapeHtml(message.sender_name)}</span>
            <span class="message-time">${formatChatTimestamp(message.created_at)}</span>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
    `;

    container.appendChild(node);
    container.scrollTop = container.scrollHeight;
}

async function sendClassChatMessage(e) {
    e.preventDefault();

    if (!activeClassChatRecipientId) {
        return;
    }

    const input = document.getElementById('class-chat-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    try {
        const response = await fetch(`${API_URL}/class-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                recipient_id: activeClassChatRecipientId,
                content
            })
        });

        if (!response.ok) {
            const errorPayload = await response.json();
            alert(errorPayload.error || 'Failed to send message');
            return;
        }

        input.value = '';
        await loadClassChatHistory(activeClassChatRecipientId);
    } catch (error) {
        console.error('Error sending class message:', error);
        alert('An error occurred while sending your message.');
    }
}

// Team Messaging
let activeTeamMessageRecipientId = null;

async function loadTeamMessagingContacts() {
    if (!currentProject) return;

    const contactsList = document.getElementById('team-contacts-list');
    if (!contactsList) return;

    contactsList.innerHTML = '';
    activeTeamMessageRecipientId = null;
    document.getElementById('selected-contact-name').textContent = '';
    document.getElementById('team-chat-messages').innerHTML = '';
    const teamChatInput = document.getElementById('team-chat-input');
    if (teamChatInput) {
        teamChatInput.style.display = 'none';
    }

    const teamMembers = currentProject.team_members || [];
    const contacts = teamMembers
        .filter(member => member.id !== currentUser.id)
        .map(member => ({
            id: member.id,
            name: member.name,
            role: 'Team Member'
        }));

    if (currentProject.creator && currentProject.creator.id !== currentUser.id) {
        contacts.push({
            id: currentProject.creator.id,
            name: currentProject.creator.name,
            role: currentProject.creator.title || 'Professor'
        });
    }

    if (contacts.length === 0) {
        contactsList.innerHTML = '<p>No team members or professor to message.</p>';
        return;
    }

    for (const contact of contacts) {
        const button = document.createElement('button');
        button.className = 'team-contact-btn';
        button.type = 'button';
        button.dataset.contactId = String(contact.id);
        button.dataset.contactName = contact.name;
        button.innerHTML = `<strong>${contact.name}</strong><br><small>${contact.role}</small>`;
        button.addEventListener('click', () => selectTeamContact(contact.id, contact.name, button));
        contactsList.appendChild(button);
    }
}

async function selectTeamContact(contactId, contactName, selectedButton = null) {
    activeTeamMessageRecipientId = contactId;

    document.getElementById('selected-contact-name').textContent = `Chat with ${contactName}`;
    const teamChatInput = document.getElementById('team-chat-input');
    if (teamChatInput) {
        teamChatInput.style.display = 'block';
    }

    document.querySelectorAll('.team-contact-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (selectedButton) {
        selectedButton.classList.add('active');
    }

    await loadTeamMessageHistory(contactId);
}

async function loadTeamMessageHistory(contactId) {
    const messagesDiv = document.getElementById('team-chat-messages');
    if (!messagesDiv) return;

    try {
        const response = await fetch(`${API_URL}/class-messages/${contactId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            messagesDiv.innerHTML = '<p>Error loading messages</p>';
            return;
        }

        const messages = await response.json();

        if (!Array.isArray(messages) || messages.length === 0) {
            messagesDiv.innerHTML = '<p><em>No messages yet</em></p>';
            return;
        }

        const messagesHtml = messages.map(msg => `
            <div class="message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}">
                <strong>${msg.sender_id === currentUser.id ? 'You' : msg.sender_name}</strong><br/>
                <span>${msg.content}</span>
                <small>${new Date(msg.created_at).toLocaleString()}</small>
            </div>
        `).join('');

        messagesDiv.innerHTML = messagesHtml;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (error) {
        console.error('Error loading team message history:', error);
        messagesDiv.innerHTML = '<p>Error loading messages</p>';
    }
}

async function sendTeamMessage(e) {
    e.preventDefault();

    if (!currentProject) {
        alert('Please open a project first');
        return;
    }

    const input = document.getElementById('team-chat-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                content,
                message_type: 'group'
            })
        });

        if (!response.ok) {
            const errorPayload = await response.json();
            alert(errorPayload.error || 'Failed to send message');
            return;
        }

        input.value = '';
        await loadMessages(currentProject.id);
    } catch (error) {
        console.error('Error sending team message:', error);
        alert('An error occurred while sending your message.');
    }
}

// Tasks
// Tasks
async function loadTasks(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
            credentials: 'include'
        });
        
        const tasks = await response.json();
        displayTasks(tasks);
        
        document.getElementById('task-count').textContent = tasks.filter(t => t.status !== 'completed').length;
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function displayTasks(tasks) {
    const container = document.getElementById('tasks-list');
    
    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No tasks yet</h3></div>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-item">
            <div class="task-header">
                <span class="task-title">${task.title}</span>
                <span class="task-status status-${task.status}">${task.status.replace('_', ' ')}</span>
            </div>
            ${task.description ? `<p>${task.description}</p>` : ''}
            <div class="task-meta">
                ${task.assignee ? `Assigned to: ${task.assignee.name}` : 'Unassigned'}
                ${task.due_date ? ` | Due: ${new Date(task.due_date).toLocaleDateString()}` : ''}
            </div>
        </div>
    `).join('');
}

// Milestones
async function loadMilestones(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}/milestones`, {
            credentials: 'include'
        });
        
        const milestones = await response.json();
        displayMilestones(milestones);
    } catch (error) {
        console.error('Error loading milestones:', error);
    }
}

function displayMilestones(milestones) {
    const container = document.getElementById('milestones-list');
    
    if (milestones.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No milestones yet</h3></div>';
        return;
    }
    
    container.innerHTML = milestones.map(milestone => `
        <div class="milestone-item">
            <div class="milestone-header">
                <span class="milestone-title">${milestone.title}</span>
                <span class="task-status status-${milestone.status}">${milestone.status}</span>
            </div>
            ${milestone.description ? `<p>${milestone.description}</p>` : ''}
            <div class="milestone-meta">
                Due: ${new Date(milestone.due_date).toLocaleDateString()}
            </div>
        </div>
    `).join('');
}

// Create Project
function setupCreateProjectModal() {
    const modal = document.getElementById('create-project-modal');
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };
}

async function showCreateProject() {
    // Populate class dropdown for faculty
    if (currentUser.role === 'faculty') {
        try {
            const response = await fetch(`${API_URL}/my-classes`, { credentials: 'include' });
            if (response.ok) {
                const classes = await response.json();
                const select = document.getElementById('new-project-class');
                const visibilityContainer = document.getElementById('new-project-visible-classes');
                select.innerHTML = '<option value="">Select a class</option>';

                if (!classes.length) {
                    if (visibilityContainer) {
                        visibilityContainer.innerHTML = '<p class="class-no-projects">Create at least one class before creating projects.</p>';
                    }
                } else {
                    select.innerHTML += classes.map(cls =>
                        `<option value="${cls.crn_code}">${cls.crn_code} - ${escapeHtml(cls.course_name)}</option>`
                    ).join('');

                    if (visibilityContainer) {
                        visibilityContainer.innerHTML = classes.map(cls => `
                            <label class="project-visibility-option">
                                <input type="checkbox" name="project-visible-crn" value="${cls.crn_code}">
                                <span>${escapeHtml(cls.crn_code)} - ${escapeHtml(cls.course_name)}</span>
                            </label>
                        `).join('');
                    }
                }

                select.onchange = () => {
                    const selectedCrn = select.value;
                    if (!selectedCrn) return;
                    const checkbox = document.querySelector(`input[name="project-visible-crn"][value="${selectedCrn}"]`);
                    if (checkbox) checkbox.checked = true;
                };
            }
        } catch (error) {
            console.error('Error loading classes:', error);
        }
    }
    document.getElementById('create-project-modal').classList.add('active');
}

async function handleCreateProject(e) {
    e.preventDefault();
    
    const projectData = {
        name: document.getElementById('new-project-name').value,
        description: document.getElementById('new-project-description').value,
        course: document.getElementById('new-project-course').value,
        capacity: parseInt(document.getElementById('new-project-capacity').value)
    };
    
    // Include class assignment
    const classSelect = document.getElementById('new-project-class');
    if (classSelect && classSelect.value) {
        projectData.crn_code = classSelect.value;
    }

    const selectedVisibleCrns = Array.from(document.querySelectorAll('input[name="project-visible-crn"]:checked'))
        .map(input => input.value)
        .filter(Boolean);

    if (projectData.crn_code && !selectedVisibleCrns.includes(projectData.crn_code)) {
        selectedVisibleCrns.push(projectData.crn_code);
    }
    projectData.visible_crn_codes = selectedVisibleCrns;
    
    try {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(projectData)
        });
        
        if (response.ok) {
            alert('Project created successfully!');
            document.getElementById('create-project-modal').classList.remove('active');
            document.getElementById('create-project-form').reset();
            loadProjects();
            if (currentUser.role === 'faculty') loadMyClasses();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to create project');
        }
    } catch (error) {
        console.error('Error creating project:', error);
        alert('An error occurred');
    }
}

// Create Task
function setupCreateTaskModal() {
    const modal = document.getElementById('create-task-modal');
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };
    
    document.getElementById('create-task-form').addEventListener('submit', handleCreateTask);
}

function showCreateTask() {
    // Populate assignee dropdown
    const select = document.getElementById('new-task-assignee');
    select.innerHTML = '<option value="">Unassigned</option>' +
        currentProject.team_members.map(m => 
            `<option value="${m.id}">${m.name}</option>`
        ).join('');
    
    document.getElementById('create-task-modal').classList.add('active');
}

async function handleCreateTask(e) {
    e.preventDefault();
    
    const taskData = {
        title: document.getElementById('new-task-title').value,
        description: document.getElementById('new-task-description').value,
        assignee_id: document.getElementById('new-task-assignee').value || null,
        due_date: document.getElementById('new-task-due').value || null
    };
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            alert('Task created successfully!');
            document.getElementById('create-task-modal').classList.remove('active');
            document.getElementById('create-task-form').reset();
            loadTasks(currentProject.id);
        } else {
            alert('Failed to create task');
        }
    } catch (error) {
        console.error('Error creating task:', error);
        alert('An error occurred');
    }
}

// Create Milestone
function setupCreateMilestoneModal() {
    const modal = document.getElementById('create-milestone-modal');
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };
    
    document.getElementById('create-milestone-form').addEventListener('submit', handleCreateMilestone);
}

function showCreateMilestone() {
    document.getElementById('create-milestone-modal').classList.add('active');
}

async function handleCreateMilestone(e) {
    e.preventDefault();
    
    const milestoneData = {
        title: document.getElementById('new-milestone-title').value,
        description: document.getElementById('new-milestone-description').value,
        due_date: document.getElementById('new-milestone-due').value
    };
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/milestones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(milestoneData)
        });
        
        if (response.ok) {
            alert('Milestone created successfully!');
            document.getElementById('create-milestone-modal').classList.remove('active');
            document.getElementById('create-milestone-form').reset();
            loadMilestones(currentProject.id);
        } else {
            alert('Failed to create milestone');
        }
    } catch (error) {
        console.error('Error creating milestone:', error);
        alert('An error occurred');
    }
}

// ==========================================
// USER STORIES / ANNOUNCEMENTS FUNCTIONS
// ==========================================

async function loadUserStories() {
    try {
        const response = await fetch(`${API_URL}/user-stories`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const stories = await response.json();
            displayUserStories(stories);
        }
    } catch (error) {
        console.error('Error loading user stories:', error);
    }
}

function displayUserStories(stories) {
    const container = document.getElementById('user-stories-list');
    
    if (!stories || stories.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No announcements yet. Be the first to post!</p></div>';
        return;
    }
    
    container.innerHTML = stories.map(story => {
        const canEdit = currentUser && (story.author_id === currentUser.id || currentUser.role === 'faculty');
        const timeAgo = getTimeAgo(new Date(story.created_at));
        
        // Determine audience label
        let audienceLabel = '';
        if (story.target_crn) {
            audienceLabel = `<span class="story-badge audience-class">📚 Class: ${escapeHtml(story.target_crn)}</span>`;
        } else if (story.project_id) {
            audienceLabel = `<span class="story-badge audience-project">👥 Project Team</span>`;
        }
        
        return `
            <div class="user-story-card priority-${story.priority}">
                <div class="user-story-header">
                    <h3 class="user-story-title">${escapeHtml(story.title)}</h3>
                    <div class="user-story-meta">
                        ${audienceLabel}
                        <span class="story-badge type-${story.story_type}">${story.story_type}</span>
                        ${story.priority === 'high' ? '<span class="story-badge priority-high">HIGH</span>' : ''}
                    </div>
                </div>
                <div class="user-story-content">${escapeHtml(story.content)}</div>
                <div class="user-story-footer">
                    <div class="story-author">
                        <span>Posted by <strong>${escapeHtml(story.author_name)}</strong></span>
                        <span class="story-author-badge">${story.author_role}</span>
                        <span>•</span>
                        <span>${timeAgo}</span>
                    </div>
                    ${canEdit ? `
                        <div class="story-actions">
                            <button onclick="deleteUserStory(${story.id})">Delete</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function showCreateUserStory() {
    const modal = document.getElementById('create-userstory-modal');
    
    // Setup close button
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };
    
    const audienceSelect = document.getElementById('new-story-audience');
    
    if (currentUser.role === 'faculty') {
        // Faculty gets: My Classes + Other Teams (projects)
        try {
            const [classesRes, projectsRes] = await Promise.all([
                fetch(`${API_URL}/my-classes`, { credentials: 'include' }),
                fetch(`${API_URL}/projects`, { credentials: 'include' })
            ]);
            
            const classes = await classesRes.json();
            const allProjects = await projectsRes.json();
            
            audienceSelect.innerHTML = '<option value="">Select audience</option>';
            
            // Add classes group
            if (classes.length > 0) {
                const classGroup = document.createElement('optgroup');
                classGroup.label = '📚 My Classes';
                classes.forEach(cls => {
                    const opt = document.createElement('option');
                    opt.value = `class:${cls.crn_code}`;
                    opt.textContent = `${cls.crn_code} - ${cls.course_name} (${cls.student_count} students)`;
                    classGroup.appendChild(opt);
                });
                audienceSelect.appendChild(classGroup);
            }
            
            // Add projects group
            if (allProjects.length > 0) {
                const projectGroup = document.createElement('optgroup');
                projectGroup.label = '👥 Other Teams (Projects)';
                allProjects.forEach(project => {
                    const opt = document.createElement('option');
                    opt.value = `project:${project.id}`;
                    opt.textContent = `${project.name} (${project.current_members}/${project.capacity} members)`;
                    projectGroup.appendChild(opt);
                });
                audienceSelect.appendChild(projectGroup);
            }
        } catch (error) {
            console.error('Error loading audience options:', error);
        }
    } else {
        // Students: show their projects
        try {
            const response = await fetch(`${API_URL}/projects`, { credentials: 'include' });
            const allProjects = await response.json();
            const myProjects = allProjects.filter(p => 
                p.team_members && p.team_members.some(m => m.id === currentUser.id)
            );
            
            audienceSelect.innerHTML = '<option value="">Select a project</option>';
            myProjects.forEach(project => {
                audienceSelect.innerHTML += `<option value="project:${project.id}">${project.name}</option>`;
            });
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }
    
    modal.classList.add('active');
}

// Create user story form submission
document.getElementById('create-userstory-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const storyData = {
        title: document.getElementById('new-story-title').value,
        content: document.getElementById('new-story-content').value,
        story_type: document.getElementById('new-story-type').value,
        priority: document.getElementById('new-story-priority').value
    };
    
    const audienceSelect = document.getElementById('new-story-audience');
    const audienceValue = audienceSelect.value;
    
    if (currentUser.role === 'student') {
        if (!audienceValue) {
            alert('Please select a project for your announcement');
            return;
        }
        // Students always target a project
        storyData.project_id = parseInt(audienceValue.replace('project:', ''));
    } else {
        // Faculty: parse audience type
        if (!audienceValue) {
            alert('Please select an audience for your announcement');
            return;
        }
        
        if (audienceValue.startsWith('class:')) {
            // Class-wide announcement
            storyData.target_crn = audienceValue.replace('class:', '');
        } else if (audienceValue.startsWith('project:')) {
            // Project-specific announcement
            storyData.project_id = parseInt(audienceValue.replace('project:', ''));
        }
    }
    
    try {
        const response = await fetch(`${API_URL}/user-stories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(storyData)
        });
        
        if (response.ok) {
            alert('Announcement posted successfully!');
            document.getElementById('create-userstory-modal').classList.remove('active');
            document.getElementById('create-userstory-form').reset();
            loadUserStories();
        } else {
            const error = await response.json();
            alert('Failed to post announcement: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating user story:', error);
        alert('An error occurred');
    }
});

async function deleteUserStory(storyId) {
    if (!confirm('Are you sure you want to delete this announcement?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/user-stories/${storyId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            alert('Announcement deleted successfully');
            loadUserStories();
        } else {
            alert('Failed to delete announcement');
        }
    } catch (error) {
        console.error('Error deleting user story:', error);
        alert('An error occurred');
    }
}

// ==========================================
// CRN MANAGEMENT FUNCTIONS
// ==========================================

async function loadCRNs() {
    try {
        const response = await fetch(`${API_URL}/crns`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const crns = await response.json();
            populateRegistrationCRNs(crns);
        }
    } catch (error) {
        console.error('Error loading CRNs:', error);
    }
}

function populateRegistrationCRNs(crns) {
    const crnSelect = document.getElementById('crn');
    
    if (!crnSelect) return;
    
    crnSelect.innerHTML = '<option value="">Select a class</option>';
    crns.forEach(crn => {
        crnSelect.innerHTML += `<option value="${crn.crn_code}">${crn.crn_code} - ${crn.course_name}</option>`;
    });
}

async function createCRN() {
    // Inline form removed — delegate to the full Create Class modal
    showCreateClass();
}

async function deleteCRN(crnId) {
    if (!confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/crns/${crnId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            alert('Class deleted successfully');
            loadMyClasses();
            loadClassInfo();
        } else {
            const error = await response.json();
            alert('Failed to delete class: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting class:', error);
        alert('An error occurred');
    }
}

// ==========================================
// CALENDAR FUNCTIONS
// ==========================================

let currentCalendarDate = new Date();
let assignmentDates = {};

async function loadAssignmentCalendar() {
    if (!currentUser || currentUser.role !== 'student') {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/calendar/assignments`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const assignments = await response.json();
            
            // Group assignments by date
            assignmentDates = {};
            assignments.forEach(assignment => {
                const date = new Date(assignment.due_date);
                const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                
                if (!assignmentDates[dateKey]) {
                    assignmentDates[dateKey] = [];
                }
                assignmentDates[dateKey].push(assignment);
            });
            
            renderCalendar();
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
    }
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendar-month-year').textContent = 
        `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const daysInPrevMonth = prevLastDay.getDate();
    
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        addCalendarDay(calendarGrid, day, year, month - 1, true);
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        addCalendarDay(calendarGrid, day, year, month, false);
    }
    
    // Next month days to fill grid
    const totalCells = calendarGrid.children.length - 7; // Exclude headers
    const remainingCells = 42 - totalCells - 7; // 6 weeks total
    for (let day = 1; day <= remainingCells; day++) {
        addCalendarDay(calendarGrid, day, year, month + 1, true);
    }
}

function addCalendarDay(grid, day, year, month, isOtherMonth) {
    const date = new Date(year, month, day);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    const assignments = assignmentDates[dateKey] || [];
    const hasAssignments = assignments.length > 0;
    
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    if (isOtherMonth) dayDiv.classList.add('other-month');
    if (isToday) dayDiv.classList.add('today');
    if (hasAssignments) dayDiv.classList.add('has-assignment');
    
    dayDiv.innerHTML = `
        <div class="calendar-day-number">${day}</div>
        ${hasAssignments ? `<div class="calendar-day-count">${assignments.length}</div>` : ''}
        ${hasAssignments ? `
            <div class="calendar-day-tooltip">
                ${assignments.map(a => escapeHtml(a.title)).join('<br>')}
            </div>
        ` : ''}
    `;
    
    if (hasAssignments) {
        dayDiv.onclick = () => showAssignmentsForDate(date, assignments);
    }
    
    grid.appendChild(dayDiv);
}

function showAssignmentsForDate(date, assignments) {
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const assignmentList = assignments.map(a => 
        `• ${escapeHtml(a.title)} (${escapeHtml(a.project_name)})`
    ).join('\n');
    
    alert(`Assignments due on ${dateStr}:\n\n${assignmentList}`);
}

function previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
}

// Helper function to get relative time
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [name, secondsInInterval] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInInterval);
        if (interval >= 1) {
            return `${interval} ${name}${interval > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'Just now';
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isValidCRN(crn) {
    return /^\d{5}$/.test((crn || '').trim());
}

// ==========================================
// CLASS MANAGEMENT FUNCTIONS
// ==========================================

function showCreateClassError(msg) {
    let el = document.getElementById('create-class-feedback');
    if (!el) {
        el = document.createElement('div');
        el.id = 'create-class-feedback';
        document.getElementById('create-class-form').prepend(el);
    }
    el.className = 'create-class-feedback create-class-feedback--error';
    el.textContent = msg;
    el.style.display = 'block';
}

function showCreateClassSuccess(msg) {
    let el = document.getElementById('create-class-feedback');
    if (!el) {
        el = document.createElement('div');
        el.id = 'create-class-feedback';
        document.getElementById('create-class-form').prepend(el);
    }
    el.className = 'create-class-feedback create-class-feedback--success';
    el.textContent = msg;
    el.style.display = 'block';
}

function showCreateClass() {
    const modal = document.getElementById('create-class-modal');
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };
    
    modal.classList.add('active');

    // Clear any previous feedback
    const fb = document.getElementById('create-class-feedback');
    if (fb) fb.style.display = 'none';
}

// Create class — cancel button
document.getElementById('cancel-create-class').addEventListener('click', () => {
    document.getElementById('create-class-modal').classList.remove('active');
    document.getElementById('create-class-form').reset();
});

// Create class form submission
document.getElementById('create-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const crn     = document.getElementById('new-class-crn').value.trim();
    const name    = document.getElementById('new-class-name').value.trim();
    const semester = document.getElementById('new-class-semester').value;

    if (!crn || !name || !semester) {
        showCreateClassError('Please fill in all required fields (CRN, Course Name, Semester).');
        return;
    }

    if (!isValidCRN(crn)) {
        showCreateClassError('CRN must be exactly 5 digits.');
        return;
    }

    const classData = {
        crn_code:    crn,
        course_name: name,
        section:     document.getElementById('new-class-section').value.trim() || null,
        description: document.getElementById('new-class-description').value.trim() || null,
        semester:    semester,
        capacity:    document.getElementById('new-class-capacity').value ? parseInt(document.getElementById('new-class-capacity').value) : null,
        start_date:  document.getElementById('new-class-start').value || null,
        end_date:    document.getElementById('new-class-end').value || null,
        meeting_days: document.getElementById('new-class-days').value || null,
        location:    document.getElementById('new-class-location').value.trim() || null,
    };

    const submitBtn = document.getElementById('submit-create-class');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    try {
        const response = await fetch(`${API_URL}/crns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(classData)
        });

        if (response.ok) {
            showCreateClassSuccess(`"${name}" was created successfully!`);
            setTimeout(() => {
                document.getElementById('create-class-modal').classList.remove('active');
                document.getElementById('create-class-form').reset();
                loadClassInfo();
                loadUserProfile();
            }, 1500);
        } else {
            const error = await response.json();
            showCreateClassError('Failed to create class: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating class:', error);
        showCreateClassError('A network error occurred. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-icon">✚</span> Create Class';
    }
});

async function loadClassInfo() {
    try {
        if (currentUser && currentUser.role === 'faculty') {
            const response = await fetch(`${API_URL}/my-classes`, {
                credentials: 'include'
            });

            if (response.ok) {
                const classes = await response.json();
                displayFacultyClassInfo(classes);
            } else {
                document.getElementById('class-info-content').innerHTML =
                    '<p>No classes found for this faculty account yet.</p>';
            }
            return;
        }

        const response = await fetch(`${API_URL}/class-info`, {
            credentials: 'include'
        });

        if (response.ok) {
            const classInfo = await response.json();
            displayClassInfo(classInfo);
            // Student has a class — hide the join card
            const joinCard = document.getElementById('join-class-card');
            if (joinCard) joinCard.style.display = 'none';
        } else {
            document.getElementById('class-info-content').innerHTML = '<p>No class information available</p>';
            // Show join card only for students without a class
            if (currentUser && currentUser.role === 'student') {
                const joinCard = document.getElementById('join-class-card');
                if (joinCard) joinCard.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading class info:', error);
        document.getElementById('class-info-content').innerHTML = 
            '<p>Error loading class information</p>';
    }
}

async function joinClass() {
    const input = document.getElementById('join-crn-input');
    const feedback = document.getElementById('join-class-feedback');
    const crn_code = input.value.trim();

    if (!crn_code) {
        showJoinFeedback('Please enter a CRN code.', 'error');
        return;
    }

    if (!isValidCRN(crn_code)) {
        showJoinFeedback('CRN must be exactly 5 digits.', 'error');
        return;
    }

    const btn = document.querySelector('#join-class-card .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Joining…';

    try {
        const response = await fetch(`${API_URL}/join-class`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ crn_code })
        });

        const data = await response.json();

        if (response.ok) {
            showJoinFeedback(`✓ ${data.message}`, 'success');
            input.value = '';
            // Update stored user and refresh dashboard
            currentUser.crn = data.crn_code;
            localStorage.setItem('user', JSON.stringify(currentUser));
            setTimeout(() => {
                document.getElementById('join-class-card').style.display = 'none';
                loadClassInfo();
                loadProjects();
            }, 1200);
        } else {
            showJoinFeedback(data.error || 'Failed to join class.', 'error');
        }
    } catch (error) {
        showJoinFeedback('A network error occurred. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Join Class';
    }
}

function showJoinFeedback(msg, type) {
    const el = document.getElementById('join-class-feedback');
    el.textContent = msg;
    el.className = `join-class-feedback join-class-feedback--${type}`;
    el.style.display = 'block';
}

function displayClassInfo(classInfo) {
    const container = document.getElementById('class-info-content');
    
    container.innerHTML = `
        <div class="class-info-grid">
            <div class="class-info-item">
                <label>Class Code:</label>
                <span>${escapeHtml(classInfo.crn_code)}</span>
            </div>
            <div class="class-info-item">
                <label>Course Name:</label>
                <span>${escapeHtml(classInfo.course_name)}</span>
            </div>
            <div class="class-info-item">
                <label>Instructor:</label>
                <span>${escapeHtml(classInfo.faculty_name)}</span>
            </div>
            <div class="class-info-item">
                <label>Students Enrolled:</label>
                <span>${classInfo.student_count}</span>
            </div>
            <div class="class-info-item">
                <label>Faculty Members:</label>
                <span>${classInfo.faculty_count}</span>
            </div>
            <div class="class-info-item">
                <label>Active Projects:</label>
                <span>${classInfo.project_count}</span>
            </div>
        </div>
    `;
}

function displayFacultyClassInfo(classes) {
    const container = document.getElementById('class-info-content');

    if (!classes || classes.length === 0) {
        container.innerHTML = '<p>No classes found for this faculty account yet.</p>';
        return;
    }

    container.innerHTML = `
        <div class="class-info-grid">
            <div class="class-info-item">
                <label>Classes Taught:</label>
                <span>${classes.length}</span>
            </div>
            <div class="class-info-item">
                <label>Total Students:</label>
                <span>${classes.reduce((sum, cls) => sum + (cls.student_count || 0), 0)}</span>
            </div>
            <div class="class-info-item">
                <label>Total Projects:</label>
                <span>${classes.reduce((sum, cls) => sum + (cls.project_count || 0), 0)}</span>
            </div>
        </div>
        <div class="faculty-class-summary-list">
            ${classes.map(cls => `
                <div class="faculty-class-summary-card">
                    <div class="faculty-class-summary-header">
                        <strong>${escapeHtml(cls.crn_code)}</strong>
                        <span>${escapeHtml(cls.course_name)}</span>
                    </div>
                    <div class="faculty-class-summary-meta">
                        <span>${cls.student_count} students</span>
                        <span>${cls.project_count} projects</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadFaculty() {
    try {
        const response = await fetch(`${API_URL}/faculty`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const faculty = await response.json();
            displayFaculty(faculty);
        }
    } catch (error) {
        console.error('Error loading faculty:', error);
    }
}

function displayFaculty(facultyList) {
    const grid = document.getElementById('faculty-grid');
    
    if (facultyList.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>No faculty members found</h3><p>No faculty in your class yet</p></div>';
        return;
    }
    
    grid.innerHTML = facultyList.map(faculty => {
        const showMsg = currentUser && faculty.id !== currentUser.id;
        const classBadge = faculty.crn_code ? `<span class="tag">CRN ${escapeHtml(faculty.crn_code)}</span>` : '';
        return `
        <div class="faculty-card">
            <div class="student-card-header">
                <h3>${faculty.title ? faculty.title + ' ' : ''}${faculty.name}</h3>
                ${showMsg ? `<button class="msg-icon-btn" onclick="openDirectMessage(${faculty.id}, '${escapeHtml(faculty.name)}')" title="Message ${faculty.name}" aria-label="Send message to ${faculty.name}">✉️</button>` : ''}
            </div>
            <p class="faculty-email">${faculty.email}</p>
            <div class="faculty-meta">
                <span>Faculty Member</span>
                ${classBadge}
            </div>
        </div>
    `}).join('');
}

// Update loadDashboard to include new features
const originalLoadDashboard = loadDashboard;
loadDashboard = async function() {
    await originalLoadDashboard();
    loadUserStories();
    if (currentUser && currentUser.role === 'student') {
        loadAssignmentCalendar();
    }
};

// ==========================================
// CUSTOM PROJECTS FUNCTIONS
// ==========================================

let cpFeedbackAction = null;   // 'approve' | 'deny'
let cpFeedbackProposalId = null;
let customProjectsListenersBound = false;

function setupCustomProjectsEventListeners() {
    if (customProjectsListenersBound) return;

    const pendingList = document.getElementById('faculty-cp-pending-list');
    if (pendingList) {
        pendingList.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('button[data-cp-action][data-cp-proposal-id]');
            if (!actionBtn) return;

            const proposalId = parseInt(actionBtn.getAttribute('data-cp-proposal-id'), 10);
            const action = actionBtn.getAttribute('data-cp-action');
            if (!proposalId || (action !== 'approve' && action !== 'deny')) return;

            const confirmed = window.confirm(
                action === 'approve'
                    ? 'Approve this proposal and create a live project?'
                    : 'Deny this proposal?'
            );
            if (!confirmed) return;

            actionBtn.disabled = true;
            reviewCustomProjectProposal(proposalId, action)
                .finally(() => {
                    actionBtn.disabled = false;
                });
        });
    }

    const feedbackCloseBtn = document.getElementById('cp-feedback-close');
    if (feedbackCloseBtn) {
        feedbackCloseBtn.addEventListener('click', closeCPFeedbackModal);
    }

    customProjectsListenersBound = true;
}

function handleFacultyProposalAction(proposalId, action) {
    const confirmed = window.confirm(
        action === 'approve'
            ? 'Approve this proposal and create a live project?'
            : 'Deny this proposal?'
    );
    if (!confirmed) return;

    reviewCustomProjectProposal(proposalId, action);
}

// ---- Open/close the main Custom Projects modal ----

function showCustomProjects() {
    const modal = document.getElementById('custom-projects-modal');
    const closeBtn = modal.querySelector('.close');

    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };

    // Wire up form submit every time modal opens (matches Create Class pattern)
    const form = document.getElementById('custom-project-form');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const proposalData = {
            name: document.getElementById('cp-project-name').value,
            description: document.getElementById('cp-project-description').value,
            course: document.getElementById('cp-project-course').value,
            capacity: parseInt(document.getElementById('cp-project-capacity').value)
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';

        try {
            const response = await fetch(`${API_URL}/custom-projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(proposalData)
            });

            if (response.ok) {
                alert('Proposal submitted! A faculty member will review it soon.');
                form.reset();
                switchCPTab('my-proposals');
                loadMyProposals();
            } else {
                const err = await response.json();
                alert('Failed to submit: ' + (err.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error submitting custom project:', error);
            alert('A network error occurred. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit for Approval';
        }
    };

    if (currentUser.role === 'student') {
        document.getElementById('custom-projects-student-view').style.display = 'block';
        document.getElementById('custom-projects-faculty-view').style.display = 'none';
        // Default to the submit tab and load proposals
        switchCPTab('propose');
        loadMyProposals();
    } else {
        document.getElementById('custom-projects-student-view').style.display = 'none';
        document.getElementById('custom-projects-faculty-view').style.display = 'block';
        // Default to pending tab and load all proposals
        switchFacultyCP('pending');
        loadFacultyProposals();
    }

    modal.classList.add('active');
}

// Click outside modals to close
window.addEventListener('click', (e) => {
    const cpModal = document.getElementById('custom-projects-modal');
    if (e.target === cpModal) cpModal.classList.remove('active');
    const fbModal = document.getElementById('cp-feedback-modal');
    if (e.target === fbModal) fbModal.classList.remove('active');
});
// ---- Tab switching helpers ----

function switchCPTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('#custom-projects-student-view .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cptab === tabName);
    });
    document.getElementById('cp-propose-tab').classList.toggle('active', tabName === 'propose');
    document.getElementById('cp-my-proposals-tab').classList.toggle('active', tabName === 'my-proposals');

    if (tabName === 'my-proposals') {
        loadMyProposals();
    }
}

function switchFacultyCP(tabName) {
    document.querySelectorAll('#custom-projects-faculty-view .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cptab === tabName);
    });
    document.getElementById('faculty-cp-pending-list').style.display = tabName === 'pending' ? 'block' : 'none';
    document.getElementById('faculty-cp-reviewed-list').style.display = tabName === 'reviewed' ? 'block' : 'none';
}

// ---- Student: load their own proposals ----

async function loadMyProposals() {
    const container = document.getElementById('my-proposals-list');
    container.innerHTML = '<p>Loading…</p>';

    try {
        const response = await fetch(`${API_URL}/custom-projects`, {
            credentials: 'include'
        });

        if (!response.ok) {
            container.innerHTML = '<p>Error loading proposals.</p>';
            return;
        }

        const proposals = await response.json();

        if (proposals.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No proposals yet</h3><p>Use the Submit Proposal tab to propose your first project.</p></div>';
            return;
        }

        container.innerHTML = proposals.map(p => {
            const statusClass = p.approval_status === 'approved' ? 'status-open'
                              : p.approval_status === 'denied'   ? 'status-full'
                              : 'status-pending';
            const statusLabel = p.approval_status.charAt(0).toUpperCase() + p.approval_status.slice(1);

            return `
                <div class="project-card">
                    <div class="project-card-header">
                        <div>
                            <h3>${escapeHtml(p.name)}</h3>
                            <small>${escapeHtml(p.course)}</small>
                        </div>
                        <span class="project-status ${statusClass}">${statusLabel}</span>
                    </div>
                    <p>${escapeHtml(p.description)}</p>
                    <div class="project-meta">
                        <span>Team capacity: ${p.capacity}</span>
                        <span>Submitted: ${new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    ${p.faculty_feedback ? `
                        <div class="cp-faculty-feedback">
                            <strong>Faculty feedback:</strong> ${escapeHtml(p.faculty_feedback)}
                        </div>
                    ` : ''}
                    ${p.approval_status === 'approved' && p.approved_project_id ? `
                        <div class="cp-approved-note">
                            ✅ This project is now live! <a href="#" onclick="openProjectModal(${p.approved_project_id}); document.getElementById('custom-projects-modal').classList.remove('active');">View Project</a>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading proposals:', error);
        container.innerHTML = '<p>Error loading proposals.</p>';
    }
}

// ---- Faculty: load and display all proposals ----

async function loadFacultyProposals() {
    const pendingContainer = document.getElementById('faculty-cp-pending-list');
    const reviewedContainer = document.getElementById('faculty-cp-reviewed-list');
    pendingContainer.innerHTML = '<p>Loading…</p>';
    reviewedContainer.innerHTML = '<p>Loading…</p>';

    try {
        const response = await fetch(`${API_URL}/custom-projects`, {
            credentials: 'include'
        });

        if (!response.ok) {
            pendingContainer.innerHTML = '<p>Error loading proposals.</p>';
            return;
        }

        const proposals = await response.json();

        const pending  = proposals.filter(p => p.approval_status === 'pending');
        const reviewed = proposals.filter(p => p.approval_status !== 'pending');

        renderFacultyProposals(pendingContainer,  pending,  true);
        renderFacultyProposals(reviewedContainer, reviewed, false);

    } catch (error) {
        console.error('Error loading faculty proposals:', error);
        pendingContainer.innerHTML = '<p>Error loading proposals.</p>';
    }
}

function renderFacultyProposals(container, proposals, showActions) {
    if (proposals.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No proposals here</h3></div>';
        return;
    }

    container.innerHTML = proposals.map(p => {
        const statusClass = p.approval_status === 'approved' ? 'status-open'
                          : p.approval_status === 'denied'   ? 'status-full'
                          : 'status-pending';
        const statusLabel = p.approval_status.charAt(0).toUpperCase() + p.approval_status.slice(1);

        return `
            <div class="project-card cp-faculty-card">
                <div class="project-card-header">
                    <div>
                        <h3>${escapeHtml(p.name)}</h3>
                        <small>${escapeHtml(p.course)} &nbsp;•&nbsp; Proposed by <strong>${escapeHtml(p.proposer.name)}</strong></small>
                    </div>
                    <span class="project-status ${statusClass}">${statusLabel}</span>
                </div>
                <p>${escapeHtml(p.description)}</p>
                <div class="project-meta">
                    <span>Team capacity: ${p.capacity}</span>
                    <span>Submitted: ${new Date(p.created_at).toLocaleDateString()}</span>
                    ${p.reviewed_at ? `<span>Reviewed: ${new Date(p.reviewed_at).toLocaleDateString()}</span>` : ''}
                </div>
                ${p.faculty_feedback ? `
                    <div class="cp-faculty-feedback">
                        <strong>Your feedback:</strong> ${escapeHtml(p.faculty_feedback)}
                    </div>
                ` : ''}
                ${showActions ? `
                    <div class="cp-review-actions">
                        <button type="button" class="btn btn-primary btn-sm" data-cp-action="approve" data-cp-proposal-id="${p.id}" onclick="handleFacultyProposalAction(${p.id}, 'approve')">Approve</button>
                        <button type="button" class="btn btn-danger btn-sm" data-cp-action="deny" data-cp-proposal-id="${p.id}" onclick="handleFacultyProposalAction(${p.id}, 'deny')">Deny</button>
                    </div>
                ` : ''}
                ${p.approval_status === 'approved' && p.approved_project_id ? `
                    <div class="cp-approved-note">
                        ✅ Project is live. <a href="#" onclick="openProjectModal(${p.approved_project_id}); document.getElementById('custom-projects-modal').classList.remove('active');">View Project</a>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ---- Faculty: open the feedback/confirmation modal ----

function openCPFeedbackModal(proposalId, action) {
    cpFeedbackAction = action;
    cpFeedbackProposalId = proposalId;

    const modal = document.getElementById('cp-feedback-modal');
    const closeBtn = modal.querySelector('.close');

    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };

    const title    = document.getElementById('cp-feedback-title');
    const subtitle = document.getElementById('cp-feedback-subtitle');
    const confirmBtn = document.getElementById('cp-feedback-confirm-btn');

    if (action === 'approve') {
        title.textContent = '✔ Approve Proposal';
        subtitle.textContent = 'This will create a live project from the student\'s proposal. You may leave optional feedback.';
        confirmBtn.textContent = 'Approve Project';
        confirmBtn.className = 'btn btn-primary';
    } else {
        title.textContent = '✘ Deny Proposal';
        subtitle.textContent = 'The student will be notified that their proposal was not approved. Consider leaving feedback explaining why.';
        confirmBtn.textContent = 'Deny Proposal';
        confirmBtn.className = 'btn btn-danger';
    }

    document.getElementById('cp-feedback-text').value = '';
    
    // Wire up confirm button every time modal opens (matches Create Class pattern)
    document.getElementById('cp-feedback-confirm-btn').onclick = async () => {
        if (!cpFeedbackAction || !cpFeedbackProposalId) return;

        const feedback = document.getElementById('cp-feedback-text').value.trim();
        const btn = document.getElementById('cp-feedback-confirm-btn');
        btn.disabled = true;
        btn.textContent = 'Processing…';

        try {
            await reviewCustomProjectProposal(cpFeedbackProposalId, cpFeedbackAction, feedback);
            closeCPFeedbackModal();
        } finally {
            btn.disabled = false;
            btn.textContent = cpFeedbackAction === 'approve' ? 'Approve Project' : 'Deny Proposal';
        }
    };

    document.getElementById('cp-feedback-modal').classList.add('active');
}

function closeCPFeedbackModal() {
    document.getElementById('cp-feedback-modal').classList.remove('active');
    cpFeedbackAction = null;
    cpFeedbackProposalId = null;
}

async function reviewCustomProjectProposal(proposalId, action, feedback = '') {
    try {
        const response = await fetch(`${API_URL}/custom-projects/${proposalId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, feedback })
        });

        let payload = {};
        try {
            payload = await response.json();
        } catch (_) {
            payload = {};
        }

        if (!response.ok) {
            const msg = payload.error || 'Unknown error';
            alert(`Review failed (${response.status}): ${msg}`);
            return;
        }

        alert(payload.message || 'Review submitted.');
        loadFacultyProposals();
        if (action === 'approve') {
            loadProjects();
        }
    } catch (error) {
        console.error('Error reviewing proposal:', error);
        alert('A network error occurred while reviewing the proposal.');
    }
}
