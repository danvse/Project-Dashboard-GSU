# Testing the Class Management System

## Quick Start Testing Guide

### Prerequisites
1. Start the backend server: `python backend/app.py`
2. Open the frontend: `frontend/index.html` in your browser
3. Optionally run seed data: `python seed_data.py`

## Test Scenario 1: Faculty Creates a Class

### Steps:
1. **Register as Faculty**
   - Click "Don't have an account? Register"
   - Select Role: "Faculty"
   - Fill in: First Name, Last Name, Username, Email, Password
   - Enter Title: "Professor" or "Dr."
   - Click "Register"

2. **Login**
   - Use the credentials you just created
   - You should see the dashboard

3. **Create a Class from Dashboard**
   - Look for "Quick Actions" section
   - Click "Create Class" button
   - Enter Class Code: "CS4800"
   - Enter Course Name: "Software Engineering Capstone"
   - Click "Create Class"
   - You should see a success message

4. **Verify Class Creation**
   - Navigate to "Profile" tab
   - Scroll to "Class Management" section
   - You should see your newly created class with:
     - Class code: CS4800
     - Course name: Software Engineering Capstone
     - 0 students
     - 0 projects

5. **Check Dashboard Class Info**
   - Navigate back to "Dashboard" tab
   - You should see a purple gradient card showing:
     - Your class code
     - Course name
     - Your name as instructor
     - Student count: 1 (you)
     - Faculty count: 1 (you)
     - Project count: 0

## Test Scenario 2: Student Joins a Class

### Steps:
1. **Logout** (if logged in)
   - Click "Logout" button

2. **Register as Student**
   - Click "Don't have an account? Register"
   - Select Role: "Student"
   - Fill in: First Name, Last Name, Username, Email, Password
   - **Important**: In "Select Your Class" dropdown, choose "CS4800 - Software Engineering Capstone"
   - Click "Register"

3. **Login as Student**
   - Use the student credentials
   - You should see the dashboard

4. **Verify Class Membership**
   - Check the "My Class" card on dashboard
   - Should show:
     - Class code: CS4800
     - Course name: Software Engineering Capstone
     - Instructor name (the faculty you created)
     - Student count: 1
     - Faculty count: 1

5. **Check Faculty Directory**
   - Click "Faculty" tab in navigation
   - You should see the faculty member who created the class
   - Should display: Name, Title, Email

## Test Scenario 3: Class-Based Visibility

### Steps:
1. **Create Another Class** (as different faculty)
   - Logout and register as a new faculty member
   - Create a different class (e.g., "CS3500 - Database Systems")

2. **Register Students in Different Classes**
   - Create Student A in CS4800
   - Create Student B in CS3500

3. **Test Visibility**
   - Login as Student A
   - Go to "Students" tab
   - Should ONLY see students from CS4800
   - Should NOT see Student B (who is in CS3500)

4. **Test Project Visibility**
   - Login as faculty from CS4800
   - Create a project
   - Login as Student A (CS4800) - should see the project
   - Login as Student B (CS3500) - should NOT see the project

## Test Scenario 4: Faculty Class Management

### Steps:
1. **Login as Faculty**
   - Use faculty credentials who created a class

2. **View All Classes**
   - Go to "Profile" tab
   - Scroll to "Class Management"
   - Should see all classes you created with statistics

3. **Try to Delete Class with Students**
   - If students are enrolled, click "Delete Class"
   - Should see error: "Cannot delete class with enrolled students"

4. **Create and Delete Empty Class**
   - Create a new class (e.g., "TEST123")
   - Immediately try to delete it (no students enrolled)
   - Should successfully delete

## Test Scenario 5: Announcements with Class Scope

### Steps:
1. **Faculty Creates Class-Wide Announcement**
   - Login as faculty
   - Click "New Announcement" on dashboard
   - Leave "Audience" as "All Students in CRN"
   - Enter title and content
   - Click "Post Announcement"

2. **Verify Students See It**
   - Login as any student in that class
   - Check dashboard announcements
   - Should see the faculty announcement

3. **Verify Other Class Students Don't See It**
   - Login as student in different class
   - Should NOT see the announcement

## Test Scenario 6: Using Seed Data

### Steps:
1. **Run Seed Script**
   ```bash
   python seed_data.py
   ```

2. **Login with Seeded Accounts**
   - Faculty: `prof_johnson` / `password123`
   - Student: `jdoe` / `password123`

3. **Verify Seeded Data**
   - Class "12345 - CSC4351 - Capstone I" should exist
   - Multiple students should be in the class
   - Several projects should be visible
   - Milestones should be present

## Expected Results Summary

### ✅ What Should Work:
- Faculty can create classes from dashboard
- Faculty can create classes from profile
- Students see class dropdown during registration
- Class information displays correctly on dashboard
- Students only see content from their class
- Faculty only see content from their class
- Faculty can view statistics for their classes
- Faculty can delete empty classes
- Faculty cannot delete classes with students
- Class codes must be unique
- Faculty directory shows only class members
- Projects are filtered by class
- Announcements are filtered by class

### ❌ What Should NOT Work:
- Students creating classes
- Deleting classes with enrolled students
- Duplicate class codes
- Students seeing content from other classes
- Faculty seeing content from other classes
- Accessing class data without authentication

## Troubleshooting

### Issue: "Class code already exists"
**Solution**: Use a different, unique class code

### Issue: Can't see class dropdown during registration
**Solution**: Ensure at least one faculty has created a class first

### Issue: Class information not showing on dashboard
**Solution**: 
- Verify you selected a class during registration
- Check browser console for errors
- Ensure backend is running

### Issue: Students from other classes are visible
**Solution**: 
- Verify both users are in different classes
- Check the CRN field in the database
- Clear browser cache and reload

### Issue: Cannot delete class
**Solution**: 
- Check if students are enrolled
- Verify you are the class creator
- Check backend logs for specific error

## Database Verification

To verify the database state:

```python
# In Python shell
from backend.app import app, db, User, CRN, Project

with app.app_context():
    # Check all classes
    classes = CRN.query.all()
    for c in classes:
        print(f"Class: {c.crn_code} - {c.course_name}")
        print(f"  Students: {User.query.filter_by(role='student', crn=c.crn_code).count()}")
        print(f"  Faculty: {User.query.filter_by(role='faculty', crn=c.crn_code).count()}")
    
    # Check user class assignments
    users = User.query.all()
    for u in users:
        print(f"{u.username} ({u.role}): Class {u.crn}")
```

## Success Criteria

The implementation is successful if:
1. ✅ Faculty can create classes from dashboard
2. ✅ Students can select classes during registration
3. ✅ Class information displays on dashboard
4. ✅ Visibility is properly scoped to class membership
5. ✅ Faculty can manage their classes
6. ✅ All security rules are enforced
7. ✅ No errors in browser console
8. ✅ No errors in backend logs

## Next Steps After Testing

1. Test with multiple concurrent users
2. Test edge cases (special characters in class names, etc.)
3. Test with large numbers of students/classes
4. Verify mobile responsiveness
5. Test all announcement scenarios
6. Verify project creation and visibility
7. Test task and milestone functionality within class scope
