# Capstone Project Management System

**Team:** CopiumCoders  
**Course:** CSC4351 Capstone 1  
**Fall 2025**

## Overview

The Capstone Project Management System is a web-based application designed to streamline the capstone project workflow at Georgia State University. It provides a centralized platform for:

- **Students**: Browse projects, form teams, collaborate with teammates, and manage tasks
- **Faculty**: Create and manage projects, oversee team formation, and track progress

## Features

### Core Functionality
-  User authentication (Student/Faculty roles)
-  Project browsing and search
-  Team formation (First Come First Serve)
-  Project workspace with messaging
-  Task management and assignment
-  Milestone tracking
-  Student profile creation with skills/interests
-  Real-time collaboration tools

### User Roles

**Students:**
- Create profile with biography, skills, and interests
- Browse and search available projects
- Join projects (capacity-based)
- Communicate with team members
- Track tasks and milestones
- Find teammates with similar interests

**Faculty:**
- Create and manage projects
- Set project capacity and details
- Monitor team formation
- Add milestones for project tracking
- Communicate with student teams

## Technology Stack

### Backend
- **Framework**: Flask (Python)
- **Database**: SQLite (with SQLAlchemy ORM)
- **Authentication**: Flask-Login
- **API**: RESTful endpoints

### Frontend
- **HTML5/CSS3**: Modern, responsive design
- **JavaScript**: Vanilla JS for dynamic interactions
- **Design**: Mobile-first, professional UI

## Project Structure

```
capstone-pms/
├── backend/
│   └── app.py              # Flask application and API endpoints
├── frontend/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # Stylesheet
│   └── app.js              # JavaScript application logic
├── requirements.txt        # Python dependencies
└── README.md              # This file
```

## Installation & Setup

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)
- Web browser (Chrome, Firefox, Safari, or Edge)

### Step 1: Install Dependencies

```bash
cd capstone-pms
pip install -r requirements.txt
```

Or install with the break-system-packages flag if needed:

```bash
pip install -r requirements.txt --break-system-packages
```

### Step 2: Start the Backend Server

```bash
cd backend
python app.py
```

The server will start on `http://localhost:5000`

### Step 3: Open the Frontend

Open `frontend/index.html` in your web browser, or use a simple HTTP server:

```bash
cd frontend
python -m http.server 8000
```

Then navigate to `http://localhost:8000`

## Usage Guide

### First Time Setup

1. **Register an Account**
   - Choose your role (Student or Faculty)
   - Fill in your information
   - For students: Add your CRN
   - For faculty: Add your title

2. **Login**
   - Use your username and password
   - You'll be redirected to the dashboard

### For Students

**Complete Your Profile:**
1. Click "Profile" in the navigation
2. Add your biography, skills, and interests
3. This helps teammates find you

**Browse Projects:**
1. Click "Projects" to see all available projects
2. Use the search bar to filter by keywords
3. Click on a project to view details

**Join a Project:**
1. Open a project you're interested in
2. Click "Join Project"
3. You'll be added to the team (if space available)

**Collaborate:**
1. Open your project from the dashboard
2. Use the tabs to:
   - View team members
   - Send messages
   - Track tasks
   - Monitor milestones

**Find Teammates:**
1. Click "Find Students"
2. Search by skills, interests, or name
3. View student profiles and skills

### For Faculty

**Create a Project:**
1. Click "+ Create Project" button
2. Fill in project details:
   - Project name
   - Description
   - Course
   - Team capacity
3. Submit to publish

**Manage Projects:**
1. View all projects from the Projects tab
2. Click on your projects to manage them
3. Add milestones for important deadlines
4. Monitor team formation and progress

**Add Milestones:**
1. Open a project you created
2. Go to the Milestones tab
3. Click "+ Add Milestone"
4. Set title, description, and due date

**Communicate:**
1. Open any project
2. Go to the Messages tab
3. Send messages to the entire team
4. Monitor student collaboration

## API Documentation

### Authentication Endpoints

**Register:**
```
POST /api/register
Body: {
  username, email, password, first_name, last_name,
  role, crn (optional), title (optional)
}
```

**Login:**
```
POST /api/login
Body: { username, password }
```

**Logout:**
```
POST /api/logout
```

### Project Endpoints

**Get All Projects:**
```
GET /api/projects?keyword={search_term}
```

**Get Project Details:**
```
GET /api/projects/{project_id}
```

**Create Project (Faculty only):**
```
POST /api/projects
Body: { name, description, capacity, course }
```

**Join Project:**
```
POST /api/projects/{project_id}/join
```

**Leave Project:**
```
POST /api/projects/{project_id}/leave
```

### Messaging Endpoints

**Get Messages:**
```
GET /api/projects/{project_id}/messages
```

**Send Message:**
```
POST /api/projects/{project_id}/messages
Body: { content, message_type }
```

### Task Endpoints

**Get Tasks:**
```
GET /api/projects/{project_id}/tasks
```

**Create Task:**
```
POST /api/projects/{project_id}/tasks
Body: { title, description, assignee_id, due_date }
```

**Update Task:**
```
PUT /api/tasks/{task_id}
Body: { status, title, description, due_date }
```

### Student Endpoints

**Get Students:**
```
GET /api/students?keyword={search_term}
```

### Profile Endpoints

**Get Profile:**
```
GET /api/user/profile
```

**Update Profile:**
```
PUT /api/user/profile
Body: { biography, skills, interests }
```

## Database Schema

### Users Table
- id (Primary Key)
- username (Unique)
- email (Unique)
- password_hash
- first_name, last_name
- role (student/faculty)
- crn, title
- biography, skills, interests
- created_at

### Projects Table
- id (Primary Key)
- name
- description
- capacity
- course
- creator_id (Foreign Key → Users)
- status (open/full)
- created_at

### TeamMembers Table
- id (Primary Key)
- project_id (Foreign Key → Projects)
- student_id (Foreign Key → Users)
- joined_at
- status

### Messages Table
- id (Primary Key)
- project_id (Foreign Key → Projects)
- sender_id (Foreign Key → Users)
- recipient_id (Foreign Key → Users, nullable)
- content
- message_type (group/direct)
- created_at

### Tasks Table
- id (Primary Key)
- project_id (Foreign Key → Projects)
- assignee_id (Foreign Key → Users)
- title, description
- status (pending/in_progress/completed)
- due_date
- created_at

### Milestones Table
- id (Primary Key)
- project_id (Foreign Key → Projects)
- title, description
- due_date
- status (upcoming/completed)
- created_at

## Design Constraints

### Performance
- Supports 200+ concurrent users
- Handles 100+ projects efficiently
- Fast response times (<2 seconds for most operations)

### Mobile Support
- Responsive design for all screen sizes
- Optimized for mobile browsers
- Lightweight assets (<5 seconds load time)

### File Size Limits
- Document uploads: 10-50 MB maximum
- Optimized for efficient data usage

### Team Assignment
- First Come First Serve (FCFS) algorithm
- Capacity-based limitations
- Real-time availability updates

## Security Features

- Password hashing with Werkzeug
- Session-based authentication
- Role-based access control
- Input validation
- CORS protection
- SQL injection prevention (SQLAlchemy ORM)

## Non-Functional Requirements

✅ **Secure**: Role-based authentication and data protection  
✅ **Reliable**: Error handling and validation  
✅ **Scalable**: Handles growing user base and projects  
✅ **Portable**: Works across browsers and devices  
✅ **Maintainable**: Clean code structure and documentation

## Future Enhancements

- Email notifications for team updates
- File upload/sharing functionality
- Calendar integration
- Advanced team matching algorithms
- Project templates
- Analytics dashboard for faculty
- Mobile app (Flutter)
- Real-time messaging with WebSockets

## Troubleshooting

### Backend Won't Start
- Check Python version: `python --version`
- Verify all dependencies are installed
- Check port 5000 is not in use

### Can't Login
- Verify backend server is running
- Check browser console for errors
- Clear browser cache and cookies
- Ensure CORS is properly configured

### Database Errors
- Delete `capstone.db` and restart server (creates fresh database)
- Check SQLAlchemy version compatibility

### API Connection Issues
- Verify API_URL in `app.js` matches your backend
- Check browser network tab for failed requests
- Ensure credentials: 'include' is set for all API calls

## Contributing

This is a capstone project for CSC4351. For questions or issues:
1. Check existing documentation
2. Review code comments
3. Contact team members
4. Refer to the Software Design Document

## License

This project is created for educational purposes as part of the CSC4351 Capstone course at Georgia State University.

## Acknowledgments

- Georgia State University Computer Science Department
- Course instructors and stakeholders
- Team CopiumCoders

---

**Last Updated:** December 3, 2025  
**Version:** 1.0.0
