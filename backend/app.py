from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///capstone.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app, supports_credentials=True)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'student' or 'faculty'
    crn = db.Column(db.String(20))
    title = db.Column(db.String(50))
    biography = db.Column(db.Text)
    skills = db.Column(db.Text)
    interests = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    projects_created = db.relationship('Project', backref='creator', lazy=True, foreign_keys='Project.creator_id')
    team_memberships = db.relationship('TeamMember', backref='student', lazy=True)
    messages_sent = db.relationship('Message', backref='sender', lazy=True, foreign_keys='Message.sender_id')
    messages_received = db.relationship('Message', backref='recipient', lazy=True, foreign_keys='Message.recipient_id')
    tasks_assigned = db.relationship('Task', backref='assignee', lazy=True)

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    course = db.Column(db.String(100), nullable=False)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='open')  # 'open' or 'full'
    
    # Relationships
    team_members = db.relationship('TeamMember', backref='project', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='project', lazy=True, cascade='all, delete-orphan')
    tasks = db.relationship('Task', backref='project', lazy=True, cascade='all, delete-orphan')
    milestones = db.relationship('Milestone', backref='project', lazy=True, cascade='all, delete-orphan')

class TeamMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='active')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # NULL for group messages
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='group')  # 'group' or 'direct'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    assignee_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')  # 'pending', 'in_progress', 'completed'
    due_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Milestone(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    due_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='upcoming')  # 'upcoming', 'completed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CRN(db.Model):
    """Course Reference Number model"""
    id = db.Column(db.Integer, primary_key=True)
    crn_code = db.Column(db.String(20), unique=True, nullable=False)
    course_name = db.Column(db.String(200), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    faculty = db.relationship('User', backref='crns_created', lazy=True)

class UserStory(db.Model):
    """User Story/Announcement model for dashboard"""
    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))  # NULL for CRN-wide announcements
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    story_type = db.Column(db.String(20), default='announcement')  # 'announcement', 'update', 'milestone'
    priority = db.Column(db.String(20), default='normal')  # 'low', 'normal', 'high'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = db.relationship('User', backref='user_stories', lazy=True)
    project = db.relationship('Project', backref='announcements', lazy=True)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# API Routes

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    
    # Validate required fields
    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    # Create new user
    user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        first_name=data['first_name'],
        last_name=data['last_name'],
        role=data['role'],
        crn=data.get('crn'),
        title=data.get('title'),
        biography=data.get('biography', ''),
        skills=data.get('skills', ''),
        interests=data.get('interests', '')
    )
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'Registration successful', 'user_id': user.id}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    
    if user and check_password_hash(user.password_hash, data.get('password')):
        login_user(user)
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role
            }
        }), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/user/profile', methods=['GET', 'PUT'])
@login_required
def user_profile():
    if request.method == 'GET':
        profile_data = {
            'id': current_user.id,
            'username': current_user.username,
            'email': current_user.email,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'role': current_user.role,
            'biography': current_user.biography,
            'skills': current_user.skills,
            'interests': current_user.interests,
            'crn': current_user.crn,
            'title': current_user.title
        }
        
        # If faculty, include their created CRNs
        if current_user.role == 'faculty':
            crns = CRN.query.filter_by(faculty_id=current_user.id).all()
            profile_data['crns_created'] = [{
                'id': crn.id,
                'crn_code': crn.crn_code,
                'course_name': crn.course_name,
                'created_at': crn.created_at.isoformat()
            } for crn in crns]
        
        return jsonify(profile_data), 200
    
    elif request.method == 'PUT':
        data = request.json
        current_user.biography = data.get('biography', current_user.biography)
        current_user.skills = data.get('skills', current_user.skills)
        current_user.interests = data.get('interests', current_user.interests)
        db.session.commit()
        return jsonify({'message': 'Profile updated successfully'}), 200

@app.route('/api/projects', methods=['GET', 'POST'])
@login_required
def projects():
    if request.method == 'GET':
        keyword = request.args.get('keyword', '')
        
        if keyword:
            projects_list = Project.query.filter(
                (Project.name.contains(keyword)) | (Project.description.contains(keyword))
            ).all()
        else:
            projects_list = Project.query.all()
        
        return jsonify([{
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'capacity': p.capacity,
            'course': p.course,
            'status': p.status,
            'current_members': len(p.team_members),
            'creator': {
                'name': f"{p.creator.first_name} {p.creator.last_name}",
                'title': p.creator.title
            },
            'created_at': p.created_at.isoformat()
        } for p in projects_list]), 200
    
    elif request.method == 'POST':
        if current_user.role != 'faculty':
            return jsonify({'error': 'Only faculty can create projects'}), 403
        
        data = request.json
        project = Project(
            name=data['name'],
            description=data['description'],
            capacity=data['capacity'],
            course=data['course'],
            creator_id=current_user.id
        )
        
        db.session.add(project)
        db.session.commit()
        
        return jsonify({'message': 'Project created successfully', 'project_id': project.id}), 201

@app.route('/api/projects/<int:project_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def project_detail(project_id):
    project = Project.query.get_or_404(project_id)
    
    if request.method == 'GET':
        return jsonify({
            'id': project.id,
            'name': project.name,
            'description': project.description,
            'capacity': project.capacity,
            'course': project.course,
            'status': project.status,
            'current_members': len(project.team_members),
            'team_members': [{
                'id': tm.student.id,
                'name': f"{tm.student.first_name} {tm.student.last_name}",
                'skills': tm.student.skills,
                'joined_at': tm.joined_at.isoformat()
            } for tm in project.team_members],
            'creator': {
                'id': project.creator.id,
                'name': f"{project.creator.first_name} {project.creator.last_name}",
                'title': project.creator.title
            }
        }), 200
    
    elif request.method == 'PUT':
        if current_user.role != 'faculty' or project.creator_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.json
        project.name = data.get('name', project.name)
        project.description = data.get('description', project.description)
        project.capacity = data.get('capacity', project.capacity)
        project.course = data.get('course', project.course)
        
        db.session.commit()
        return jsonify({'message': 'Project updated successfully'}), 200
    
    elif request.method == 'DELETE':
        if current_user.role != 'faculty' or project.creator_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        db.session.delete(project)
        db.session.commit()
        return jsonify({'message': 'Project deleted successfully'}), 200

@app.route('/api/projects/<int:project_id>/join', methods=['POST'])
@login_required
def join_project(project_id):
    if current_user.role != 'student':
        return jsonify({'error': 'Only students can join projects'}), 403
    
    project = Project.query.get_or_404(project_id)
    
    # Check if already a member
    existing = TeamMember.query.filter_by(
        project_id=project_id,
        student_id=current_user.id
    ).first()
    
    if existing:
        return jsonify({'error': 'Already a member of this project'}), 400
    
    # Check capacity
    if len(project.team_members) >= project.capacity:
        return jsonify({'error': 'Project is full'}), 400
    
    # Add team member
    team_member = TeamMember(
        project_id=project_id,
        student_id=current_user.id
    )
    
    db.session.add(team_member)
    
    # Update project status if full
    if len(project.team_members) + 1 >= project.capacity:
        project.status = 'full'
    
    db.session.commit()
    
    return jsonify({'message': 'Successfully joined project'}), 200

@app.route('/api/projects/<int:project_id>/leave', methods=['POST'])
@login_required
def leave_project(project_id):
    team_member = TeamMember.query.filter_by(
        project_id=project_id,
        student_id=current_user.id
    ).first()
    
    if not team_member:
        return jsonify({'error': 'Not a member of this project'}), 400
    
    project = Project.query.get_or_404(project_id)
    
    db.session.delete(team_member)
    
    # Update project status
    if project.status == 'full':
        project.status = 'open'
    
    db.session.commit()
    
    return jsonify({'message': 'Successfully left project'}), 200

@app.route('/api/projects/<int:project_id>/messages', methods=['GET', 'POST'])
@login_required
def project_messages(project_id):
    project = Project.query.get_or_404(project_id)
    
    # Check if user is a team member or creator
    is_member = TeamMember.query.filter_by(
        project_id=project_id,
        student_id=current_user.id
    ).first() or project.creator_id == current_user.id
    
    if not is_member:
        return jsonify({'error': 'Not authorized to view messages'}), 403
    
    if request.method == 'GET':
        messages = Message.query.filter_by(project_id=project_id).order_by(Message.created_at).all()
        
        return jsonify([{
            'id': m.id,
            'sender': {
                'id': m.sender.id,
                'name': f"{m.sender.first_name} {m.sender.last_name}"
            },
            'content': m.content,
            'message_type': m.message_type,
            'created_at': m.created_at.isoformat()
        } for m in messages]), 200
    
    elif request.method == 'POST':
        data = request.json
        
        message = Message(
            project_id=project_id,
            sender_id=current_user.id,
            recipient_id=data.get('recipient_id'),
            content=data['content'],
            message_type=data.get('message_type', 'group')
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify({'message': 'Message sent successfully'}), 201

@app.route('/api/projects/<int:project_id>/tasks', methods=['GET', 'POST'])
@login_required
def project_tasks(project_id):
    project = Project.query.get_or_404(project_id)
    
    # Check if user is a team member or creator
    is_member = TeamMember.query.filter_by(
        project_id=project_id,
        student_id=current_user.id
    ).first() or project.creator_id == current_user.id
    
    if not is_member:
        return jsonify({'error': 'Not authorized'}), 403
    
    if request.method == 'GET':
        tasks = Task.query.filter_by(project_id=project_id).all()
        
        return jsonify([{
            'id': t.id,
            'title': t.title,
            'description': t.description,
            'status': t.status,
            'assignee': {
                'id': t.assignee.id,
                'name': f"{t.assignee.first_name} {t.assignee.last_name}"
            } if t.assignee else None,
            'due_date': t.due_date.isoformat() if t.due_date else None,
            'created_at': t.created_at.isoformat()
        } for t in tasks]), 200
    
    elif request.method == 'POST':
        data = request.json
        
        task = Task(
            project_id=project_id,
            assignee_id=data.get('assignee_id'),
            title=data['title'],
            description=data.get('description'),
            due_date=datetime.fromisoformat(data['due_date']) if data.get('due_date') else None
        )
        
        db.session.add(task)
        db.session.commit()
        
        return jsonify({'message': 'Task created successfully', 'task_id': task.id}), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.json
    
    task.status = data.get('status', task.status)
    task.title = data.get('title', task.title)
    task.description = data.get('description', task.description)
    
    if data.get('due_date'):
        task.due_date = datetime.fromisoformat(data['due_date'])
    
    db.session.commit()
    
    return jsonify({'message': 'Task updated successfully'}), 200

@app.route('/api/projects/<int:project_id>/milestones', methods=['GET', 'POST'])
@login_required
def project_milestones(project_id):
    project = Project.query.get_or_404(project_id)
    
    if request.method == 'GET':
        milestones = Milestone.query.filter_by(project_id=project_id).order_by(Milestone.due_date).all()
        
        return jsonify([{
            'id': m.id,
            'title': m.title,
            'description': m.description,
            'due_date': m.due_date.isoformat(),
            'status': m.status,
            'created_at': m.created_at.isoformat()
        } for m in milestones]), 200
    
    elif request.method == 'POST':
        if project.creator_id != current_user.id:
            return jsonify({'error': 'Only project creator can add milestones'}), 403
        
        data = request.json
        
        milestone = Milestone(
            project_id=project_id,
            title=data['title'],
            description=data.get('description'),
            due_date=datetime.fromisoformat(data['due_date'])
        )
        
        db.session.add(milestone)
        db.session.commit()
        
        return jsonify({'message': 'Milestone created successfully'}), 201

@app.route('/api/students', methods=['GET'])
@login_required
def get_students():
    keyword = request.args.get('keyword', '')
    
    query = User.query.filter_by(role='student')
    
    if keyword:
        query = query.filter(
            (User.first_name.contains(keyword)) |
            (User.last_name.contains(keyword)) |
            (User.username.contains(keyword)) |
            (User.skills.contains(keyword)) |
            (User.interests.contains(keyword))
        )
    
    students = query.all()
    
    return jsonify([{
        'id': s.id,
        'username': s.username,
        'first_name': s.first_name,
        'last_name': s.last_name,
        'skills': s.skills,
        'interests': s.interests,
        'biography': s.biography
    } for s in students]), 200

# User Stories / Announcements
@app.route('/api/user-stories', methods=['GET', 'POST'])
@login_required
def user_stories():
    """Get all user stories or create a new one"""
    if request.method == 'GET':
        # Get all stories that the current user should see
        if current_user.role == 'faculty':
            # Faculty sees all announcements from students in their CRN
            stories = UserStory.query.join(User, UserStory.author_id == User.id).filter(
                (User.crn == current_user.crn) | (UserStory.author_id == current_user.id)
            ).order_by(UserStory.created_at.desc()).all()
        else:
            # Students see:
            # 1. Announcements from faculty in their CRN (project_id is NULL)
            # 2. Announcements from teammates in their projects (project_id is set)
            
            # Get user's project IDs
            team_memberships = TeamMember.query.filter_by(student_id=current_user.id).all()
            user_project_ids = [tm.project_id for tm in team_memberships]
            
            # Get stories from faculty in same CRN (CRN-wide announcements)
            faculty_stories = UserStory.query.join(User, UserStory.author_id == User.id).filter(
                User.role == 'faculty',
                User.crn == current_user.crn,
                UserStory.project_id.is_(None)
            ).all()
            
            # Get stories from project teammates
            project_stories = UserStory.query.filter(
                UserStory.project_id.in_(user_project_ids)
            ).all() if user_project_ids else []
            
            # Combine and remove duplicates
            stories_dict = {s.id: s for s in faculty_stories + project_stories}
            stories = sorted(stories_dict.values(), key=lambda x: x.created_at, reverse=True)
        
        return jsonify([{
            'id': story.id,
            'author_id': story.author_id,
            'author_name': f"{story.author.first_name} {story.author.last_name}",
            'author_role': story.author.role,
            'title': story.title,
            'content': story.content,
            'story_type': story.story_type,
            'priority': story.priority,
            'project_id': story.project_id,
            'created_at': story.created_at.isoformat(),
            'updated_at': story.updated_at.isoformat()
        } for story in stories]), 200
    
    # POST - Create new user story
    data = request.json
    
    if not data.get('title') or not data.get('content'):
        return jsonify({'error': 'Title and content are required'}), 400
    
    project_id = data.get('project_id')
    
    # Validate permissions
    if current_user.role == 'student':
        # Students can only create announcements for their projects
        if not project_id:
            return jsonify({'error': 'Students must specify a project for announcements'}), 403
        
        # Check if student is a member of this project
        membership = TeamMember.query.filter_by(
            student_id=current_user.id,
            project_id=project_id
        ).first()
        
        if not membership:
            return jsonify({'error': 'You are not a member of this project'}), 403
    else:
        # Faculty can create CRN-wide announcements (project_id = None)
        # or project-specific announcements
        pass
    
    story = UserStory(
        author_id=current_user.id,
        project_id=project_id,
        title=data['title'],
        content=data['content'],
        story_type=data.get('story_type', 'announcement'),
        priority=data.get('priority', 'normal')
    )
    
    db.session.add(story)
    db.session.commit()
    
    return jsonify({
        'message': 'User story created successfully',
        'story_id': story.id
    }), 201

@app.route('/api/user-stories/<int:story_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_user_story(story_id):
    """Update or delete a user story"""
    story = UserStory.query.get_or_404(story_id)
    
    # Check if user is the author or faculty
    if story.author_id != current_user.id and current_user.role != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 403
    
    if request.method == 'PUT':
        data = request.json
        
        if data.get('title'):
            story.title = data['title']
        if data.get('content'):
            story.content = data['content']
        if data.get('story_type'):
            story.story_type = data['story_type']
        if data.get('priority'):
            story.priority = data['priority']
        
        story.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'User story updated successfully'}), 200
    
    # DELETE
    db.session.delete(story)
    db.session.commit()
    
    return jsonify({'message': 'User story deleted successfully'}), 200

# CRN Management
@app.route('/api/crns', methods=['GET', 'POST'])
def manage_crns():
    """Get all CRNs or create a new one (faculty only for POST)"""
    if request.method == 'GET':
        # Anyone can view available CRNs for registration
        crns = CRN.query.all()
        return jsonify([{
            'id': crn.id,
            'crn_code': crn.crn_code,
            'course_name': crn.course_name,
            'faculty_name': f"{crn.faculty.first_name} {crn.faculty.last_name}",
            'created_at': crn.created_at.isoformat()
        } for crn in crns]), 200
    
    elif request.method == 'POST':
        # Only faculty can create CRNs
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        if current_user.role != 'faculty':
            return jsonify({'error': 'Only faculty can create CRNs'}), 403
        
        data = request.json
        
        if not data.get('crn_code') or not data.get('course_name'):
            return jsonify({'error': 'CRN code and course name are required'}), 400
        
        # Check if CRN already exists
        existing_crn = CRN.query.filter_by(crn_code=data['crn_code']).first()
        if existing_crn:
            return jsonify({'error': 'CRN already exists'}), 400
        
        crn = CRN(
            crn_code=data['crn_code'],
            course_name=data['course_name'],
            faculty_id=current_user.id
        )
        
        # Update faculty's CRN if not set
        if not current_user.crn:
            current_user.crn = data['crn_code']
        
        db.session.add(crn)
        db.session.commit()
        
        return jsonify({
            'message': 'CRN created successfully',
            'crn_id': crn.id
        }), 201

@app.route('/api/crns/<int:crn_id>', methods=['DELETE'])
@login_required
def delete_crn(crn_id):
    """Delete a CRN (faculty only)"""
    crn = CRN.query.get_or_404(crn_id)
    
    # Only the faculty who created it can delete
    if crn.faculty_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Check if any students are using this CRN
    students_with_crn = User.query.filter_by(crn=crn.crn_code).count()
    if students_with_crn > 1:  # More than just the faculty member
        return jsonify({'error': 'Cannot delete CRN with active students'}), 400
    
    db.session.delete(crn)
    db.session.commit()
    
    return jsonify({'message': 'CRN deleted successfully'}), 200

# Assignment Calendar
@app.route('/api/calendar/assignments', methods=['GET'])
@login_required
def get_assignment_calendar():
    """Get all assignments/tasks for calendar display"""
    if current_user.role != 'student':
        return jsonify({'error': 'Only students can view assignment calendar'}), 403
    
    # Get all tasks assigned to current student
    tasks = Task.query.filter_by(assignee_id=current_user.id).all()
    
    assignments = []
    for task in tasks:
        if task.due_date:
            assignments.append({
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'due_date': task.due_date.isoformat(),
                'status': task.status,
                'project_id': task.project_id,
                'project_name': task.project.name
            })
    
    return jsonify(assignments), 200

# Initialize database
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
