// Dashboard page logic
if (!protectPage()) throw new Error('Not authenticated');

const user = getCurrentUser();

// ===== INIT USER UI =====
function initUserUI() {
  const adminEls = document.querySelectorAll('.admin-only');
  if (isAdmin()) adminEls.forEach(el => el.classList.remove('hidden'));

  document.getElementById('sidebar-avatar').textContent = getInitials(user.name);
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-role').textContent = user.role;

  const badge = document.getElementById('topbar-role-badge');
  badge.textContent = user.role;
  badge.className = `badge badge-${user.role}`;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('topbar-greeting').textContent = `${greeting}, ${user.name.split(' ')[0]}!`;
}

// ===== LOAD DASHBOARD DATA =====
async function loadDashboard() {
  try {
    const [tasksRes, projectsRes] = await Promise.all([getTasks(), getProjects()]);
    const tasks = tasksRes.data;
    const projects = projectsRes.data;

    // Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCount = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today).length;

    document.getElementById('stat-total').textContent = tasks.length;
    document.getElementById('stat-progress').textContent = tasks.filter(t => t.status === 'in_progress').length;
    document.getElementById('stat-done').textContent = tasks.filter(t => t.status === 'done').length;
    document.getElementById('stat-overdue').textContent = overdueCount;

    // Charts
    renderStatusChart(tasks);
    renderProjectChart(tasks, projects);

    // Recent tasks table
    renderRecentTasks(tasks.slice(0, 10), today);
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderStatusChart(tasks) {
  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: ['To Do', 'In Progress', 'Done'],
      datasets: [{
        data: [counts.todo, counts.in_progress, counts.done],
        backgroundColor: ['#94a3b8', '#3b82f6', '#22c55e'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 20, font: { family: 'DM Sans', size: 12 }, usePointStyle: true },
        },
      },
    },
  });
}

function renderProjectChart(tasks, projects) {
  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p.name; });

  const counts = {};
  tasks.forEach(t => {
    const name = t.project_name || projectMap[t.project_id] || `Project ${t.project_id}`;
    counts[name] = (counts[name] || 0) + 1;
  });

  const labels = Object.keys(counts).slice(0, 8);
  const data = labels.map(l => counts[l]);

  new Chart(document.getElementById('projectChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tasks',
        data,
        backgroundColor: 'rgba(99,102,241,0.15)',
        borderColor: 'rgba(99,102,241,0.8)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderRecentTasks(tasks, today) {
  const container = document.getElementById('recent-tasks-container');
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No tasks yet</div>
        <div class="empty-state-text">Create your first task to get started.</div>
        <a href="/tasks.html" class="btn btn-primary">Go to Tasks</a>
      </div>`;
    return;
  }

  const rows = tasks.map(task => {
    const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < today;
    const statusLabel = task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do';
    const badgeClass = overdue ? 'overdue' : task.status;
    const displayStatus = overdue ? 'Overdue' : statusLabel;
    return `
      <tr>
        <td class="td-primary">${escapeHtml(task.title)}</td>
        <td>${escapeHtml(task.project_name || '—')}</td>
        <td>${task.assignee_name ? escapeHtml(task.assignee_name) : '<span class="text-muted">Unassigned</span>'}</td>
        <td><span class="badge badge-${badgeClass}">${displayStatus}</span></td>
        <td><span class="${overdue ? 'task-due-date overdue' : 'task-due-date'}">${task.due_date ? formatDate(task.due_date) : '—'}</span></td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Task</th><th>Project</th><th>Assignee</th><th>Status</th><th>Due Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ===== USERS PANEL =====
async function openUsersPanel() {
  document.getElementById('users-modal').classList.add('open');
  try {
    const res = await getUsers();
    renderUsersList(res.data);
  } catch (err) {
    document.getElementById('users-list-container').innerHTML = `<div class="alert alert-error">⚠️ ${err.message}</div>`;
  }
}

function closeUsersPanel() {
  document.getElementById('users-modal').classList.remove('open');
}

function renderUsersList(users) {
  const container = document.getElementById('users-list-container');
  if (users.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No users found</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="user-avatar" style="width:30px;height:30px;font-size:0.75rem;border-radius:7px;">${getInitials(u.name)}</div>
                  <span class="td-primary">${escapeHtml(u.name)}</span>
                </div>
              </td>
              <td>${escapeHtml(u.email)}</td>
              <td><span class="badge badge-${u.role}">${u.role}</span></td>
              <td>${formatDate(u.created_at)}</td>
              <td>
                ${u.id !== user.id ? `
                  <select class="filter-select" onchange="changeUserRole(${u.id}, this.value)" style="font-size:0.78rem;">
                    <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                  </select>` : '<span class="text-muted text-sm">You</span>'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function changeUserRole(userId, role) {
  try {
    await updateUserRole(userId, role);
    const res = await getUsers();
    renderUsersList(res.data);
  } catch (err) {
    alert('Error updating role: ' + err.message);
  }
}

// Close modal on overlay click
document.getElementById('users-modal').addEventListener('click', function(e) {
  if (e.target === this) closeUsersPanel();
});

// ===== BOOT =====
initUserUI();
loadDashboard();
