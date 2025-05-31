// src/middleware/security.js
const rateLimit = require('express-rate-limit');
const { resultObject } = require('../helpers/common');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: resultObject(false, "Too many login attempts, please try again in 15 minutes"),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json(resultObject(false, "Too many login attempts, please try again in 15 minutes"));
    }
});

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 password reset requests per hour
    message: resultObject(false, "Too many password reset requests, please try again in 1 hour"),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json(resultObject(false, "Too many password reset requests, please try again in 1 hour"));
    }
});

// Rate limiting for general API requests
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: resultObject(false, "Too many requests, please try again later"),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json(resultObject(false, "Too many requests, please try again later"));
    }
});

// Rate limiting for sensitive operations
const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 sensitive operations per hour
    message: resultObject(false, "Too many sensitive operations, please try again in 1 hour"),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json(resultObject(false, "Too many sensitive operations, please try again in 1 hour"));
    }
});

// Middleware to check if user can perform admin actions
const requireAdminRole = (requiredRoleId) => {
    return async (req, res, next) => {
        try {
            const token = await getToken(req);
            const authorize = await verifyUserToken(token);
            
            if (!authorize?.roles?.includes(requiredRoleId)) {
                return res.status(403).json(resultObject(false, "Insufficient permissions for this operation"));
            }
            
            next();
        } catch (error) {
            return res.status(401).json(resultObject(false, "Authentication required"));
        }
    };
};

// Middleware to check if user can access their own data or is admin
const requireOwnershipOrAdmin = async (req, res, next) => {
    try {
        const token = await getToken(req);
        const authorize = await verifyUserToken(token);
        const targetUserId = parseInt(req.params.id);
        
        // Allow if user is accessing their own data or is admin
        if (authorize.id === targetUserId || authorize.roles?.includes(1)) {
            next();
        } else {
            return res.status(403).json(resultObject(false, "You can only access your own data"));
        }
    } catch (error) {
        return res.status(401).json(resultObject(false, "Authentication required"));
    }
};

// Middleware to log sensitive operations
const logSensitiveOperation = (operationType) => {
    return async (req, res, next) => {
        try {
            const token = await getToken(req);
            const authorize = await verifyUserToken(token);
            
            // Log the operation attempt
            await createUserActivityLogModel({
                user_id: authorize.id,
                action: `${operationType}_attempted`,
                description: `User attempted ${operationType}`,
                ip_address: req.ip || req.connection.remoteAddress,
                metadata: JSON.stringify({
                    endpoint: req.originalUrl,
                    method: req.method,
                    userAgent: req.get('User-Agent')
                })
            });
            
            next();
        } catch (error) {
            next();
        }
    };
};

// Middleware to validate password strength
const validatePasswordStrength = (req, res, next) => {
    const { newPassword, password } = req.body;
    const passwordToCheck = newPassword || password;
    
    if (!passwordToCheck) {
        return next();
    }
    
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(passwordToCheck);
    const hasLowerCase = /[a-z]/.test(passwordToCheck);
    const hasNumbers = /\d/.test(passwordToCheck);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(passwordToCheck);
    
    const errors = [];
    
    if (passwordToCheck.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
    }
    
    if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!hasNumbers) {
        errors.push('Password must contain at least one number');
    }
    
    if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
    }
    
    if (errors.length > 0) {
        return res.status(400).json(resultObject(false, "Password does not meet security requirements", errors));
    }
    
    next();
};

// Middleware to check if user account is active
const requireActiveAccount = async (req, res, next) => {
    try {
        const token = await getToken(req);
        const authorize = await verifyUserToken(token);
        
        if (!authorize.enabled) {
            return res.status(403).json(resultObject(false, "Account is disabled. Please contact administrator."));
        }
        
        next();
    } catch (error) {
        return res.status(401).json(resultObject(false, "Authentication required"));
    }
};

// Middleware to prevent self-deletion
const preventSelfDeletion = async (req, res, next) => {
    try {
        const token = await getToken(req);
        const authorize = await verifyUserToken(token);
        const targetUserId = parseInt(req.params.id);
        
        if (authorize.id === targetUserId) {
            return res.status(400).json(resultObject(false, "You cannot delete your own account"));
        }
        
        next();
    } catch (error) {
        return res.status(401).json(resultObject(false, "Authentication required"));
    }
};

// Middleware to prevent bulk operations on self
const preventBulkSelfOperation = async (req, res, next) => {
    try {
        const token = await getToken(req);
        const authorize = await verifyUserToken(token);
        const { user_ids } = req.body;
        
        if (user_ids && user_ids.includes(authorize.id)) {
            return res.status(400).json(resultObject(false, "You cannot perform bulk operations on your own account"));
        }
        
        next();
    } catch (error) {
        return res.status(401).json(resultObject(false, "Authentication required"));
    }
};

module.exports = {
    loginLimiter,
    passwordResetLimiter,
    generalLimiter,
    sensitiveLimiter,
    requireAdminRole,
    requireOwnershipOrAdmin,
    logSensitiveOperation,
    validatePasswordStrength,
    requireActiveAccount,
    preventSelfDeletion,
    preventBulkSelfOperation
};

// Example usage in router:
/*
const {
    loginLimiter,
    passwordResetLimiter,
    sensitiveLimiter,
    requireAdminRole,
    requireOwnershipOrAdmin,
    logSensitiveOperation,
    validatePasswordStrength,
    preventSelfDeletion,
    preventBulkSelfOperation
} = require('../../../middleware/security');

// Apply to login route
router.post("/", loginLimiter, validateRequest(loginUserSchema), (req, res) => {
    loginUserController(req, (result) => {
        res.json(result);
    });
});

// Apply to password reset route
router.post("/forgot-password", passwordResetLimiter, validateRequest(forgotPasswordSchema), (req, res) => {
    forgotPasswordController(req, (result) => {
        res.json(result);
    });
});

// Apply to sensitive operations
router.post("/bulk-delete", 
    checkUserAuthorized(), 
    requireAdminRole(1), 
    sensitiveLimiter,
    logSensitiveOperation('bulk_delete_users'),
    preventBulkSelfOperation,
    validateRequest(bulkDeleteUsersSchema), 
    (req, res) => {
        bulkDeleteUsersController(req, (result) => {
            res.json(result);
        });
    }
);

// Apply to user profile routes
router.get("/:id", 
    checkUserAuthorized(), 
    requireOwnershipOrAdmin,
    validateRequest(userIdParamSchema), 
    (req, res) => {
        getUserByIdController(req, (result) => {
            res.json(result);
        });
    }
);
*/