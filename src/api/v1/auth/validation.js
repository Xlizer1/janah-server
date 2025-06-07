const Joi = require("joi");

// Registration validation schema (REMOVED PHONE VERIFICATION)
const registerSchema = Joi.object({
  phone_number: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
      "any.required": "Phone number is required",
    }),
  password: Joi.string().min(6).max(50).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "string.max": "Password cannot exceed 50 characters",
    "any.required": "Password is required",
  }),
  confirm_password: Joi.string()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Password confirmation is required",
    }),
  first_name: Joi.string().min(2).max(50).required().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name cannot exceed 50 characters",
    "any.required": "First name is required",
  }),
  last_name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name cannot exceed 50 characters",
    "any.required": "Last name is required",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
});

// Account activation schema
const activateAccountSchema = Joi.object({
  phone_number: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
      "any.required": "Phone number is required",
    }),
  activation_code: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[A-Z0-9-]+$/)
    .required()
    .messages({
      "string.min": "Activation code must be at least 3 characters long",
      "string.max": "Activation code cannot exceed 50 characters",
      "string.pattern.base": "Invalid activation code format",
      "any.required": "Activation code is required",
    }),
});

// Login validation schema (SIMPLIFIED)
const loginSchema = Joi.object({
  phone_number: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
      "any.required": "Phone number is required",
    }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

// Generate activation code schema
const generateActivationCodeSchema = Joi.object({
  format: Joi.string()
    .valid("JANAH", "PREMIUM", "TRIAL", "CUSTOM")
    .default("JANAH")
    .messages({
      "any.only": "Format must be one of: JANAH, PREMIUM, TRIAL, CUSTOM",
    }),
  expires_in_days: Joi.number()
    .integer()
    .min(1)
    .max(3650) // Max 10 years
    .optional()
    .messages({
      "number.min": "Expiry must be at least 1 day",
      "number.max": "Expiry cannot exceed 3650 days (10 years)",
    }),
  notes: Joi.string().max(500).optional().messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
  custom_code: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[A-Z0-9-]+$/)
    .optional()
    .messages({
      "string.min": "Custom code must be at least 3 characters long",
      "string.max": "Custom code cannot exceed 50 characters",
      "string.pattern.base":
        "Custom code can only contain uppercase letters, numbers, and hyphens",
    }),
});

// Get activation codes schema
const getActivationCodesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  status: Joi.string().valid("used", "unused", "expired").optional().messages({
    "any.only": "Status must be one of: used, unused, expired",
  }),
  created_by: Joi.number().integer().positive().optional().messages({
    "number.base": "Created by must be a number",
    "number.integer": "Created by must be an integer",
    "number.positive": "Created by must be positive",
  }),
});

// Change password schema (UNCHANGED)
const changePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  new_password: Joi.string().min(6).max(50).required().messages({
    "string.min": "New password must be at least 6 characters long",
    "string.max": "New password cannot exceed 50 characters",
    "any.required": "New password is required",
  }),
  confirm_password: Joi.string()
    .valid(Joi.ref("new_password"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Password confirmation is required",
    }),
});

// Update profile schema (UNCHANGED)
const updateProfileSchema = Joi.object({
  first_name: Joi.string().min(2).max(50).optional().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name cannot exceed 50 characters",
  }),
  last_name: Joi.string().min(2).max(50).optional().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name cannot exceed 50 characters",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
});

module.exports = {
  registerSchema,
  activateAccountSchema,
  loginSchema,
  generateActivationCodeSchema,
  getActivationCodesSchema,
  changePasswordSchema,
  updateProfileSchema,
};
