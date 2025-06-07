const express = require("express");
const router = express.Router();

const AdminController = require("./controller");
const AdminActivationController = require("./activationController");
const validateRequest = require("../../../middleware/validateRequest");
const { authenticateToken, requireAdmin } = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");

const {
  activateUserSchema,
  getUsersSchema,
  generateActivationCodeSchema,
  getActivationCodesSchema,
} = require("../auth/validation");

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// ============ USER MANAGEMENT ROUTES ============

/**
 * @route GET /api/v1/admin/users
 * @desc Get all users with pagination and filters
 * @access Admin
 */
router.get(
  "/users",
  validateRequest(getUsersSchema),
  asyncHandler(AdminController.getAllUsers)
);

/**
 * @route GET /api/v1/admin/users/pending
 * @desc Get pending users (not activated)
 * @access Admin
 */
router.get(
  "/users/pending",
  validateRequest(getUsersSchema),
  asyncHandler(AdminController.getPendingUsers)
);

/**
 * @route GET /api/v1/admin/users/:user_id
 * @desc Get user by ID
 * @access Admin
 */
router.get("/users/:user_id", asyncHandler(AdminController.getUserById));

/**
 * @route POST /api/v1/admin/users/activate
 * @desc Activate a user account (direct admin activation)
 * @access Admin
 */
router.post(
  "/users/activate",
  validateRequest(activateUserSchema),
  asyncHandler(AdminController.activateUser)
);

/**
 * @route POST /api/v1/admin/users/deactivate
 * @desc Deactivate a user account
 * @access Admin
 */
router.post(
  "/users/deactivate",
  validateRequest(activateUserSchema),
  asyncHandler(AdminController.deactivateUser)
);

/**
 * @route GET /api/v1/admin/stats
 * @desc Get activation statistics
 * @access Admin
 */
router.get("/stats", asyncHandler(AdminController.getActivationStats));

/**
 * @route POST /api/v1/admin/users/bulk-activate
 * @desc Bulk activate multiple users
 * @access Admin
 */
router.post(
  "/users/bulk-activate",
  asyncHandler(AdminController.bulkActivateUsers)
);

/**
 * @route GET /api/v1/admin/users/search
 * @desc Search for users
 * @access Admin
 */
router.get("/users/search", asyncHandler(AdminController.searchUsers));

// ============ ACTIVATION CODE ROUTES ============

/**
 * @route POST /api/v1/admin/activation-codes/generate
 * @desc Generate new activation code
 * @access Admin
 */
router.post(
  "/activation-codes/generate",
  validateRequest(generateActivationCodeSchema),
  asyncHandler(AdminActivationController.generateActivationCode)
);

/**
 * @route GET /api/v1/admin/activation-codes
 * @desc Get all activation codes with filters
 * @access Admin
 */
router.get(
  "/activation-codes",
  validateRequest(getActivationCodesSchema),
  asyncHandler(AdminActivationController.getAllActivationCodes)
);

/**
 * @route GET /api/v1/admin/activation-codes/:code
 * @desc Get activation code details
 * @access Admin
 */
router.get(
  "/activation-codes/:code",
  asyncHandler(AdminActivationController.getActivationCode)
);

/**
 * @route PUT /api/v1/admin/activation-codes/:code/deactivate
 * @desc Deactivate activation code
 * @access Admin
 */
router.put(
  "/activation-codes/:code/deactivate",
  asyncHandler(AdminActivationController.deactivateCode)
);

/**
 * @route GET /api/v1/admin/activation-codes/stats
 * @desc Get activation code statistics
 * @access Admin
 */
router.get(
  "/activation-codes/stats",
  asyncHandler(AdminActivationController.getActivationStatistics)
);

module.exports = router;
