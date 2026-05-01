// Tasks page — Kanban board with drag-and-drop
if (!protectPage()) throw new Error('Not authenticated');

const user = getCurrentUser();
let allTasks = [];
let allProjects = [];
let projectMembersCache = {};
let draggedTaskId = null;

// Init sidebar
document.getElementById('sidebar-avatar').textContent = getInitials(user.name);
document.getElementById('sidebar-name').textContent = user.name;
document.getElementById('sidebar-role').textContent = user.role;

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ===== LOAD DATA =====
async function loadData() {
  try {
    const [tasksRes, projectsRes] = await Promise.all([getTasks(), getProjects()]);
    allTasks = tasksRes.data;
    allProjects = projectsRes.data;
    populateProjectFilter();
    renderKanban(allTasks);
  } catch (err) {
    showAlert('alert-container', err.message);
  }
}

function populateProjectFilter() {
  const sel = document.getElementById('filter-project');
  sel.innerHTML = '<option value="">All Projects</option>' +
    allProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

// ===== FILTERS =====
function applyFilters() {
  const projectId = document.getElementById('filter-project').value;
  const priority = document.getElementById('filter-priority').value;
  const mine = document.getElementById('filter-mine').checked;

  let filtered = [...allTasks];
  if (projectId) filtered = filtered.filter(t => t.project_id == projectId);
  if (priority) filtered = filtered.filter(t => t.priority === priority);
  if (mine) filtered = filtered.filter(t => t.assigned_to === user.id);

  renderKanban(filtered);
}

function clearFilters() {
  document.getElementById('filter-project').value = '';
  document.getElementById('filter-priority').value = '';
  document.getElementById('filter-mine').checked = false;
  renderKanban(allTasks);
}

// ===== RENDER KANBAN =====
function renderKanban(tasks) {
  const columns = { todo: [], in_progress: [], done: [] };
  tasks.forEach(t => { if (columns[t.status]) columns[t.status].push(t); });

  Object.entries(columns).forEach(([status, columnTasks]) => {
    const container = document.getElementById(`cards-${status}`);
    const count = document.getElementById(`count-${status}`);
    count.textContent = columnTasks.length;

    if (columnTasks.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:24px 12px;color:var(--text-muted);font-size:0.8rem;">No tasks</div>`;
      return;
    }

    container.innerHTML = columnTasks.map(task => renderTaskCard(task)).join('');

    // Attach drag events
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedTaskId = parseInt(card.dataset.id);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => {
        const task = allTasks.find(t => t.id === parseInt(card.dataset.id));
        if (task) openTaskModal(task);
      });
    });
  });
}

function renderTaskCard(task) {
  const overdue = isOverdue(task);
  const today = new Date();
  today.setHours(0,0,0,0);

  return `
    <div class="task-card ${overdue ? 'overdue' : ''}" draggable="true" data-id="${task.id}">
      <div class="task-card-title">${escapeHtml(task.title)}</div>
      <div class="task-card-meta">
        <span class="badge badge-${task.priority}">${task.priority}</span>
        ${task.project_name ? `<span class="task-project-name">${escapeHtml(task.project_name)}</span>` : ''}
      </div>
      <div class="task-card-footer">
        <div class="task-due-date ${overdue ? 'overdue' : ''}">
          ${task.due_date ? '📅 ' + formatDate(task.due_date) : ''}
          ${overdue ? ' ⚠️' : ''}
        </div>
        ${task.assignee_name
          ? `<div class="task-assignee-avatar" title="${escapeHtml(task.assignee_name)}">${getInitials(task.assignee_name)}</div>`
          : '<span style="font-size:0.72rem;color:var(--text-muted);">Unassigned</span>'}
      </div>
    </div>`;
}

// ===== DRAG AND DROP =====
function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
  e.dataTransfer.dropEffect = 'move';
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (!draggedTaskId) return;

  const task = allTasks.find(t => t.id === draggedTaskId);
  if (!task || task.status === newStatus) return;

  // Optimistic update
  task.status = newStatus;
  renderKanban(allTasks);

  try {
    await updateTaskStatus(draggedTaskId, newStatus);
    showAlert('alert-container', 'Task status updated.', 'success');
  } catch (err) {
    showAlert('alert-container', 'Failed to update task status: ' + err.message);
    loadData(); // Revert
  }

  draggedTaskId = null;
}

// ===== TASK MODAL =====
async function openTaskModal(task = null) {
  const modal = document.getElementById('task-modal');
  const isEdit = !!task;

  document.getElementById('task-modal-title').textContent = isEdit ? 'Edit Task' : 'New Task';
  document.getElementById('save-task-btn').textContent = isEdit ? 'Save Changes' : 'Create Task';
  document.getElementById('task-id').value = task ? task.id : '';
  document.getElementById('task-title').value = task ? task.title : '';
  document.getElementById('task-desc').value = task ? (task.description || '') : '';
  document.getElementById('task-priority').value = task ? task.priority : 'medium';
  document.getElementById('task-status').value = task ? task.status : 'todo';
  document.getElementById('task-due').value = task && task.due_date ? task.due_date.split('T')[0] : '';

  document.getElementById('delete-task-btn').classList.toggle('hidden',
    !isEdit || (task.created_by !== user.id && !isAdmin()));

  document.getElementById('task-alert').innerHTML = '';

  // Populate project dropdown
  const projSel = document.getElementById('task-project');
  projSel.innerHTML = '<option value="">Select project...</option>' +
    allProjects.map(p => `<option value="${p.id}" ${task && task.project_id == p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');

  // Load members for selected project
  await loadProjectMembers();

  if (task) {
    document.getElementById('task-assignee').value = task.assigned_to || '';
  }

  modal.classList.add('open');
  document.getElementById('task-title').focus();
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('open');
}

async function loadProjectMembers() {
  const projectId = document.getElementById('task-project').value;
  const assigneeSel = document.getElementById('task-assignee');

  if (!projectId) {
    assigneeSel.innerHTML = '<option value="">Select project first</option>';
    return;
  }

  try {
    if (!projectMembersCache[projectId]) {
      const res = await getProject(projectId);
      projectMembersCache[projectId] = res.data.members;
    }
    const members = projectMembersCache[projectId];
    assigneeSel.innerHTML = '<option value="">Unassigned</option>' +
      members.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  } catch {
    assigneeSel.innerHTML = '<option value="">Could not load members</option>';
  }
}

async function handleSaveTask() {
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const project_id = document.getElementById('task-project').value;
  const assigned_to = document.getElementById('task-assignee').value || null;
  const priority = document.getElementById('task-priority').value;
  const status = document.getElementById('task-status').value;
  const due_date = document.getElementById('task-due').value || null;
  const btn = document.getElementById('save-task-btn');

  if (!title) return showAlert('task-alert', 'Task title is required.');
  if (!project_id) return showAlert('task-alert', 'Please select a project.');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving...';

  try {
    const data = { title, description, project_id: parseInt(project_id), assigned_to: assigned_to ? parseInt(assigned_to) : null, priority, status, due_date };

    if (id) {
      await updateTask(id, data);
      showAlert('alert-container', 'Task updated.', 'success');
    } else {
      await createTask(data);
      showAlert('alert-container', 'Task created!', 'success');
    }

    closeTaskModal();
    loadData();
  } catch (err) {
    showAlert('task-alert', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = id ? 'Save Changes' : 'Create Task';
  }
}

async function handleDeleteTask() {
  const id = document.getElementById('task-id').value;
  if (!id || !confirm('Delete this task? This cannot be undone.')) return;

  try {
    await deleteTask(id);
    closeTaskModal();
    showAlert('alert-container', 'Task deleted.', 'success');
    loadData();
  } catch (err) {
    showAlert('task-alert', err.message);
  }
}

// Close modal on overlay/ESC
document.getElementById('task-modal').addEventListener('click', function(e) { if (e.target === this) closeTaskModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTaskModal(); });

loadData();
