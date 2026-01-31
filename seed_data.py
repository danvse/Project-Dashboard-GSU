"""
Database Seeder - Creates sample data for testing
Run this after starting the application for the first time
"""

import requests
import json

API_URL = 'http://localhost:5000/api'

def create_users():
    """Create sample students and faculty"""
    
    users = [
        # Faculty members
        {
            "username": "prof_johnson",
            "email": "tjohnson@gsu.edu",
            "password": "password123",
            "first_name": "Thomas",
            "last_name": "Johnson",
            "role": "faculty",
            "title": "Professor"
        },
        {
            "username": "dr_smith",
            "email": "asmith@gsu.edu",
            "password": "password123",
            "first_name": "Amanda",
            "last_name": "Smith",
            "role": "faculty",
            "title": "Dr."
        },
        # Students
        {
            "username": "jdoe",
            "email": "jdoe@gsu.edu",
            "password": "password123",
            "first_name": "John",
            "last_name": "Doe",
            "role": "student",
            "crn": "12345",
            "skills": "Python, JavaScript, React",
            "interests": "Web Development, AI",
            "biography": "Computer Science senior passionate about full-stack development"
        },
        {
            "username": "alee",
            "email": "alee@gsu.edu",
            "password": "password123",
            "first_name": "Alice",
            "last_name": "Lee",
            "role": "student",
            "crn": "12345",
            "skills": "Java, C++, Machine Learning",
            "interests": "Artificial Intelligence, Data Science",
            "biography": "Interested in AI and machine learning applications"
        },
        {
            "username": "bwilson",
            "email": "bwilson@gsu.edu",
            "password": "password123",
            "first_name": "Bob",
            "last_name": "Wilson",
            "role": "student",
            "crn": "12345",
            "skills": "Python, SQL, Data Analysis",
            "interests": "Database Systems, Cloud Computing",
            "biography": "Data enthusiast with experience in database management"
        },
        {
            "username": "cmartinez",
            "email": "cmartinez@gsu.edu",
            "password": "password123",
            "first_name": "Carlos",
            "last_name": "Martinez",
            "role": "student",
            "crn": "12345",
            "skills": "JavaScript, Node.js, MongoDB",
            "interests": "Backend Development, APIs",
            "biography": "Backend developer focusing on scalable systems"
        },
        {
            "username": "dchen",
            "email": "dchen@gsu.edu",
            "password": "password123",
            "first_name": "Diana",
            "last_name": "Chen",
            "role": "student",
            "crn": "12345",
            "skills": "React, Vue.js, UI/UX Design",
            "interests": "Frontend Development, User Experience",
            "biography": "Frontend developer with a passion for beautiful interfaces"
        },
        {
            "username": "etaylor",
            "email": "etaylor@gsu.edu",
            "password": "password123",
            "first_name": "Emma",
            "last_name": "Taylor",
            "role": "student",
            "crn": "12345",
            "skills": "Python, TensorFlow, PyTorch",
            "interests": "Deep Learning, Computer Vision",
            "biography": "AI researcher focusing on computer vision applications"
        }
    ]
    
    created_users = {}
    
    for user in users:
        response = requests.post(f'{API_URL}/register', json=user)
        if response.status_code == 201:
            print(f"✓ Created user: {user['username']}")
            created_users[user['username']] = user
        else:
            print(f"✗ Failed to create user: {user['username']} - {response.json().get('error')}")
    
    return created_users

def login_user(username, password):
    """Login and return session"""
    session = requests.Session()
    response = session.post(f'{API_URL}/login', json={
        'username': username,
        'password': password
    })
    
    if response.status_code == 200:
        print(f"✓ Logged in as: {username}")
        return session
    else:
        print(f"✗ Failed to login as: {username}")
        return None

def create_projects():
    """Create sample projects"""
    
    # Login as faculty
    faculty_session = login_user('prof_johnson', 'password123')
    
    if not faculty_session:
        print("Failed to login as faculty")
        return []
    
    projects = [
        {
            "name": "AI-Powered Healthcare Assistant",
            "description": "Develop an AI chatbot to help patients schedule appointments, get medication reminders, and answer basic health questions. This project will utilize natural language processing and machine learning to provide personalized healthcare assistance.",
            "capacity": 4,
            "course": "CSC4351 - Capstone I"
        },
        {
            "name": "Smart Campus Navigation System",
            "description": "Create a mobile and web application that helps students navigate the GSU campus, find empty classrooms, locate facilities, and get real-time updates on building occupancy. Includes integration with campus maps and scheduling systems.",
            "capacity": 5,
            "course": "CSC4351 - Capstone I"
        },
        {
            "name": "Sustainable Energy Monitoring Platform",
            "description": "Build a dashboard for monitoring and analyzing energy consumption in campus buildings. The system will track usage patterns, identify inefficiencies, and provide recommendations for reducing energy costs and environmental impact.",
            "capacity": 3,
            "course": "CSC4351 - Capstone I"
        },
        {
            "name": "Student Course Recommendation System",
            "description": "Design a machine learning system that recommends courses to students based on their interests, past performance, career goals, and graduation requirements. The system will help students plan their academic journey more effectively.",
            "capacity": 4,
            "course": "CSC4351 - Capstone I"
        },
        {
            "name": "Real-Time Collaboration Whiteboard",
            "description": "Develop a web-based collaborative whiteboard application that allows multiple users to draw, write, and share ideas in real-time. Perfect for remote teams and online education. Features include voice chat, screen sharing, and session recording.",
            "capacity": 4,
            "course": "CSC4351 - Capstone I"
        }
    ]
    
    created_projects = []
    
    for project in projects:
        response = faculty_session.post(f'{API_URL}/projects', json=project)
        if response.status_code == 201:
            project_id = response.json()['project_id']
            print(f"✓ Created project: {project['name']}")
            created_projects.append(project_id)
        else:
            print(f"✗ Failed to create project: {project['name']}")
    
    return created_projects

def seed_project_data(project_id):
    """Add milestones and initial messages to a project"""
    
    # Login as faculty
    faculty_session = login_user('prof_johnson', 'password123')
    
    if not faculty_session:
        return
    
    # Create milestones
    milestones = [
        {
            "title": "Project Proposal Submission",
            "description": "Submit initial project proposal with scope, objectives, and timeline",
            "due_date": "2026-02-15T23:59:00"
        },
        {
            "title": "Design Document Complete",
            "description": "Complete system design document including architecture diagrams and database schema",
            "due_date": "2026-03-01T23:59:00"
        },
        {
            "title": "Prototype Demo",
            "description": "Present working prototype demonstrating core functionality",
            "due_date": "2026-03-22T23:59:00"
        },
        {
            "title": "Final Presentation",
            "description": "Final project presentation and demonstration to stakeholders",
            "due_date": "2026-04-15T23:59:00"
        }
    ]
    
    for milestone in milestones:
        response = faculty_session.post(
            f'{API_URL}/projects/{project_id}/milestones',
            json=milestone
        )
        if response.status_code == 201:
            print(f"  ✓ Added milestone: {milestone['title']}")

def main():
    print("\n" + "="*50)
    print("Capstone PMS - Database Seeder")
    print("="*50 + "\n")
    
    print("Creating users...")
    users = create_users()
    
    print("\nCreating projects...")
    projects = create_projects()
    
    if projects:
        print("\nAdding project milestones...")
        seed_project_data(projects[0])  # Add milestones to first project
    
    print("\n" + "="*50)
    print("Seeding complete!")
    print("="*50)
    print("\nYou can now login with:")
    print("  Faculty: prof_johnson / password123")
    print("  Student: jdoe / password123")
    print("\nOr use any of the other created accounts.")
    print("="*50 + "\n")

if __name__ == '__main__':
    main()
