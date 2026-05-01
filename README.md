# 🗂️ TaskFlow — Team Task Manager

A production-ready team task manager with role-based access control, Kanban board, project management, and real-time task tracking.

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js + Express.js
- **Database**: MySQL 8.0+
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Charts**: Chart.js
- **Deployment**: Railway.app ready

---

## Features

- **Role-based access**: Admin and Member roles with different permissions
- **Projects**: Create and manage projects, add/remove members
- **Kanban Board**: Drag-and-drop tasks between To Do, In Progress, and Done columns
- **Task Management**: Create, edit, delete tasks with priority, status, due dates, and assignees
- **Dashboard**: Stats overview with Charts (doughnut + bar) and recent tasks table
- **Overdue detection**: Tasks past due date automatically flagged in red

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

Edit `backend/.env` with your values:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=team_task_manager
JWT_SECRET=your_super_secret_key_here
```

### 3. Initialize Database

```bash
mysql -u root -p < database/schema.sql
```

### 4. Start the Server

```bash
# Production
npm start

# Development (with auto-reload)
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

## Railway Deployment

1. **Create Railway project** and add a MySQL plugin
2. **Set environment variables** in Railway dashboard using the values from `.env.example`
   - Use Railway's provided `DATABASE_URL` or individual DB variables from the MySQL plugin
3. **Deploy**: Push your code — Railway auto-detects `package.json` and runs `npm start`
4. **Init DB**: Run the schema SQL via Railway's MySQL connection string or a DB GUI tool

```bash
# Example: init schema remotely
mysql -h <railway-db-host> -P <port> -u <user> -p<password> <db-name> < database/schema.sql
```

---

## API Endpoints

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login, returns JWT |
| GET | `/me` | Yes | Get current user |

### Users — `/api/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin | List all users |
| PUT | `/:id/role` | Admin | Update user role |

### Projects — `/api/projects`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | List projects (filtered by role) |
| POST | `/` | Admin | Create project |
| GET | `/:id` | Yes | Get project + members + tasks |
| PUT | `/:id` | Admin/Owner | Update project |
| DELETE | `/:id` | Admin | Delete project |
| POST | `/:id/members` | Admin/Owner | Add member |
| DELETE | `/:id/members/:userId` | Admin/Owner | Remove member |

### Tasks — `/api/tasks`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | List tasks (supports `?project=&status=&assignee=&mine=true`) |
| POST | `/` | Yes | Create task |
| GET | `/:id` | Yes | Get task details |
| PUT | `/:id` | Yes | Update task |
| DELETE | `/:id` | Yes | Delete task |
| PATCH | `/:id/status` | Yes | Update status only |

### Response Format

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "message": "Error description" }
```

---

## Security Notes

- Passwords hashed with bcryptjs (10 salt rounds)
- JWT tokens expire in 7 days
- All DB queries use parameterized statements (SQL injection safe)
- Admin-only routes return 403 for non-admins
- Change `JWT_SECRET` to a long random string in production
