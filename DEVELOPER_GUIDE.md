# Developer Guide

## Quick Start

### 1. Installation
```bash
# Clone or download the project
cd capstone-pms

# Install dependencies
pip install -r requirements.txt --break-system-packages
```

### 2. Start Development Servers

**Option A: Use startup scripts**
```bash
# Linux/Mac
./start.sh

# Windows
start.bat
```

**Option B: Manual start**
```bash
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Frontend
cd frontend
python -m http.server 8000
```

### 3. Seed Test Data (Optional)
```bash
# Wait for backend to start, then:
python seed_data.py
```

## Development Workflow

### Backend Development

The backend is built with Flask and follows RESTful API principles.

**File Structure:**
```
backend/
└── app.py          # Main application file
    ├── Models      # Database models
    ├── Routes      # API endpoints
    └── Config      # Application configuration
```

**Adding a New Feature:**

1. **Define Database Model** (if needed)
```python
class NewModel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    # ... more fields
```

2. **Create API Endpoint**
```python
@app.route('/api/newfeature', methods=['GET', 'POST'])
@login_required
def new_feature():
    if request.method == 'GET':
        # Handle GET request
        pass
    elif request.method == 'POST':
        # Handle POST request
        pass
```

3. **Test Endpoint**
```bash
# Using curl
curl -X POST http://localhost:5000/api/newfeature \
  -H "Content-Type: application/json" \
  -d '{"data": "value"}'
```

### Frontend Development

The frontend uses vanilla JavaScript with a modern, component-based approach.

**File Structure:**
```
frontend/
├── index.html      # Main HTML with all UI components
├── styles.css      # Complete stylesheet
└── app.js          # Application logic and API calls
```

**Adding a New View:**

1. **Add HTML in index.html**
```html
<div id="new-view" class="dashboard-view">
    <h1>New Feature</h1>
    <!-- Your content -->
</div>
```

2. **Add Navigation Link**
```html
<a href="#" class="nav-link" data-view="new">New Feature</a>
```

3. **Add JavaScript Function**
```javascript
function loadNewView() {
    // Fetch data
    // Update UI
}
```

4. **Style in styles.css**
```css
#new-view {
    /* Your styles */
}
```

## Database Management

### Reset Database
```bash
# Delete existing database
rm backend/capstone.db

# Restart backend (will create fresh database)
python backend/app.py
```

### Inspect Database
```bash
# Install sqlite3
sqlite3 backend/capstone.db

# List tables
.tables

# Query data
SELECT * FROM user;
SELECT * FROM project;

# Exit
.exit
```

### Backup Database
```bash
# Create backup
cp backend/capstone.db backend/capstone_backup.db

# Restore from backup
cp backend/capstone_backup.db backend/capstone.db
```

## API Testing

### Using curl

**Register User:**
```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@gsu.edu",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User",
    "role": "student",
    "crn": "12345"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**Get Projects (authenticated):**
```bash
curl http://localhost:5000/api/projects \
  -b cookies.txt
```

### Using Python requests

```python
import requests

# Create session
session = requests.Session()

# Login
response = session.post('http://localhost:5000/api/login', json={
    'username': 'testuser',
    'password': 'password123'
})

# Make authenticated request
projects = session.get('http://localhost:5000/api/projects')
print(projects.json())
```

## Common Development Tasks

### Add a New Database Field

1. Update the model in `backend/app.py`:
```python
class User(UserMixin, db.Model):
    # ... existing fields
    new_field = db.Column(db.String(100))  # Add this
```

2. Reset database (deletes all data):
```bash
rm backend/capstone.db
python backend/app.py
```

3. Or use migrations (advanced):
```bash
pip install Flask-Migrate
# Follow Flask-Migrate documentation
```

### Change API Response Format

```python
@app.route('/api/example')
def example():
    return jsonify({
        'status': 'success',
        'data': your_data,
        'message': 'Optional message'
    }), 200  # HTTP status code
```

### Add Input Validation

```python
@app.route('/api/create', methods=['POST'])
def create_item():
    data = request.json
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    if len(data.get('name', '')) < 3:
        return jsonify({'error': 'Name must be at least 3 characters'}), 400
    
    # Process valid data
    # ...
```

### Handle Errors Gracefully

```python
@app.route('/api/item/<int:item_id>')
def get_item(item_id):
    try:
        item = Item.query.get_or_404(item_id)
        return jsonify(item.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

## Debugging

### Backend Debugging

**Enable Debug Mode** (already enabled in development):
```python
app.run(debug=True)
```

**Print Debugging:**
```python
@app.route('/api/debug')
def debug_route():
    print("Debug info:", data)  # Shows in terminal
    return jsonify({'status': 'ok'})
```

**Check Logs:**
- Backend logs appear in the terminal running `app.py`
- Look for error messages, stack traces

### Frontend Debugging

**Browser Console:**
```javascript
// Add console logs
console.log('Current user:', currentUser);
console.log('API response:', data);
```

**Network Tab:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Make a request
4. Inspect request/response details

**Common Issues:**

1. **CORS Errors:**
   - Check backend has `Flask-CORS` enabled
   - Verify `credentials: 'include'` in fetch calls

2. **401 Unauthorized:**
   - User not logged in
   - Session expired
   - Check `@login_required` decorator

3. **404 Not Found:**
   - Wrong API endpoint URL
   - Check route definition in backend

## Performance Optimization

### Backend

**Database Queries:**
```python
# Bad - N+1 query problem
projects = Project.query.all()
for p in projects:
    print(p.creator.name)  # Separate query for each

# Good - Use eager loading
projects = Project.query.options(
    db.joinedload(Project.creator)
).all()
```

**Pagination:**
```python
@app.route('/api/projects')
def get_projects():
    page = request.args.get('page', 1, type=int)
    per_page = 20
    
    projects = Project.query.paginate(
        page=page,
        per_page=per_page
    )
    
    return jsonify({
        'projects': [p.to_dict() for p in projects.items],
        'total': projects.total,
        'pages': projects.pages
    })
```

### Frontend

**Debounce Search:**
```javascript
let searchTimeout;
document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        search(e.target.value);
    }, 300);  // Wait 300ms after user stops typing
});
```

**Cache API Responses:**
```javascript
const cache = {};

async function fetchProjects() {
    if (cache.projects) {
        return cache.projects;
    }
    
    const response = await fetch('/api/projects');
    const data = await response.json();
    cache.projects = data;
    return data;
}
```

## Testing

### Manual Testing Checklist

**Authentication:**
- [ ] Register new student
- [ ] Register new faculty
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Logout

**Students:**
- [ ] Browse projects
- [ ] Search projects
- [ ] Join a project
- [ ] Leave a project
- [ ] Update profile
- [ ] Send message in project
- [ ] View tasks
- [ ] Find other students

**Faculty:**
- [ ] Create project
- [ ] Edit project
- [ ] Delete project
- [ ] Add milestone
- [ ] View team members
- [ ] Send message to team

**Edge Cases:**
- [ ] Try to join full project
- [ ] Try to join already joined project
- [ ] Access project not a member of
- [ ] Create project as student (should fail)

### Automated Testing (Future Enhancement)

```python
# Example using pytest
def test_register_user():
    response = client.post('/api/register', json={
        'username': 'testuser',
        'email': 'test@gsu.edu',
        'password': 'password123',
        'first_name': 'Test',
        'last_name': 'User',
        'role': 'student'
    })
    assert response.status_code == 201
```

## Deployment

### Production Checklist

- [ ] Change `SECRET_KEY` to secure random value
- [ ] Disable Flask debug mode
- [ ] Use production database (PostgreSQL/MySQL)
- [ ] Set up HTTPS
- [ ] Configure proper CORS origins
- [ ] Add rate limiting
- [ ] Set up logging
- [ ] Configure environment variables
- [ ] Add database backups
- [ ] Set up monitoring

### Environment Variables

Create `.env` file:
```
FLASK_ENV=production
SECRET_KEY=your-very-secure-secret-key
DATABASE_URL=postgresql://user:pass@localhost/dbname
```

Load in app:
```python
from dotenv import load_dotenv
load_dotenv()

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
```

## Code Style Guidelines

### Python (Backend)
- Follow PEP 8
- Use meaningful variable names
- Add docstrings to functions
- Keep functions focused and small

### JavaScript (Frontend)
- Use camelCase for variables
- Use async/await for asynchronous operations
- Add comments for complex logic
- Keep functions pure when possible

### CSS
- Use consistent naming convention
- Group related styles
- Use CSS variables for colors/sizes
- Comment major sections

## Git Workflow (If Using Version Control)

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature

# Create pull request for review
```

## Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [REST API Best Practices](https://restfulapi.net/)

## Support

For questions or issues:
1. Check this guide
2. Review code comments
3. Check browser console for errors
4. Review API responses in Network tab
5. Contact team members

---

Happy coding! 🚀
