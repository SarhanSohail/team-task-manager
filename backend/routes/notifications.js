const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  streamNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead
} = require('../controllers/notificationController');

router.get('/stream', auth, streamNotifications);
router.get('/', auth, getNotifications);
router.patch('/read-all', auth, markAllAsRead);
router.patch('/:id/read', auth, markAsRead);

module.exports = router;