#!/usr/bin/env python3
"""
Seed the database with real capstone projects and test users
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app import app, db, User
from werkzeug.security import generate_password_hash

# Project data
projects_data = [
    {
        "name": "An Online Repository for Capstone Project Selection and Organization",
        "description": "Application that keeps numerous Capstone projects and provides a workspace for team formation and collaboration based on project topic. Hosting project ideas for students to pick from and a dashboard for course students to find teammates based on common interests.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "A System to Judge Poster Submissions for GSU Demo Day",
        "description": "A software application with a mobile app for judges to input scores and a central dashboard that aggregates scores for all submissions and ranks them based on aggregate score.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Supply Chain Tariff Monitoring and Alert System",
        "description": "App that monitors the supply chain for tariffs and provides alerts for potential price increases. Includes a mobile app/web dashboard displaying supply chain health and local inventory listings by price and distance.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "GitHub Contribution Analyzer",
        "description": "A web application providing detailed insights into individual contributions on GitHub repositories. Includes visualization of contributions over time, comprehensive reports, and analysis of pull requests, commits, and code reviews.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "GSU Commute Helper",
        "description": "A web app that analyzes common commute methods for GSU students and displays updates on MARTA delays, traffic delays, and student parking status with regular information refresh.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Mobile App Check-In System for University Tutoring Services",
        "description": "A mobile app check-in system using dynamic QR codes for tutoring sessions. Features session QR code generation, student check-in via scanning, real-time attendance tracking, push notifications, and offline functionality.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Next Generation Elevator Control System",
        "description": "A new type of elevator control allowing users to use mobile phones to select floors. Includes a mobile app, user authentication system, backend controller for optimization, and elevator simulation display.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Map-based Wildfire Spread Simulation",
        "description": "A web application that allows users to run wildfire spread simulations using the DEVS-FIRE API. Includes a GUI with US map, ignition point configuration, wind condition settings, and simulation result visualization.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Text Corpus Management System",
        "description": "A software system facilitating creation, management, and updating of text corpora with version control. Features multi-user support, role management, text extraction, keyword extraction algorithms, and metadata extraction.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "AI CS Program Information Chatbot",
        "description": "An AI chatbot for the CS department answering FAQs and student inquiries. Can be developed for both graduate and undergraduate programs by training on student handbooks.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Tiny Tasks - Schedule Management for ADHD",
        "description": "A simple mobile app for ADHD-friendly task management allowing students to view daily or half-day task lists. Integrates with Google Calendar for seamless scheduling.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Food Oasis",
        "description": "A mobile app using GPS mapping to find fresh food purveyors for pickup. Features simple GPS interface, user registration for reservations, supplier registration system, and product listings.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "PP-Translate",
        "description": "A web application that translates PowerPoint (pptx) files into other languages using AI. Includes simple file upload interface and preserves original PowerPoint style, fonts, and formatting.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Prepare-up - AI Exam Preparation Generator",
        "description": "A web application that analyzes student questions and test rubrics, then generates podcasts or recitation narratives for exam preparation using AI.",
        "course": "CSC4351 Capstone 1"
    },
    {
        "name": "Face-IT - Facial Recognition Attendance System",
        "description": "A university attendance app using AI-driven facial recognition to identify students and automatically log attendance. Features enrollment with facial images, real-time facial detection, geofencing, and mask detection.",
        "course": "CSC4351 Capstone 1"
    }
]

def seed_database():
    with app.app_context():
        # Clear existing data
        db.drop_all()
        db.create_all()
        
        print("Creating test users...")
        
        # Create faculty users
        faculty_users = [
            User(
                username='faculty1',
                email='faculty1@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='Dr.',
                last_name='Smith',
                role='faculty',
                title='Professor'
            ),
            User(
                username='faculty2',
                email='faculty2@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='Dr.',
                last_name='Johnson',
                role='faculty',
                title='Associate Professor'
            )
        ]
        
        for user in faculty_users:
            db.session.add(user)
        
        db.session.commit()
        
        # Create student users
        student_users = [
            User(
                username='student1',
                email='student1@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='John',
                last_name='Doe',
                role='student',
                crn='12345',
                skills='Python, JavaScript, React',
                interests='Web Development, AI'
            ),
            User(
                username='student2',
                email='student2@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='Jane',
                last_name='Smith',
                role='student',
                crn='12346',
                skills='Java, C++, Machine Learning',
                interests='Data Science, Backend'
            ),
            User(
                username='student3',
                email='student3@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='Mike',
                last_name='Johnson',
                role='student',
                crn='12347',
                skills='Flutter, Dart, Mobile Dev',
                interests='Mobile Development'
            ),
            User(
                username='student4',
                email='student4@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='Sarah',
                last_name='Williams',
                role='student',
                crn='12348',
                skills='React, Node.js, MongoDB',
                interests='Full Stack Development'
            ),
            User(
                username='student5',
                email='student5@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='Alex',
                last_name='Brown',
                role='student',
                crn='12349',
                skills='Python, TensorFlow, Data Analysis',
                interests='AI, Machine Learning'
            ),
            User(
                username='student6',
                email='student6@gsu.edu',
                password_hash=generate_password_hash('password123'),
                first_name='Emma',
                last_name='Davis',
                role='student',
                crn='12350',
                skills='UI/UX Design, Figma, CSS',
                interests='Frontend, UX Design'
            )
        ]
        
        for user in student_users:
            db.session.add(user)
        
        db.session.commit()
        
        print(f"Created {len(faculty_users)} faculty and {len(student_users)} student users")
        
        # Create projects
        print("Creating capstone projects...")
        faculty1 = faculty_users[0]
        
        for i, project_data in enumerate(projects_data):
            from app import Project
            project = Project(
                name=project_data['name'],
                description=project_data['description'],
                course=project_data['course'],
                capacity=4,
                creator_id=faculty1.id,
                status='open'
            )
            db.session.add(project)
        
        db.session.commit()
        
        print(f"Created {len(projects_data)} capstone projects")
        print("\n✅ Database seeding completed!")
        print("\nTest accounts created:")
        print("Faculty:")
        print("  Username: faculty1, Password: password123")
        print("  Username: faculty2, Password: password123")
        print("\nStudents:")
        print("  Username: student1-6, Password: password123")

if __name__ == '__main__':
    seed_database()
