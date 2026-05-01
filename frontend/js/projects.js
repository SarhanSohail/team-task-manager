// Projects page logic
if (!protectPage()) throw new Error('Not authenticated');

const user = getCurrentUser();
let allUsers = [];
let currentProjectId = null;

// Init sidebar
document.getElementById('sidebar-avatar').textContent = getInitials(user.name);
document.getElementById('sidebar-name').textContent = user.name;
document.getElementById('sidebar-role').textContent = user.role;
if (isAdmin()) document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ===== LOAD PROJECTS =====
async function loadProjects() {
  try {
    const [projectsRes, usersRes] = await Promise.all([
      getProjects(),
      isAdmin() ? getUsers() : Promise.resolve({ data: [] })
    ]);
    allUsers = usersRes.data;
    renderProjects(projectsRes.data);
  } catch (err) {
    showAlert('alert-container', err.message);
  }
}

function renderProjects(projects) {
  const container = document.getElementById('projects-container');
  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-title">No projects yet</div>
        <div class="empty-state-text">${isAdmin() ? 'Create your first project to get started.' : 'You have not been added to any projects yet.'}</div>
        ${isAdmin() ? '<button class="btn btn-primary" onclick="openCreateModal()">Create Project</button>' : ''}
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="projects-grid">
      ${projects.map(p => `
        <div class="project-card" onclick="openDetailModal(${p.id})">
          <div class="project-card-header">
            <div class="project-card-icon">📁</div>
            ${isAdmin() ? `<button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();handleDeleteProject(${p.id}, '${escapeHtml(p.name)}')" title="Delete project">🗑</button>` : ''}
          </div>
          <div class="project-card-title">${escapeHtml(p.name)}</div>
          <div class="project-card-desc">${escapeHtml(p.description) || '<span style="color:var(--text-muted);font-style:italic;">No description</span>'}</div>
          <div class="project-card-meta">
            <div class="project-meta-item">👥 <strong>${p.member_count}</strong> member${p.member_count != 1 ? 's' : ''}</div>
            <div class="project-meta-item">✅ <strong>${p.task_count}</strong> task${p.task_count != 1 ? 's' : ''}</div>
          </div>
          <div class="divider" style="margin:14px 0;"></div>
          <div class="text-muted text-sm">Owner: ${escapeHtml(p.owner_name)}</div>
        </div>`).join('')}
    </div>`;
}

// ===== CREATE PROJECT =====
function openCreateModal() {
  document.getElementById('create-modal').classList.add('open');
  document.getElementById('project-name').focus();
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.remove('open');
  document.getElementById('project-name').value = '';
  document.getElementById('project-desc').value = '';
  document.getElementById('create-alert').innerHTML = '';
}

async function handleCreateProject() {
  const name = document.getElementById('project-name').value.trim();
  const description = document.getElementById('project-desc').value.trim();
  const btn = document.getElementById('create-btn');

  if (!name) return showAlert('create-alert', 'Project name is required.');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    await createProject({ name, description });
    closeCreateModal();
    showAlert('alert-container', 'Project created successfully!', 'success');
    loadProjects();
  } catch (err) {
    showAlert('create-alert', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Project';
  }
}

// ===== DELETE PROJECT =====
async function handleDeleteProject(id, name) {
  if (!confirm(`Delete project "${name}"? All tasks in this project will also be deleted. This cannot be undone.`)) return;
  try {
    await deleteProject(id);
    showAlert('alert-container', 'Project deleted.', 'success');
    loadProjects();
  } catch (err) {
    showAlert('alert-container', err.message);
  }
}

// ===== PROJECT DETAIL =====
async function openDetailModal(id) {
  currentProjectId = id;
  document.getElementById('detail-modal').classList.add('open');
  document.getElementById('detail-body').innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Loading...</div>';

  try {
    const res = await getProject(id);
    renderDetailModal(res.data);
  } catch (err) {
    document.getElementById('detail-body').innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
  currentProjectId = null;
}

function renderDetailModal(project) {
  document.getElementById('detail-title').textContent = project.name;
  document.getElementById('detail-owner').textContent = 'Owner: ' + (project.owner_name || '—');

  const canManageMembers = isAdmin() || project.owner_id === user.id;
  const nonMembers = allUsers.filter(u => !project.members.find(m => m.id === u.id));

  document.getElementById('detail-body').innerHTML = `
    ${project.description ? `<p style="color:var(--text-secondary);margin-bottom:20px;">${escapeHtml(project.description)}</p>` : ''}
    
    <div class="section-title">Members (${project.members.length})</div>
    <div class="members-list" id="members-list">
      ${project.members.length === 0 ? '<div class="text-muted text-sm">No members yet.</div>' : 
        project.members.map(m => `
          <div class="member-item">
            <div class="member-avatar">${getInitials(m.name)}</div>
            <div class="member-info">
              <div class="member-name">${escapeHtml(m.name)}</div>
              <div class="member-email">${escapeHtml(m.email)}</div>
            </div>
            <span class="badge badge-${m.role}">${m.role}</span>
            ${canManageMembers && m.id !== project.owner_id ? 
              `<button class="btn btn-ghost btn-sm btn-icon" onclick="handleRemoveMember(${project.id}, ${m.id})" title="Remove member">✕</button>` : ''}
          </div>`).join('')}
    </div>

    ${canManageMembers && nonMembers.length > 0 ? `
      <div class="mt-4">
        <div class="section-title">Add Member</div>
        <div style="display:flex;gap:10px;">
          <select id="add-member-select" class="form-control" style="flex:1;">
            <option value="">Select a user...</option>
            ${nonMembers.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${u.role})</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="handleAddMember(${project.id})">Add</button>
        </div>
      </div>` : ''}

    <div class="divider"></div>

    <div class="section-title">Tasks (${project.tasks.length})</div>
    ${project.tasks.length === 0 ? '<div class="text-muted text-sm">No tasks in this project.</div>' :
      `<div class="table-container">
        <table>
          <thead>
            <tr><th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr>
          </thead>
          <tbody>
            ${project.tasks.map(t => `
              <tr>
                <td class="td-primary">${escapeHtml(t.title)}</td>
                <td><span class="badge badge-${t.status}">${t.status.replace('_', ' ')}</span></td>
                <td><span class="badge badge-${t.priority}">${t.priority}</span></td>
                <td>${t.assignee_name ? escapeHtml(t.assignee_name) : '<span class="text-muted">—</span>'}</td>
                <td>${t.due_date ? formatDate(t.due_date) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
}

async function handleAddMember(projectId) {
  const select = document.getElementById('add-member-select');
  const userId = select.value;
  if (!userId) return;

  try {
    await addProjectMember(projectId, parseInt(userId));
    const res = await getProject(projectId);
    renderDetailModal(res.data);
  } catch (err) {
    alert('Error adding member: ' + err.message);
  }
}

async function handleRemoveMember(projectId, userId) {
  if (!confirm('Remove this member from the project?')) return;
  try {
    await removeProjectMember(projectId, userId);
    const res = await getProject(projectId);
    renderDetailModal(res.data);
  } catch (err) {
    alert('Error removing member: ' + err.message);
  }
}

// Close modals on overlay click
document.getElementById('create-modal').addEventListener('click', function(e) { if (e.target === this) closeCreateModal(); });
document.getElementById('detail-modal').addEventListener('click', function(e) { if (e.target === this) closeDetailModal(); });

// Enter key for create modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeCreateModal(); closeDetailModal(); }
});

loadProjects();
