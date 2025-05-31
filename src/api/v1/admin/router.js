const express = require('express');
const router = express.Router();

const AdminController = require('./controller');
const validateRequest = require('../../../middleware/validateRequest');
const { authenticateToken, requireAdmin } = require('../../../middleware/auth');
const { asyncHandler } = require('../../../middleware/errorHandler');

const {
    activateUserSchema,
    getUsersSchema
} = require('../auth/validation');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route GET /api/v1/admin/users
 * @desc Get all users with pagination and filters
 * @access Admin
 */
router.get('/users', 
    validateRequest(getUsersSchema),
    asyncHandler(AdminController.getAllUsers)
);

/**
 * @route GET /api/v1/admin/users/pending
 * @desc Get pending users (not activated but phone verified)
 * @access Admin
 */
router.get('/users/pending', 
    validateRequest(getUsersSchema),
    asyncHandler(AdminController.getPendingUsers)
);

/**
 * @route GET /api/v1/admin/users/:user_id
 * @desc Get user by ID
 * @access Admin
 */
router.get('/users/:user_id', 
    asyncHandler(AdminController.getUserById)
);

/**
 * @route POST /api/v1/admin/users/activate
 * @desc Activate a user account
 * @access Admin
 */
router.post('/users/activate', 
    validateRequest(activateUserSchema),
    asyncHandler(AdminController.activateUser)
);

/**
 * @route POST /api/v1/admin/users/deactivate
 * @desc Deactivate a user account
 * @access Admin
 */
router.post('/users/deactivate', 
    validateRequest(activateUserSchema),
    asyncHandler(AdminController.deactivateUser)
);

/**
 * @route GET /api/v1/admin/stats
 * @desc Get activation statistics
 * @access Admin
 */
router.get('/stats', 
    asyncHandler(AdminController.getActivationStats)
);

/**
 * @route POST /api/v1/admin/users/bulk-activate
 * @desc Bulk activate multiple users
 * @access Admin
 */
router.post('/users/bulk-activate', 
    asyncHandler(AdminController.bulkActivateUsers)
);

/**
 * @route GET /api/v1/admin/users/search
 * @desc Search for users
 * @access Admin
 */
router.get('/users/search', 
    asyncHandler(AdminController.searchUsers)
);

module.exports = router;