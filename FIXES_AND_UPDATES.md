# Project Dashboard - Fixes and Updates

## Summary of Changes

This update fixes critical issues with announcements not displaying and implements a comprehensive CRN-based announcement system as requested.

## 🔧 Issues Fixed

### 1. Announcements Not Showing on Dashboard
**Problem**: User stories (announcements) were not loading when users viewed the overview/dashboard.

**Solution**: 
- Added `loadUserStories()` call to the `showView('overview')` function
- Now announcements load automatically when users access the dashboard

### 2. User Story Creation Not Working
**Problem**: The user story creation form wasn't properly handling project-based announcements.

**Solution**:
- Updated the create user story modal to include project selection
- Modified the form submission handler to send project_id to the backend
- Added validation to ensure students select a project for their announcements

## ✨ New Features

### 1. CRN-Based Announcement System

#### For Students:
- **Project-Team Announcements**: Students can only create announcements for projects they are members of
- **Visibility Rules**: Students see:
  - Announcements from their project teammates (same project)
  - Announcements from faculty in their CRN (CRN-wide announcements)
- **Project Selection Required**: When creating an announcement, students must select which project team to notify

#### For Faculty:
- **CRN-Wide Announcements**: Faculty can create announcements visible to ALL students in their CRN
- **Project-Specific Announcements**: Faculty can also target specific projects
- **Flexible Audience**: Can leave project selection blank for CRN-wide reach, or select a project for targeted communication

### 2. CRN Management System

#### For Faculty:
- **Create CRNs**: Faculty can create Course Reference Numbers (CRNs) in their profile
- **CRN Details**: Each CRN includes:
  - CRN code (e.g., "12345")
  - Course name (e.g., "CS 4800 - Software Engineering")
  - Faculty creator
  - Creation date
- **Manage CRNs**: Faculty can view and delete their created CRNs
- **Profile Integration**: CRN management section added to faculty profile page

#### For Students:
- **CRN Selection at Registration**: Students now select from a dropdown list of available CRNs during registration (instead of entering manually)
- **Auto-Populated List**: The CRN dropdown is automatically populated with all active CRNs created by faculty

## 📝 Database Changes

### New Model: CRN
```python
class CRN(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    crn_code = db.Column(db.String(20), unique=True, nullable=False)
    course_name = db.Column(db.String(200), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### Updated Model: UserStory
```python
class UserStory(db.Model):
    # ... existing fields ...
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))  # NEW: NULL for CRN-wide announcements
```

## 🔌 New API Endpoints

### CRN Management
- **GET /api/crns** - Get all available CRNs (public, for registration)
- **POST /api/crns** - Create a new CRN (faculty only)
- **DELETE /api/crns/<id>** - Delete a CRN (creator only)

### Updated Endpoints
- **GET /api/user/profile** - Now includes `crns_created` for faculty
- **GET /api/user-stories** - Implements CRN and project-based filtering
- **POST /api/user-stories** - Now accepts `project_id` parameter

## 🎨 UI Changes

### Registration Page
- Changed CRN input from text field to dropdown select
- CRN dropdown auto-populated on page load
- Shows: "CRN Code - Course Name" format

### Faculty Profile Page
- Added "CRN Management" section
- Create new CRNs form with:
  - CRN Code input
  - Course Name input
  - Create button
- List of created CRNs with:
  - CRN code and course name display
  - Delete button for each CRN

### Announcement Modal
- Added "Audience" selector at the top
- For students: Shows their project teams
- For faculty: Shows "All Students in CRN" option + all projects
- Added helper text explaining audience rules

## 🚀 How to Use

### For Faculty:

1. **Create a CRN**:
   - Go to your Profile
   - Scroll to "CRN Management" section
   - Enter CRN code and course name
   - Click "Create CRN"

2. **Post CRN-Wide Announcement**:
   - Click "Create Announcement" button
   - Leave "Audience" dropdown as "All Students in CRN"
   - Fill in title and content
   - Click "Post Announcement"
   - All students in your CRN will see it

3. **Post Project-Specific Announcement**:
   - Click "Create Announcement" button
   - Select a specific project from "Audience" dropdown
   - Fill in title and content
   - Only students in that project will see it

### For Students:

1. **Register with CRN**:
   - During registration, select role as "Student"
   - Choose your CRN from the dropdown
   - Complete registration

2. **Post Team Announcement**:
   - Click "Create Announcement" button
   - Select which project team to notify
   - Fill in title and content
   - Only your teammates in that project will see it

3. **View Announcements**:
   - Dashboard shows announcements from:
     - Your project teammates
     - Faculty in your CRN

## 🔒 Security & Permissions

- Students can ONLY create announcements for projects they are members of
- Students can ONLY see announcements from their projects or their CRN faculty
- Faculty can create CRN-wide or project-specific announcements
- Only CRN creators can delete their CRNs
- CRNs cannot be deleted if students are enrolled

## 📊 Data Flow

### Student Announcement Flow:
```
Student creates announcement
    ↓
Selects project (required)
    ↓
Backend validates membership
    ↓
Saved with project_id
    ↓
Visible to: All team members in that project
```

### Faculty Announcement Flow:
```
Faculty creates announcement
    ↓
Selects audience (CRN-wide or specific project)
    ↓
Saved with project_id = NULL (CRN-wide) or specific ID
    ↓
Visible to: All students in CRN or specific project team
```

## 🧪 Testing Checklist

- [ ] Announcements display on dashboard when navigating to overview
- [ ] Students can only see announcements from their projects
- [ ] Students can only see CRN-wide announcements from their faculty
- [ ] Faculty can create CRN-wide announcements
- [ ] Faculty can create project-specific announcements
- [ ] Faculty can create and delete CRNs
- [ ] Students see CRN dropdown populated during registration
- [ ] Students must select a project when creating announcements
- [ ] Project selection shows only user's projects

## 📋 Migration Steps

To apply these changes to an existing database:

```bash
# Backup your database first!
cp capstone.db capstone.db.backup

# Run Python shell
python3
>>> from backend.app import app, db
>>> with app.app_context():
...     db.create_all()
```

This will add the new CRN table and update the UserStory table with the project_id column.

## 🐛 Known Limitations

1. Deleting a CRN requires no students to be enrolled (except the creating faculty)
2. Changing a student's CRN after registration is not supported in the UI
3. CRN codes must be unique across all faculty

## 📞 Support

If you encounter any issues:
1. Check browser console for JavaScript errors
2. Check Flask backend logs for API errors
3. Verify database migrations completed successfully
4. Ensure all files are properly copied to their directories
