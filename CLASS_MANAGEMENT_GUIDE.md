# Class Management System Guide

## Overview

The class management system allows faculty to create and manage classes, while students can join these classes during registration. All visibility is scoped to class membership - students only see professors and other students in their class.

## Features

### For Faculty

#### Creating a Class

Faculty can create classes in two ways:

1. **From the Dashboard (Quick Actions)**
   - Click the "Create Class" button in the Quick Actions section
   - Enter a unique Class Code (CRN) - e.g., "12345"
   - Enter the Course Name - e.g., "CS 4800 - Software Engineering"
   - Click "Create Class"

2. **From the Profile Page**
   - Navigate to Profile
   - Scroll to "Class Management" section
   - Fill in the Class Code and Course Name
   - Click "Create Class"

#### Managing Classes

- View all your created classes in the Profile page under "Class Management"
- Each class shows:
  - Class Code (CRN)
  - Course Name
  - Number of enrolled students
  - Number of active projects
- Delete classes (only if no students are enrolled)

#### Class Visibility

Faculty members can see:
- All students enrolled in their class
- All faculty members in the same class
- All projects created by faculty in their class
- Announcements from students and faculty in their class

### For Students

#### Joining a Class

During registration:
1. Select "Student" as your role
2. Choose your class from the "Select Your Class" dropdown
3. The dropdown shows all available classes with format: "CRN Code - Course Name"
4. Complete the rest of the registration

#### Class Visibility

Students can only see:
- Other students in their class
- Faculty members in their class
- Projects created by faculty in their class
- Announcements from their project teammates
- Announcements from faculty in their class

## Class Information Display

Both students and faculty can view class information on the dashboard:
- Class Code
- Course Name
- Instructor name
- Number of enrolled students
- Number of faculty members
- Number of active projects

## Announcements & Communication

### Faculty Announcements
- Faculty can create class-wide announcements (visible to all students in the class)
- Faculty can create project-specific announcements (visible only to that project team)

### Student Announcements
- Students can only create announcements for projects they are members of
- These announcements are visible to all team members in that project

## API Endpoints

### Class Management
- `GET /api/crns` - Get all available classes (public, for registration)
- `POST /api/crns` - Create a new class (faculty only)
- `DELETE /api/crns/<id>` - Delete a class (creator only, no enrolled students)
- `GET /api/my-classes` - Get all classes for current faculty with stats

### Class Information
- `GET /api/class-info` - Get information about current user's class

### Visibility Filtering
- `GET /api/students` - Get students in the same class
- `GET /api/faculty` - Get faculty in the same class
- `GET /api/projects` - Get projects from faculty in the same class

## Database Schema

### CRN Model
```python
class CRN(db.Model):
    id = Integer (Primary Key)
    crn_code = String(20) (Unique, Required)
    course_name = String(200) (Required)
    faculty_id = Integer (Foreign Key to User)
    created_at = DateTime
```

### User Model (relevant fields)
```python
class User(db.Model):
    # ... other fields ...
    crn = String(20)  # Links user to their class
    role = String(20)  # 'student' or 'faculty'
```

## Security & Permissions

- Only faculty can create classes
- Only the faculty who created a class can delete it
- Classes cannot be deleted if students are enrolled
- Students can only see data from their own class
- Faculty can only see data from their class
- All API endpoints enforce class-based visibility

## Best Practices

### For Faculty
1. Create your class before students register
2. Use meaningful class codes (CRNs) that students can easily identify
3. Include the course number and name in the Course Name field
4. Create class-wide announcements for important updates
5. Use project-specific announcements for targeted communication

### For Students
1. Select the correct class during registration
2. Verify your class information on the dashboard after registration
3. Use project announcements to communicate with your team
4. Check the dashboard regularly for faculty announcements

## Troubleshooting

### "Class code already exists"
- Each class code must be unique across all faculty
- Try a different code or check if the class already exists

### "Cannot delete class with enrolled students"
- You cannot delete a class if students are enrolled
- Students must be removed or reassigned first

### "No class information available"
- Ensure you have selected a class during registration
- Contact your instructor if you need to be added to a class

### Students not seeing expected content
- Verify the student is enrolled in the correct class
- Check that the content creator is in the same class
- Ensure projects are created by faculty in the same class

## Migration from Old System

If you're upgrading from the previous CRN system:
1. Existing CRNs are now called "Classes"
2. All functionality remains the same
3. The UI now uses "Class" terminology for clarity
4. Faculty are automatically assigned to classes they create
5. Visibility rules are now strictly enforced by class membership
