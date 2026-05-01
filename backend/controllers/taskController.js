const { pool } = require('../config/db');
const { pushNotification } = require('./notificationController');

const taskBaseQuery = `
  SELECT t.*,
    u.name AS assignee_name, u.email AS assignee_email,
    c.name AS creator_name,
    p.name AS project_name
  FROM tasks t
  LEFT JOIN users u ON t.assigned_to = u.id
  JOIN users c ON t.created_by = c.id
  JOIN projects p ON t.project_id = p.id
`;

// GET /api/tasks
const getTasks = async (req, res) => {
  try {
    const { project, status, assignee, mine } = req.query;
    let conditions = [];
    let params = [];

    if (req.user.role !== 'admin') {
      conditions.push(`(
        t.project_id IN (
          SELECT project_id FROM project_members WHERE user_id = ?
          UNION SELECT id FROM projects WHERE owner_id = ?
        )
        OR t.assigned_to = ?
      )`);
      params.push(req.user.id, req.user.id, req.user.id);
    }

    if (project) {
      conditions.push('t.project_id = ?');
      params.push(parseInt(project));
    }

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (assignee) {
      conditions.push('t.assigned_to = ?');
      params.push(parseInt(assignee));
    }

    if (mine === 'true') {
      conditions.push('t.assigned_to = ?');
      params.push(req.user.id);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `${taskBaseQuery} ${whereClause} ORDER BY t.created_at DESC`;

    const [tasks] = await pool.query(query, params);
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error('GetTasks error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/tasks
const createTask = async (req, res) => {
  try {
    const { title, description, project_id, assigned_to, status, priority, due_date } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'Project ID is required.' });
    }

    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (req.user.role !== 'admin') {
      const [membership] = await pool.query(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
        [project_id, req.user.id]
      );
      const isOwner = projects[0].owner_id === req.user.id;
      if (!isOwner && membership.length === 0) {
        return res.status(403).json({ success: false, message: 'You must be a member of the project to create tasks.' });
      }
    }

    const validStatuses = ['todo', 'in_progress', 'done'];
    const validPriorities = ['low', 'medium', 'high'];
    const taskStatus = validStatuses.includes(status) ? status : 'todo';
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

    const [result] = await pool.query(
      `INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title.trim(), description || null, project_id, assigned_to || null, req.user.id, taskStatus, taskPriority, due_date || null]
    );

    // Notify assignee if different from creator
    if (assigned_to && assigned_to !== req.user.id) {
      await pushNotification(
        assigned_to,
        `New task assigned to you: "${title.trim()}"`,
        'task_assigned',
        result.insertId
      );
    }

    const [tasks] = await pool.query(`${taskBaseQuery} WHERE t.id = ?`, [result.insertId]);
    res.status(201).json({ success: true, data: tasks[0] });
  } catch (err) {
    console.error('CreateTask error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/tasks/:id
const getTaskById = async (req, res) => {
  try {
    const [tasks] = await pool.query(`${taskBaseQuery} WHERE t.id = ?`, [req.params.id]);

    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    res.json({ success: true, data: tasks[0] });
  } catch (err) {
    console.error('GetTaskById error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/tasks/:id
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, assigned_to, status, priority, due_date, project_id } = req.body;

    const [tasks] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const task = tasks[0];
    const isAdmin = req.user.role === 'admin';
    const isCreator = task.created_by === req.user.id;
    const isAssignee = task.assigned_to === req.user.id;

    if (!isAdmin && !isCreator && !isAssignee) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this task.' });
    }

    const validStatuses = ['todo', 'in_progress', 'done'];
    const validPriorities = ['low', 'medium', 'high'];

    const newTitle = (title || task.title).trim();
    const newStatus = validStatuses.includes(status) ? status : task.status;
    const newPriority = validPriorities.includes(priority) ? priority : task.priority;
    const newProjectId = project_id || task.project_id;
    const newAssignedTo = assigned_to !== undefined ? (assigned_to || null) : task.assigned_to;
    const newDueDate = due_date !== undefined ? (due_date || null) : task.due_date;
    const newDescription = description !== undefined ? description : task.description;

    await pool.query(
      `UPDATE tasks SET title=?, description=?, project_id=?, assigned_to=?, status=?, priority=?, due_date=? WHERE id=?`,
      [newTitle, newDescription, newProjectId, newAssignedTo, newStatus, newPriority, newDueDate, id]
    );

    // Notify new assignee if changed
    if (newAssignedTo && newAssignedTo !== req.user.id && newAssignedTo !== task.assigned_to) {
      await pushNotification(
        newAssignedTo,
        `Task assigned to you: "${newTitle}"`,
        'task_assigned',
        parseInt(id)
      );
    }

    const [updated] = await pool.query(`${taskBaseQuery} WHERE t.id = ?`, [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('UpdateTask error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const [tasks] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const task = tasks[0];
    if (req.user.role !== 'admin' && task.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only admins or the task creator can delete this task.' });
    }

    await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true, data: { message: 'Task deleted successfully.' } });
  } catch (err) {
    console.error('DeleteTask error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/tasks/:id/status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['todo', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be todo, in_progress, or done.' });
    }

    const [tasks] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const task = tasks[0];
    const isAdmin = req.user.role === 'admin';
    const isCreator = task.created_by === req.user.id;
    const isAssignee = task.assigned_to === req.user.id;

    if (!isAdmin && !isCreator && !isAssignee) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this task.' });
    }

    await pool.query('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
    const [updated] = await pool.query(`${taskBaseQuery} WHERE t.id = ?`, [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('UpdateTaskStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getTasks, createTask, getTaskById, updateTask, deleteTask, updateTaskStatus };