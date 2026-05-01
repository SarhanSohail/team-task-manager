const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { getAllUsers, updateUserRole } = require('../controllers/userController');

router.get('/', auth, requireRole('admin'), getAllUsers);
router.put('/:id/role', auth, requireRole('admin'), updateUserRole);

module.exports = router;
