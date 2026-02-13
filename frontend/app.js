// API Configuration
const API_URL = 'http://localhost:5001/api';

// Global State
let currentUser = null;
let currentProject = null;
let projects = [];
let students = [];
let currentPage = 1;
let userProjectId = null;  // Track which project the user is in
const PROJECTS_PER_PAGE = 6;

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

    // Project Modal
    setupProjectModal();
    setupCreateProjectModal();
    setupCreateTaskModal();
    setupCreateMilestoneModal();
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
    checkUserProjectMembership();  // Check which project user is in
    showView('overview');
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
                <span class="project-status status-${statusClass}">${statusText}</span>
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

async function checkUserProjectMembership() {
    try {
        const response = await fetch(`${API_URL}/projects`, {
            credentials: 'include'
        });
        
        const allProjects = await response.json();
        
        // Find project the user is in (if student)
        if (currentUser.role === 'student') {
            const userProject = allProjects.find(p => 
                p.team_members && p.team_members.some(m => m.id === currentUser.id)
            );
            userProjectId = userProject ? userProject.id : null;
        }
    } catch (error) {
        console.error('Error checking project membership:', error);
    }
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
        const response = await fetch(`${API_URL}/user/profile`, {
            credentials: 'include'
        });
        
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
            headers: {
                'Content-Type': 'application/json',
            },
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
            
            // Load tab-specific data
            if (tabName === 'messages') {
                loadMessages(currentProject.id);
            } else if (tabName === 'tasks') {
                loadTasks(currentProject.id);
            } else if (tabName === 'milestones') {
                loadMilestones(currentProject.id);
            }
        });
    });
    
    // Join/Leave buttons
    document.getElementById('join-project-btn').addEventListener('click', joinProject);
    document.getElementById('leave-project-btn').addEventListener('click', leaveProject);
    
    // Message form
    document.getElementById('message-form').addEventListener('submit', sendMessage);
}

async function openProjectModal(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}`, {
            credentials: 'include'
        });
        
        currentProject = await response.json();
        
        // Populate modal
        document.getElementById('project-modal-title').textContent = currentProject.name;
        document.getElementById('project-course').textContent = currentProject.course;
        document.getElementById('project-capacity').textContent = 
            `${currentProject.current_members}/${currentProject.capacity}`;
        document.getElementById('project-status').textContent = currentProject.status;
        document.getElementById('project-creator').textContent = currentProject.creator.name;
        document.getElementById('project-description').textContent = currentProject.description;
        
        // Update join/leave buttons
        const isMember = currentProject.team_members.some(m => m.id === currentUser.id);
        const isInAnotherProject = userProjectId && userProjectId !== currentProject.id;
        
        // Show join button only if: student, not member, project not full, and not in another project
        document.getElementById('join-project-btn').style.display = 
            (currentUser.role === 'student' && !isMember && currentProject.status !== 'full' && !isInAnotherProject) ? 'inline-block' : 'none';
        document.getElementById('leave-project-btn').style.display = 
            (currentUser.role === 'student' && isMember) ? 'inline-block' : 'none';
        
        // Show message if student is in another project
        const joinBtn = document.getElementById('join-project-btn');
        if (isInAnotherProject && joinBtn) {
            joinBtn.title = 'You are already in a project and cannot join another';
        }
        
        // Load team members
        displayTeamMembers(currentProject.team_members);
        
        // Show modal
        document.getElementById('project-modal').classList.add('active');
        
        // Reset to overview tab
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
    // Check if already in a project
    if (userProjectId) {
        alert('You are already in a project. You cannot join another project.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/join`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Successfully joined project!');
            userProjectId = currentProject.id;  // Update tracking
            openProjectModal(currentProject.id);
            loadProjects();
            loadMyProjects();  // Refresh my projects
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
            userProjectId = null;  // Clear tracking
            document.getElementById('project-modal').classList.remove('active');
            loadProjects();
            loadMyProjects();  // Refresh my projects
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
        const response = await fetch(`${API_URL}/projects/${projectId}/messages`, {
            credentials: 'include'
        });
        
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
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendMessage(e) {
    e.preventDefault();
    
    const content = document.getElementById('message-input').value;
    
    if (!content.trim()) return;
    
    try {
        const response = await fetch(`${API_URL}/projects/${currentProject.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
