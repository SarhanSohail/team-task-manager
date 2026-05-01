# 🗂️ TaskFlow — Team Task Manager

A production-ready team task management web application with role-based access control, Kanban board, project management, and a real-time stats dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Backend | Node.js + Express.js |
| Database | MySQL 8.0+ |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Charts | Chart.js |
| Deployment | Railway.app ready |

---

## Features

- **Role-based access control** — Two roles: `admin` and `member`, each with distinct permissions
- **Project management** — Create projects, assign members, and track progress per project
- **Kanban board** — Drag-and-drop tasks across To Do, In Progress, and Done columns
- **Task management** — Create and edit tasks with title, description, priority, due date, and assignee
- **Overdue detection** — Tasks past their due date are automatically flagged in red
- **Dashboard** — Stats overview with doughnut and bar charts (powered by Chart.js) and a recent tasks table
- **Secure auth** — Passwords hashed with bcrypt (10 salt rounds), JWT tokens expire in 7 days
- **SQL injection safe** — All database queries use parameterized statements

---

## Project Structure

```
team-task-manager/
├── backend/
│   ├── config/
│   │   └── db.js                  # MySQL connection pool
│   ├── controllers/
│   │   ├── authController.js      # Register, login, get current user
│   │   ├── projectController.js   # Project CRUD + member management
│   │   ├── taskController.js      # Task CRUD + status update
│   │   └── userController.js      # User listing + role update
│   ├── middleware/
│   │   ├── auth.js                # JWT verification middleware
│   │   └── roleCheck.js           # Role-based route guard (requireRole)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── projects.js
│   │   ├── tasks.js
│   │   └── users.js
│   └── server.js                  # Express app entry point
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js                 # Centralized API call helper
│   │   ├── auth.js                # Token management + page protection
│   │   ├── dashboard.js           # Charts + stats logic
│   │   ├── projects.js            # Project page logic
│   │   └── tasks.js               # Kanban board + task CRUD
│   ├── index.html                 # Login / Register page
│   ├── dashboard.html
│   ├── projects.html
│   └── tasks.html
├── database/
│   └── schema.sql                 # Full MySQL schema with indexes
├── package.json
└── .gitignore
```

---

## Database Schema

Four tables with foreign key relationships:

```
users
  id, name, email, password (hashed), role (admin|member), created_at

projects
  id, name, description, owner_id → users(id), created_at

project_members   [junction table]
  id, project_id → projects(id), user_id → users(id)

tasks
  id, title, description, project_id → projects(id),
  assigned_to → users(id), created_by → users(id),
  status (todo|in_progress|done), priority (low|medium|high),
  due_date, created_at
```

Performance indexes are defined on `tasks.project_id`, `tasks.assigned_to`, `tasks.status`, and both columns of `project_members`.

---

## Local Setup

### Prerequisites

- Node.js 18+
- MySQL 8.0+

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd team-task-manager
npm install
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=team_task_manager
JWT_SECRET=your_super_secret_key_here
FRONTEND_URL=http://localhost:5000
```

### 3. Initialize Database

```bash
mysql -u root -p < database/schema.sql
```

### 4. Start the Server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

Visit: `http://localhost:5000`

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | — |
| `DB_NAME` | Database name | `team_task_manager` |
| `JWT_SECRET` | JWT signing secret (keep private!) | — |
| `FRONTEND_URL` | Allowed CORS origin | `*` |

---

## API Reference

All API responses follow a consistent format:

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "message": "Error description" }
```

### Auth — `/api/auth`

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| POST | `/register` | No | Register new user. Role can be `admin` or `member` (defaults to `member`). Password min 6 characters. |
| POST | `/login` | No | Login with email + password. Returns JWT token. |
| GET | `/me` | Yes | Returns current authenticated user's profile. |

### Users — `/api/users`

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| GET | `/` | Admin only | List all users |
| PUT | `/:id/role` | Admin only | Update a user's role |

### Projects — `/api/projects`

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| GET | `/` | Yes | List projects. Admins see all; members see only their projects. |
| POST | `/` | Admin only | Create a new project |
| GET | `/:id` | Yes | Get project details including members and tasks |
| PUT | `/:id` | Admin / Owner | Update project name or description |
| DELETE | `/:id` | Admin only | Delete a project |
| POST | `/:id/members` | Admin / Owner | Add a member to the project |
| DELETE | `/:id/members/:userId` | Admin / Owner | Remove a member from the project |

### Tasks — `/api/tasks`

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| GET | `/` | Yes | List tasks. Supports query filters: `?project=`, `?status=`, `?assignee=`, `?mine=true` |
| POST | `/` | Yes | Create a new task |
| GET | `/:id` | Yes | Get task details (includes assignee, creator, project name) |
| PUT | `/:id` | Yes | Update a task |
| DELETE | `/:id` | Yes | Delete a task |
| PATCH | `/:id/status` | Yes | Update only the task status |

> **Access control on tasks:** Non-admin users can only view tasks that belong to their projects or are assigned to them.

---

## How Authentication Works

1. On login or register, the server signs a JWT with `{ id, email, name, role }` — valid for 7 days.
2. The frontend stores the token in `localStorage` under the key `ttm_token`.
3. Every API request sends the token as `Authorization: Bearer <token>`.
4. The `auth` middleware verifies the token on every protected route. Expired tokens return a 401 with a clear message.
5. The `requireRole('admin')` middleware guards admin-only routes — non-admins get a 403.

---

## Railway Deployment

1. Create a Railway project and add a MySQL plugin.
2. Set all environment variables from the table above in the Railway dashboard.
3. Push your code — Railway auto-detects `package.json` and runs `npm start`.
4. Initialize the database schema:

```bash
mysql -h <railway-db-host> -P <port> -u <user> -p<password> <db-name> < database/schema.sql
```

---

## Security Notes

- Passwords hashed with bcryptjs (10 salt rounds) — plaintext is never stored
- JWT tokens expire in 7 days; expired tokens are rejected with a specific error message
- All database queries use parameterized statements — SQL injection safe
- Admin-only routes return `403 Forbidden` for members
- Always replace `JWT_SECRET` with a long random string in production
- Set `FRONTEND_URL` to your actual domain in production (instead of `*`)

---

## License

MIT
