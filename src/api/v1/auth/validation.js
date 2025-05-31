const Joi = require('joi');

// Custom phone number validation
const phoneNumberValidation = Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
        'string.pattern.base': 'Please provide a valid phone number',
        'any.required': 'Phone number is required'
    });

// Registration validation schema
const registerSchema = Joi.object({
    phone_number: phoneNumberValidation,
    password: Joi.string()
        .min(6)
        .max(50)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters long',
            'string.max': 'Password cannot exceed 50 characters',
            'any.required': 'Password is required'
        }),
    confirm_password: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Password confirmation is required'
        }),
    first_name: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.min': 'First name must be at least 2 characters long',
            'string.max': 'First name cannot exceed 50 characters',
            'any.required': 'First name is required'
        }),
    last_name: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.min': 'Last name must be at least 2 characters long',
            'string.max': 'Last name cannot exceed 50 characters',
            'any.required': 'Last name is required'
        }),
    email: Joi.string()
        .email()
        .optional()
        .messages({
            'string.email': 'Please provide a valid email address'
        })
});

// Login validation schema
const loginSchema = Joi.object({
    phone_number: phoneNumberValidation,
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

// Phone verification schema
const verifyPhoneSchema = Joi.object({
    phone_number: phoneNumberValidation,
    verification_code: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': 'Verification code must be 6 digits',
            'string.pattern.base': 'Verification code must contain only numbers',
            'any.required': 'Verification code is required'
        })
});

// Resend verification code schema
const resendCodeSchema = Joi.object({
    phone_number: phoneNumberValidation,
    type: Joi.string()
        .valid('registration', 'password_reset')
        .default('registration')
        .messages({
            'any.only': 'Type must be either registration or password_reset'
        })
});

// Forgot password schema
const forgotPasswordSchema = Joi.object({
    phone_number: phoneNumberValidation
});

// Reset password schema
const resetPasswordSchema = Joi.object({
    phone_number: phoneNumberValidation,
    verification_code: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': 'Verification code must be 6 digits',
            'string.pattern.base': 'Verification code must contain only numbers',
            'any.required': 'Verification code is required'
        }),
    new_password: Joi.string()
        .min(6)
        .max(50)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters long',
            'string.max': 'Password cannot exceed 50 characters',
            'any.required': 'New password is required'
        }),
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Password confirmation is required'
        })
});

// Change password schema (for authenticated users)
const changePasswordSchema = Joi.object({
    current_password: Joi.string()
        .required()
        .messages({
            'any.required': 'Current password is required'
        }),
    new_password: Joi.string()
        .min(6)
        .max(50)
        .required()
        .messages({
            'string.min': 'New password must be at least 6 characters long',
            'string.max': 'New password cannot exceed 50 characters',
            'any.required': 'New password is required'
        }),
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Password confirmation is required'
        })
});

// Update profile schema
const updateProfileSchema = Joi.object({
    first_name: Joi.string()
        .min(2)
        .max(50)
        .optional()
        .messages({
            'string.min': 'First name must be at least 2 characters long',
            'string.max': 'First name cannot exceed 50 characters'
        }),
    last_name: Joi.string()
        .min(2)
        .max(50)
        .optional()
        .messages({
            'string.min': 'Last name must be at least 2 characters long',
            'string.max': 'Last name cannot exceed 50 characters'
        }),
    email: Joi.string()
        .email()
        .optional()
        .messages({
            'string.email': 'Please provide a valid email address'
        })
});

// Admin activation schema
const activateUserSchema = Joi.object({
    user_id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'User ID must be a number',
            'number.integer': 'User ID must be an integer',
            'number.positive': 'User ID must be positive',
            'any.required': 'User ID is required'
        })
});

// Get users schema (for admin)
const getUsersSchema = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.base': 'Page must be a number',
            'number.integer': 'Page must be an integer',
            'number.min': 'Page must be at least 1'
        }),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
        .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),
    role: Joi.string()
        .valid('user', 'admin')
        .optional()
        .messages({
            'any.only': 'Role must be either user or admin'
        }),
    is_active: Joi.boolean()
        .optional(),
    is_phone_verified: Joi.boolean()
        .optional()
});

module.exports = {
    registerSchema,
    loginSchema,
    verifyPhoneSchema,
    resendCodeSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    updateProfileSchema,
    activateUserSchema,
    getUsersSchema
};