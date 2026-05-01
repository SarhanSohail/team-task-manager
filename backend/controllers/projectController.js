const { pool } = require('../config/db');

// GET /api/projects
const getProjects = async (req, res) => {
  try {
    let query;
    let params;

    if (req.user.role === 'admin') {
      query = `
        SELECT p.*, u.name AS owner_name,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT p.*, u.name AS owner_name,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        WHERE p.owner_id = ? OR EXISTS (
          SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?
        )
        ORDER BY p.created_at DESC
      `;
      params = [req.user.id, req.user.id];
    }

    const [projects] = await pool.query(query, params);
    res.json({ success: true, data: projects });
  } catch (err) {
    console.error('GetProjects error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/projects — Admin only
const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
      [name.trim(), description || null, req.user.id]
    );

    // Auto-add creator as member
    await pool.query(
      'INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)',
      [result.insertId, req.user.id]
    );

    const [projects] = await pool.query(
      `SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
       FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: projects[0] });
  } catch (err) {
    console.error('CreateProject error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/projects/:id
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const [projects] = await pool.query(
      `SELECT p.*, u.name AS owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?`,
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const project = projects[0];

    // Check access for members
    if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
      const [membership] = await pool.query(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
        [id, req.user.id]
      );
      if (membership.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied to this project.' });
      }
    }

    // Get members
    const [members] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role FROM project_members pm
       JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`,
      [id]
    );

    // Get tasks
    const [tasks] = await pool.query(
      `SELECT t.*, u.name AS assignee_name, c.name AS creator_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       JOIN users c ON t.created_by = c.id
       WHERE t.project_id = ? ORDER BY t.created_at DESC`,
      [id]
    );

    res.json({ success: true, data: { ...project, members, tasks } });
  } catch (err) {
    console.error('GetProjectById error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/projects/:id
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const project = projects[0];
    if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only admins or the project owner can update this project.' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    await pool.query('UPDATE projects SET name = ?, description = ? WHERE id = ?', [name.trim(), description || null, id]);

    const [updated] = await pool.query(
      `SELECT p.*, u.name AS owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?`,
      [id]
    );
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('UpdateProject error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/projects/:id — Admin only
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    res.json({ success: true, data: { message: 'Project deleted successfully.' } });
  } catch (err) {
    console.error('DeleteProject error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/projects/:id/members
const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (req.user.role !== 'admin' && projects[0].owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only admins or the project owner can add members.' });
    }

    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await pool.query('INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [id, userId]);

    const [members] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role FROM project_members pm
       JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`,
      [id]
    );

    res.json({ success: true, data: members });
  } catch (err) {
    console.error('AddMember error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/projects/:id/members/:userId
const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (req.user.role !== 'admin' && projects[0].owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only admins or the project owner can remove members.' });
    }

    await pool.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [id, userId]);
    res.json({ success: true, data: { message: 'Member removed successfully.' } });
  } catch (err) {
    console.error('RemoveMember error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getProjects, createProject, getProjectById, updateProject, deleteProject, addMember, removeMember };
