const { pool } = require('../config/db');

// Store active SSE clients: { userId -> res }
const clients = new Map();

// SSE stream endpoint — GET /api/notifications/stream
const streamNotifications = (req, res) => {
  const userId = req.user.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\ndata: ping\n\n');
  }, 30000);

  // Register this client
  clients.set(userId, res);

  // On disconnect, clean up
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(userId);
  });
};

// Push a notification to a specific user (called internally)
const pushNotification = async (userId, message, type, taskId = null) => {
  try {
    // Save to DB
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, message, type, task_id) VALUES (?, ?, ?, ?)',
      [userId, message, type, taskId]
    );

    const notification = {
      id: result.insertId,
      user_id: userId,
      message,
      type,
      task_id: taskId,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // If user is connected via SSE, send immediately
    if (clients.has(userId)) {
      const clientRes = clients.get(userId);
      clientRes.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
    }
  } catch (err) {
    console.error('Push notification error:', err);
  }
};

// GET /api/notifications — fetch all for logged-in user
const getNotifications = async (req, res) => {
  try {
    const [notifications] = await pool.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { streamNotifications, pushNotification, getNotifications, markAsRead, markAllAsRead };