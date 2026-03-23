# Quick Start Guide - Updated Project Dashboard

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Flask and dependencies (see requirements.txt)

### Installation

1. **Install Dependencies**
```bash
pip install -r requirements.txt
```

2. **Initialize Database**
```bash
# The database will be created automatically on first run
# Or you can manually create it:
python3
>>> from backend.app import app, db
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

3. **Start the Application**

**On Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**On Windows:**
```bash
start.bat
```

4. **Access the Application**
- Frontend: http://localhost:8000
- Backend API: http://localhost:5001

## 👨‍🏫 Faculty Quick Start

### Step 1: Register as Faculty
1. Click "Register" on login page
2. Select "Faculty" as role
3. Enter your details and a title (e.g., "Professor")
4. Complete registration

### Step 2: Create Your First CRN
1. Login with your credentials
2. Navigate to "Profile" (sidebar)
3. Scroll to "CRN Management" section
4. Enter:
   - CRN Code: e.g., "12345"
   - Course Name: e.g., "CS 4800 - Software Engineering"
5. Click "Create CRN"

### Step 3: Post a CRN-Wide Announcement
1. Go to Dashboard (Overview)
2. Click "Create Announcement" button
3. Leave "Audience" as "All Students in CRN"
4. Fill in:
   - Title: e.g., "Welcome to CS 4800!"
   - Content: Your announcement message
   - Type: Announcement, Update, or Milestone
   - Priority: Normal, High, or Low
5. Click "Post Announcement"

**Note**: All students in your CRN will see this announcement!

## 👨‍🎓 Student Quick Start

### Step 1: Register as Student
1. Click "Register" on login page
2. Select "Student" as role
3. Enter your details
4. **Select your CRN** from the dropdown (this is required!)
5. Complete registration

### Step 2: Join a Project
1. Login with your credentials
2. Navigate to "Projects" (sidebar)
3. Browse available projects
4. Click on a project card to view details
5. Click "Join Project" button

### Step 3: Post a Team Announcement
1. Go to Dashboard (Overview)
2. Click "Create Announcement" button
3. **Select your project** from "Audience" dropdown (required!)
4. Fill in:
   - Title: e.g., "Team Meeting This Friday"
   - Content: Your announcement message
   - Type and Priority
5. Click "Post Announcement"

**Note**: Only your teammates in that project will see this announcement!

## 📋 Common Tasks

### Creating a Project (Faculty or Students)
1. Navigate to "Projects"
2. Click "Create New Project"
3. Fill in:
   - Project name
   - Description
   - Course
   - Team capacity
4. Submit

### Viewing Announcements
- Announcements appear automatically on your Dashboard (Overview page)
- Students see:
  - Announcements from their project teams
  - CRN-wide announcements from faculty
- Faculty see:
  - All announcements from students in their CRN
  - Their own announcements

### Managing Your Profile
1. Navigate to "Profile"
2. Update:
   - Biography
   - Skills
   - Interests
3. Click "Update Profile"

### Finding Students (Faculty Feature)
1. Navigate to "Students"
2. Use search bar to find students by:
   - Name
   - Username
   - Skills
   - Interests

## 🔍 Troubleshooting

### Announcements Not Showing
- Refresh the page
- Make sure you've selected the "Overview" view
- Check that you're logged in correctly

### Can't Create Announcement
**For Students:**
- Ensure you've joined at least one project
- Make sure you select a project in the "Audience" dropdown

**For Faculty:**
- Ensure you've created a CRN first
- Check that you're logged in as faculty

### CRN Not Appearing in Dropdown
- Make sure a faculty member has created the CRN
- Try refreshing the registration page
- Contact system admin if CRN is missing

### Can't Join Project
- Project may be full
- Refresh the page and try again
- Check if you're already a member

## 📊 Feature Overview

### Announcements System
| User Type | Can Create For | Visibility |
|-----------|---------------|------------|
| Student   | Their projects only | Project teammates |
| Faculty   | CRN-wide OR specific projects | All CRN students OR specific project |

### CRN System
- Faculty creates CRNs with unique codes
- Students select CRN during registration
- CRNs group students by course/section
- Used for announcement distribution

## 💡 Tips & Best Practices

### For Faculty:
- Create your CRN immediately after registration
- Use CRN-wide announcements for general course info
- Use project-specific announcements for targeted feedback
- Set priority to "High" for urgent announcements

### For Students:
- Select the correct CRN during registration
- Join projects that match your skills/interests
- Check dashboard regularly for announcements
- Use project announcements for team coordination

## 🔐 Security Notes

- Always use strong passwords
- Don't share your credentials
- Students can only access their own projects' data
- Faculty can only delete their own CRNs

## 📱 Browser Compatibility

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🆘 Getting Help

If you encounter issues:
1. Check the browser console (F12) for errors
2. Check the terminal/command prompt running the Flask server
3. Review the FIXES_AND_UPDATES.md document
4. Contact your system administrator

## 🎯 Next Steps

After getting started:
1. ✅ Complete your profile
2. ✅ Create or join projects
3. ✅ Post announcements to communicate
4. ✅ Collaborate with your team
5. ✅ Track project progress

Happy collaborating! 🎉
