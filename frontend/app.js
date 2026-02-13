// API Configuration
const API_URL = 'http://localhost:5001/api';

// Global State
let currentUser = null;
let currentProject = null;
let projects = [];
let students = [];
let currentPage = 1;
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
    } else {
        // Load available CRNs for registration
        loadCRNs();
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
        facultyElements.forEach(el => el.style.display = '');
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
        loadUserStories();  // Load announcements in overview
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
        
        // Display CRNs for faculty
        if (currentUser.role === 'faculty' && profile.crns_created) {
            displayCRNs(profile.crns_created);
        }
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
        
        // Update join/leave buttons visibility
        const joinBtn = document.getElementById('join-project-btn');
        const leaveBtn = document.getElementById('leave-project-btn');
        
        if (currentUser.role === 'student') {
            const isMember = currentProject.team_members.some(m => m.id === currentUser.id);
            const isFull = currentProject.status === 'full';
            
            // Show join button if: not a member AND project not full
            if (!isMember && !isFull) {
                joinBtn.style.display = 'inline-block';
                leaveBtn.style.display = 'none';
            } 
            // Show leave button if: is a member
            else if (isMember) {
                joinBtn.style.display = 'none';
                leaveBtn.style.display = 'inline-block';
            }
            // Hide both if: not a member AND project is full
            else {
                joinBtn.style.display = 'none';
                leaveBtn.style.display = 'none';
            }
        } else {
            // Faculty shouldn't see these buttons
            joinBtn.style.display = 'none';
            leaveBtn.style.display = 'none';
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
        
        return `
            <div class="user-story-card priority-${story.priority}">
                <div class="user-story-header">
                    <h3 class="user-story-title">${escapeHtml(story.title)}</h3>
                    <div class="user-story-meta">
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
    
    // Load user's projects for project selection
    if (currentUser.role === 'student' || currentUser.role === 'faculty') {
        try {
            const response = await fetch(`${API_URL}/projects`, {
                credentials: 'include'
            });
            
            const allProjects = await response.json();
            
            // For students, filter to their projects; for faculty, show all
            const userProjects = currentUser.role === 'student' 
                ? allProjects.filter(p => p.team_members && p.team_members.some(m => m.id === currentUser.id))
                : allProjects;
            
            const projectSelect = document.getElementById('new-story-project');
            if (projectSelect) {
                projectSelect.innerHTML = currentUser.role === 'faculty' 
                    ? '<option value="">All Students in CRN</option>' 
                    : '<option value="">Select a project</option>';
                
                userProjects.forEach(project => {
                    projectSelect.innerHTML += `<option value="${project.id}">${project.name}</option>`;
                });
            }
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
    
    // For students, include project_id
    if (currentUser.role === 'student') {
        const projectSelect = document.getElementById('new-story-project');
        if (!projectSelect.value) {
            alert('Please select a project for your announcement');
            return;
        }
        storyData.project_id = parseInt(projectSelect.value);
    } else {
        // For faculty, project_id is optional (NULL means CRN-wide)
        const projectSelect = document.getElementById('new-story-project');
        if (projectSelect && projectSelect.value) {
            storyData.project_id = parseInt(projectSelect.value);
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
            displayCRNs(crns);
            
            // Also populate the registration CRN select
            populateRegistrationCRNs(crns);
        }
    } catch (error) {
        console.error('Error loading CRNs:', error);
    }
}

function displayCRNs(crns) {
    const container = document.getElementById('crn-list');
    
    if (!container) return;  // Faculty profile may not have this element
    
    if (!crns || crns.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No CRNs created yet.</p></div>';
        return;
    }
    
    container.innerHTML = crns.map(crn => `
        <div class="crn-card">
            <div class="crn-header">
                <div>
                    <h4>${crn.crn_code}</h4>
                    <p>${crn.course_name}</p>
                </div>
                <span class="crn-faculty">Faculty: ${crn.faculty_name}</span>
            </div>
            ${currentUser && currentUser.id === crn.faculty_id ? `
                <div class="crn-actions">
                    <button onclick="deleteCRN(${crn.id})" class="btn-danger">Delete</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function populateRegistrationCRNs(crns) {
    const crnSelect = document.getElementById('crn');
    
    if (!crnSelect) return;
    
    crnSelect.innerHTML = '<option value="">Select a CRN</option>';
    crns.forEach(crn => {
        crnSelect.innerHTML += `<option value="${crn.crn_code}">${crn.crn_code} - ${crn.course_name}</option>`;
    });
}

async function createCRN() {
    const crnCode = document.getElementById('new-crn-code').value;
    const courseName = document.getElementById('new-course-name').value;
    
    if (!crnCode || !courseName) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/crns`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                crn_code: crnCode,
                course_name: courseName
            })
        });
        
        if (response.ok) {
            alert('CRN created successfully!');
            document.getElementById('new-crn-code').value = '';
            document.getElementById('new-course-name').value = '';
            loadUserProfile();  // Reload profile to show new CRN
        } else {
            const error = await response.json();
            alert('Failed to create CRN: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating CRN:', error);
        alert('An error occurred');
    }
}

async function deleteCRN(crnId) {
    if (!confirm('Are you sure you want to delete this CRN? Students using this CRN will be affected.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/crns/${crnId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            alert('CRN deleted successfully');
            loadUserProfile();
        } else {
            const error = await response.json();
            alert('Failed to delete CRN: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting CRN:', error);
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

// Update loadDashboard to include new features
const originalLoadDashboard = loadDashboard;
loadDashboard = async function() {
    await originalLoadDashboard();
    loadUserStories();
    if (currentUser && currentUser.role === 'student') {
        loadAssignmentCalendar();
    }
};
