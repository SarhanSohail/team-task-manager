const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
} = require('../controllers/projectController');

router.get('/', auth, getProjects);
router.post('/', auth, requireRole('admin'), createProject);
router.get('/:id', auth, getProjectById);
router.put('/:id', auth, updateProject);
router.delete('/:id', auth, requireRole('admin'), deleteProject);
router.post('/:id/members', auth, addMember);
router.delete('/:id/members/:userId', auth, removeMember);

module.exports = router;
