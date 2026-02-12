// API Configuration
const API_URL = 'http://localhost:5000/api';

// Global State
let currentUser = null;
let currentProject = null;
let projects = [];
let students = [];

// Security Helper
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// Custom submissions state
let customSubmissions = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkAuthStatus();
});

// Event Listeners
function initializeEventListeners() {
    // Auth Forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('register-page');
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('login-page');
    });

    // Role-based fields
    document.getElementById('role').addEventListener('change', (e) => {
        const studentFields = document.getElementById('student-fields');
        const facultyFields = document.getElementById('faculty-fields');
        
        if (e.target.value === 'student') {
            studentFields.style.display = 'block';
            facultyFields.style.display = 'none';
        } else if (e.target.value === 'faculty') {
            studentFields.style.display = 'none';
            facultyFields.style.display = 'block';
        } else {
            studentFields.style.display = 'none';
            facultyFields.style.display = 'none';
        }
    });

    // Navigation
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
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
    document.getElementById('project-search').addEventListener('input', (e) => {
        searchProjects(e.target.value);
    });
    
    document.getElementById('student-search').addEventListener('input', (e) => {
        searchStudents(e.target.value);
    });

    // Profile Form
    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);

    // Create Project Form
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProject);

    // Custom Project Form
    const customForm = document.getElementById('custom-project-form');
    if (customForm) customForm.addEventListener('submit', handleCustomProjectSubmit);

    // Project Modal
    setupProjectModal();
    setupCreateProjectModal();
    setupCreateTaskModal();
    setupCreateMilestoneModal();

    // Custom Project Modal
    setupCustomProjectModal();
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(data.user));
            showDashboard();
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
    
    if (formData.role === 'student') {
        formData.crn = document.getElementById('crn').value;
    } else if (formData.role === 'faculty') {
        formData.title = document.getElementById('title').value;
    }
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        
        currentUser = null;
        localStorage.removeItem('user');
        showPage('login-page');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function checkAuthStatus() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
}

// Dashboard
function showDashboard() {
    showPage('dashboard-page');
    
    // Update user info
    const userName = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('user-name').textContent = userName;
    document.getElementById('welcome-name').textContent = currentUser.first_name;
    
    // Show/hide role-specific elements
    updateRoleVisibility();
    
    // Load initial data
    loadProjects();
    loadStudents();
    loadUserProfile();
    showView('overview');

    // Faculty loads submissions list
    if (currentUser.role === 'faculty') {
        loadCustomSubmissions();
    }
}

function updateRoleVisibility() {
    const studentElements = document.querySelectorAll('.student-only');
    const facultyElements = document.querySelectorAll('.faculty-only');
    
    if (currentUser.role === 'student') {
        studentElements.forEach(el => el.style.display = '');
        facultyElements.forEach(el => el.style.display = 'none');
    } else {
        studentElements.forEach(el => el.style.display = 'none');
        facultyElements.forEach(el => el.style.display = '');
    }
}

// Views
function showView(viewName) {
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });
    
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Load data for specific views
    if (viewName === 'projects') {
        loadProjects();
    } else if (viewName === 'students') {
        loadStudents();
    } else if (viewName === 'overview') {
        loadMyProjects();
        if (currentUser.role === 'faculty') loadCustomSubmissions();
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
            
        const response = await fetch(url, { credentials: 'include' });
        
        projects = await response.json();
        displayProjects(projects);
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function displayProjects(projectsList) {
    const grid = document.getElementById('projects-grid');
    
    if (projectsList.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h3>No projects found</h3><p>Try adjusting your search</p></div>';
        return;
    }
    
    grid.innerHTML = projectsList.map(project => `
        <div class="project-card" onclick="openProjectModal(${project.id})">
            <div class="project-card-header">
                <div>
                    <h3>${project.name}</h3>
                    <small>${project.course}</small>
                </div>
                <span class="project-status status-${project.status}">${project.status}</span>
            </div>
            <p>${project.description}</p>
            <div class="project-meta">
                <span>👥 ${project.current_members}/${project.capacity}</span>
                <span>${project.creator.name}</span>
            </div>
        </div>
    `).join('');
}

function searchProjects(keyword) {
    loadProjects(keyword);
}

// NOTE: Your backend /api/projects list endpoint doesn't include team_members,
// so "My Projects" may stay empty. (Not required for custom submission, but FYI.)
async function loadMyProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`, { credentials: 'include' });
        const allProjects = await response.json();

        // fallback: show count as 0 (or adjust backend if you want membership list)
        document.getElementById('project-count').textContent = 0;

        const container = document.getElementById('my-projects-list');
        container.innerHTML = '<div class="empty-state"><h3>My Projects</h3><p>Open a project to see details (membership requires a backend tweak).</p></div>';
    } catch (error) {
        console.error('Error loading my projects:', error);
    }
}

// Students
async function loadStudents(keyword = '') {
    try {
        const url = keyword 
            ? `${API_URL}/students?keyword=${encodeURIComponent(keyword)}`
            : `${API_URL}/students`;
            
        const response = await fetch(url, { credentials: 'include' });
        
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
    
    grid.innerHTML = studentsList.map(student => `
        <div class="student-card">
            <h3>${student.name}</h3>
            <p class="student-bio">${student.biography || 'No biography provided'}</p>
            <div class="student-tags">
                ${student.skills ? student.skills.split(',').map(s => 
                    `<span class="tag">${s.trim()}</span>`
                ).join('') : ''}
            </div>
        </div>
    `).join('');
}

function searchStudents(keyword) {
    loadStudents(keyword);
}

// Profile
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/user/profile`, { credentials: 'include' });
        const profile = await response.json();
        
        document.getElementById('profile-name').value = `${profile.first_name} ${profile.last_name}`;
        document.getElementById('profile-email').value = profile.email;
        document.getElementById('profile-bio').value = profile.biography || '';
        document.getElementById('profile-skills').value = profile.skills || '';
        document.getElementById('profile-interests').value = profile.interests || '';
    } catch (error) {
        console.error('Error loading profile:', error);
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
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });
        
        if (response.ok) {
            alert('Profile updated successfully!');
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
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.onclick = () => {
        modal.classList.remove('active');
    };
    
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    };
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            if (tabName === 'messages') loadMessages(currentProject.id);
            else if (tabName === 'tasks') loadTasks(currentProject.id);
            else if (tabName === 'milestones') loadMilestones(currentProject.id);
        });
    });
    
    document.getElementById('join-project-btn').addEventListener('click', joinProject);
    document.getElementById('leave-project-btn').addEventListener('click', leaveProject);
    document.getElementById('message-form').addEventListener('submit', sendMessage);
}

async function openProjectModal(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}`, { credentials: 'include' });
        currentProject = await response.json();
        
        document.getElementById('project-modal-title').textContent = currentProject.name;
        document.getElementById('project-course').textContent = currentProject.course;
        document.getElementById('project-capacity').textContent = `${currentProject.current_members}/${currentProject.capacity}`;
        document.getElementById('project-status').textContent = currentProject.status;
        document.getElementById('project-creator').textContent = currentProject.creator.name;
        document.getElementById('project-description').textContent = currentProject.description;
        
        const isMember = currentProject.team_members.some(m => m.id === currentUser.id);
        document.getElementById('join-project-btn').style.display = 
            (currentUser.role === 'student' && !isMember && currentProject.status !== 'full') ? '' : 'none';
        document.getElementById('leave-project-btn').style.display = 
            (currentUser.role === 'student' && isMember) ? '' : 'none';
        
        displayTeamMembers(currentProject.team_members);
        
        document.getElementById('project-modal').classList.add('active');
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="overview"]').classList.add('active');
        document.getElementById('overview-tab').classList.add('active');
        
    } catch (error) {
        console.error('Error loading project:', error);
        alert('Failed to load project details');
    }
}

function displayTeamMembers(members) {
    const container = document.getElementById('team-members-list');
    if (members.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No team members yet</h3></div>';
        return;
    }
    container.innerHTML = members.map(member => `
        <div class="team-member">
            <h4>${member.name}</h4>
            <p>${member.skills || 'No skills listed'}</p>
            <small>Joined: ${new Date(member.joined_at).toLocaleDateString()}</small>
        </div>
    `).join('');
}

async function joinProject() {
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/join`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            alert('Successfully joined project!');
            openProjectModal(currentProject.id);
            loadProjects();
        } else {
            alert(data.error || 'Failed to join project');
        }
    } catch (error) {
        console.error('Error joining project:', error);
        alert('An error occurred');
    }
}

async function leaveProject() {
    if (!confirm('Are you sure you want to leave this project?')) return;
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/leave`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            alert('Successfully left project');
            document.getElementById('project-modal').classList.remove('active');
            loadProjects();
        } else {
            alert(data.error || 'Failed to leave project');
        }
    } catch (error) {
        console.error('Error leaving project:', error);
        alert('An error occurred');
    }
}

// Messages
async function loadMessages(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}/messages`, { credentials: 'include' });
        const messages = await response.json();
        displayMessages(messages);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messages-list');
    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No messages yet</h3><p>Start the conversation!</p></div>';
        return;
    }
    container.innerHTML = messages.map(msg => `
        <div class="message">
            <div class="message-header">
                <span class="message-sender">${msg.sender.name}</span>
                <span class="message-time">${new Date(msg.created_at).toLocaleString()}</span>
            </div>
            <div class="message-content">${msg.content}</div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage(e) {
    e.preventDefault();
    const content = document.getElementById('message-input').value;
    if (!content.trim()) return;
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content, message_type: 'group' })
        });
        if (response.ok) {
            document.getElementById('message-input').value = '';
            loadMessages(currentProject.id);
        } else {
            alert('Failed to send message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('An error occurred');
    }
}

// Tasks
async function loadTasks(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, { credentials: 'include' });
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
        const response = await fetch(`${API_URL}/projects/${projectId}/milestones`, { credentials: 'include' });
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
            <div class="milestone-meta">Due: ${new Date(milestone.due_date).toLocaleDateString()}</div>
        </div>
    `).join('');
}

// Create Project
function setupCreateProjectModal() {
    const modal = document.getElementById('create-project-modal');
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.classList.remove('active');
}
function showCreateProject() {
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
    try {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(projectData)
        });
        if (response.ok) {
            alert('Project created successfully!');
            document.getElementById('create-project-modal').classList.remove('active');
            document.getElementById('create-project-form').reset();
            loadProjects();
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
    closeBtn.onclick = () => modal.classList.remove('active');
    document.getElementById('create-task-form').addEventListener('submit', handleCreateTask);
}
function showCreateTask() {
    const select = document.getElementById('new-task-assignee');
    select.innerHTML = '<option value="">Unassigned</option>' +
        currentProject.team_members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
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
            headers: { 'Content-Type': 'application/json' },
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
    closeBtn.onclick = () => modal.classList.remove('active');
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
            headers: { 'Content-Type': 'application/json' },
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

// Custom Project Submission
function setupCustomProjectModal() {
    const modal = document.getElementById('custom-project-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.classList.remove('active');

    window.addEventListener('click', (event) => {
        if (event.target === modal) modal.classList.remove('active');
    });
}

function showCustomProjectModal() {
    const modal = document.getElementById('custom-project-modal');
    if (!modal) return;
    modal.classList.add('active');
}

async function handleCustomProjectSubmit(e) {
    e.preventDefault();

    const payload = {
        name: document.getElementById('custom-project-name').value,
        description: document.getElementById('custom-project-description').value,
        course: document.getElementById('custom-project-course').value,
        capacity: parseInt(document.getElementById('custom-project-capacity').value),
        notes: document.getElementById('custom-project-notes').value || ''
    };

    try {
        const response = await fetch(`${API_URL}/custom-projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            alert('Custom project submitted! (Pending review)');
            document.getElementById('custom-project-modal').classList.remove('active');
            document.getElementById('custom-project-form').reset();

            // Faculty refreshes review list
            if (currentUser.role === 'faculty') {
                loadCustomSubmissions();
            }
        } else {
            alert(data.error || 'Failed to submit custom project');
        }
    } catch (err) {
        console.error('Custom project submit error:', err);
        alert('An error occurred submitting the project');
    }
}

async function loadCustomSubmissions() {
    try {
        const response = await fetch(`${API_URL}/custom-projects`, {
            credentials: 'include'
        });

        const data = await response.json();
        customSubmissions = data;
        displayCustomSubmissions(customSubmissions);
    } catch (err) {
        console.error('Error loading custom submissions:', err);
    }
}

function displayCustomSubmissions(submissions) {
    const container = document.getElementById('custom-submissions-list');

    if (!submissions || submissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No submissions yet</h3>
                <p>${currentUser.role === 'faculty'
                    ? 'When students submit proposals, they will appear here.'
                    : 'Submit a custom project proposal to get started.'}
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = submissions.map(s => `
        <div class="submission-item">
            <div class="submission-header">
                <div>
                    <h3>${escapeHtml(s.name)}</h3>
                    <div class="proposal-meta">
                        <span><strong>Course:</strong> ${escapeHtml(s.course)}</span>
                        <span><strong>Capacity:</strong> ${escapeHtml(String(s.capacity))}</span>
                        <span><strong>Submitted by:</strong> ${escapeHtml(s.submitter_name || 'Unknown')}</span>
                        <span><strong>Date:</strong> ${new Date(s.created_at).toLocaleString()}</span>
                    </div>
                </div>

                <span class="badge badge-${escapeHtml(s.status)}">${escapeHtml(s.status)}</span>
            </div>

            <p>${escapeHtml(s.description)}</p>
            ${s.notes ? `<p><strong>Notes:</strong> ${escapeHtml(s.notes)}</p>` : ''}

            ${currentUser.role === 'faculty' && s.status === 'pending' ? `
                <div class="proposal-actions">
                    <button class="btn btn-primary btn-sm" onclick="reviewSubmission(${s.id}, 'approved')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="reviewSubmission(${s.id}, 'rejected')">Reject</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function reviewSubmission(submissionId, decision) {
    try {
        const response = await fetch(`${API_URL}/custom-projects/${submissionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: decision })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Updated!');
            loadCustomSubmissions();
            if (decision === 'approved') {
                // Refresh projects list because approval creates a new Project
                loadProjects();
            }
        } else {
            alert(data.error || 'Failed to update submission');
        }
    } catch (err) {
        console.error('Review submission error:', err);
        alert('Error reviewing submission');
    }
}
