const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
} = require('../controllers/taskController');

router.get('/', auth, getTasks);
router.post('/', auth, createTask);
router.get('/:id', auth, getTaskById);
router.put('/:id', auth, updateTask);
router.delete('/:id', auth, deleteTask);
router.patch('/:id/status', auth, updateTaskStatus);

module.exports = router;
