const express = require('express');
const router = express.Router();

const AuthController = require('./controller');
const validateRequest = require('../../../middleware/validateRequest');
const { authenticateToken } = require('../../../middleware/auth');
const { asyncHandler } = require('../../../middleware/errorHandler');

const {
    registerSchema,
    loginSchema,
    verifyPhoneSchema,
    resendCodeSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    updateProfileSchema
} = require('./validation');

// Public routes (no authentication required)

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', 
    validateRequest(registerSchema),
    asyncHandler(AuthController.register)
);

/**
 * @route POST /api/v1/auth/verify-phone
 * @desc Verify phone number with verification code
 * @access Public
 */
router.post('/verify-phone', 
    validateRequest(verifyPhoneSchema),
    asyncHandler(AuthController.verifyPhone)
);

/**
 * @route POST /api/v1/auth/resend-code
 * @desc Resend verification code
 * @access Public
 */
router.post('/resend-code', 
    validateRequest(resendCodeSchema),
    asyncHandler(AuthController.resendVerificationCode)
);

/**
 * @route POST /api/v1/auth/login
 * @desc User login
 * @access Public
 */
router.post('/login', 
    validateRequest(loginSchema),
    asyncHandler(AuthController.login)
);

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Send password reset code
 * @access Public
 */
router.post('/forgot-password', 
    validateRequest(forgotPasswordSchema),
    asyncHandler(AuthController.forgotPassword)
);

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password with verification code
 * @access Public
 */
router.post('/reset-password', 
    validateRequest(resetPasswordSchema),
    asyncHandler(AuthController.resetPassword)
);

// Protected routes (authentication required)

/**
 * @route GET /api/v1/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', 
    authenticateToken,
    asyncHandler(AuthController.getProfile)
);

/**
 * @route PUT /api/v1/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', 
    authenticateToken,
    validateRequest(updateProfileSchema),
    asyncHandler(AuthController.updateProfile)
);

/**
 * @route POST /api/v1/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password', 
    authenticateToken,
    validateRequest(changePasswordSchema),
    asyncHandler(AuthController.changePassword)
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user (for completeness - token invalidation handled client-side)
 * @access Private
 */
router.post('/logout', 
    authenticateToken,
    (req, res) => {
        res.json({
            status: true,
            message: 'Logged out successfully'
        });
    }
);

module.exports = router;