const { pool } = require('../config/db');

// GET /api/users — Admin only
const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('GetAllUsers error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/users/:id/role — Admin only
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'member'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be "admin" or "member".' });
    }

    // Prevent admin from demoting themselves
    if (parseInt(id) === req.user.id && role === 'member') {
      return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
    }

    const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const [updated] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('UpdateUserRole error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllUsers, updateUserRole };
