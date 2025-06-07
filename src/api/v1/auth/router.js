const express = require("express");
const router = express.Router();

const AuthController = require("./controller");
const validateRequest = require("../../../middleware/validateRequest");
const { authenticateToken } = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");

const {
  registerSchema,
  loginSchema,
  activateAccountSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require("./validation");
const {
  uploadMiddlewares,
  handleMulterError,
} = require("../../../middleware/multer");

// Public routes (no authentication required)

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user (NO PHONE VERIFICATION)
 * @access Public
 */
router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(AuthController.register)
);

/**
 * @route POST /api/v1/auth/activate
 * @desc Activate account with activation code
 * @access Public
 */
router.post(
  "/activate",
  validateRequest(activateAccountSchema),
  asyncHandler(AuthController.activateAccount)
);

/**
 * @route POST /api/v1/auth/login
 * @desc User login (only checks is_active)
 * @access Public
 */
router.post(
  "/login",
  validateRequest(loginSchema),
  asyncHandler(AuthController.login)
);

// Protected routes (authentication required)

/**
 * @route GET /api/v1/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get(
  "/profile",
  authenticateToken,
  asyncHandler(AuthController.getProfile)
);

/**
 * @route PUT /api/v1/auth/profile
 * @desc Update user profile with optional profile picture upload
 * @access Private
 */
router.put(
  "/profile",
  authenticateToken,
  uploadMiddlewares.user,
  handleMulterError,
  validateRequest(updateProfileSchema),
  asyncHandler(AuthController.updateProfile)
);

/**
 * @route POST /api/v1/auth/profile/picture
 * @desc Upload/Update profile picture
 * @access Private
 */
router.post(
  "/profile/picture",
  authenticateToken,
  uploadMiddlewares.user,
  handleMulterError,
  asyncHandler(AuthController.updateProfilePicture)
);

/**
 * @route DELETE /api/v1/auth/profile/picture
 * @desc Remove profile picture
 * @access Private
 */
router.delete(
  "/profile/picture",
  authenticateToken,
  asyncHandler(AuthController.removeProfilePicture)
);

/**
 * @route POST /api/v1/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post(
  "/change-password",
  authenticateToken,
  validateRequest(changePasswordSchema),
  asyncHandler(AuthController.changePassword)
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post("/logout", authenticateToken, (req, res) => {
  res.json({
    status: true,
    message: "Logged out successfully",
  });
});

module.exports = router;
