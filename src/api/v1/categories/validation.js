const Joi = require("joi");

const getCategoriesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  include_inactive: Joi.boolean().default(false),
});

const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Category name must be at least 2 characters long",
    "string.max": "Category name cannot exceed 100 characters",
    "any.required": "Category name is required",
  }),
  code: Joi.string()
    .min(1)
    .max(20)
    .pattern(/^[A-Z0-9]+$/)
    .required()
    .messages({
      "string.min": "Category code must be at least 1 character long",
      "string.max": "Category code cannot exceed 20 characters",
      "string.pattern.base":
        "Category code must contain only uppercase letters and numbers",
      "any.required": "Category code is required",
    }),
  slug: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Slug must be at least 2 characters long",
    "string.max": "Slug cannot exceed 100 characters",
  }),
  description: Joi.string().max(1000).optional().messages({
    "string.max": "Description cannot exceed 1000 characters",
  }),
  image_url: Joi.string().uri().max(500).optional().messages({
    "string.uri": "Please provide a valid image URL",
    "string.max": "Image URL cannot exceed 500 characters",
  }),
  sort_order: Joi.number().integer().min(0).default(0).messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be 0 or greater",
  }),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  code: Joi.string()
    .min(1)
    .max(20)
    .pattern(/^[A-Z0-9]+$/)
    .optional()
    .messages({
      "string.min": "Category code must be at least 1 character long",
      "string.max": "Category code cannot exceed 20 characters",
      "string.pattern.base":
        "Category code must contain only uppercase letters and numbers",
    }),
  slug: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(1000).optional(),
  image_url: Joi.string().uri().max(500).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

const sortOrderSchema = Joi.object({
  categories: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().integer().positive().required(),
        sort_order: Joi.number().integer().min(0).required(),
      })
    )
    .min(1)
    .required(),
});

module.exports = {
  getCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
  sortOrderSchema,
};
