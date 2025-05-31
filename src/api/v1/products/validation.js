const Joi = require("joi");

const getProductsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  category_id: Joi.number().integer().positive().optional(),
  category: Joi.string().optional(), // For backward compatibility
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
  search: Joi.string().min(1).max(100).optional(),
  is_featured: Joi.boolean().optional(),
  category_slug: Joi.string().optional(),
  sort_by: Joi.string()
    .valid("name", "price", "created_at", "stock_quantity")
    .optional(),
  sort_order: Joi.string().valid("ASC", "DESC", "asc", "desc").optional(),
  is_active: Joi.boolean().optional(),
});

const searchProductsSchema = Joi.object({
  q: Joi.string().min(2).max(100).required().messages({
    "string.min": "Search term must be at least 2 characters long",
    "string.max": "Search term cannot exceed 100 characters",
    "any.required": "Search term is required",
  }),
  sort_by: Joi.string()
    .valid("name", "price", "created_at", "relevance")
    .optional(),
  sort_order: Joi.string().valid("ASC", "DESC", "asc", "desc").optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category_id: Joi.number().integer().positive().optional(),
});

const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  slug: Joi.string().min(2).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  price: Joi.number().positive().precision(2).required(),
  stock_quantity: Joi.number().integer().min(0).default(0),
  category_id: Joi.number().integer().positive().optional(),
  sku: Joi.string().max(100).optional(),
  weight: Joi.number().positive().optional(),
  dimensions: Joi.string().max(100).optional(),
  is_featured: Joi.boolean().default(false),
  image_url: Joi.string().uri().max(500).optional(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  slug: Joi.string().min(2).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  price: Joi.number().positive().precision(2).optional(),
  stock_quantity: Joi.number().integer().min(0).optional(),
  category_id: Joi.number().integer().positive().allow(null).optional(),
  sku: Joi.string().max(100).optional(),
  weight: Joi.number().positive().allow(null).optional(),
  dimensions: Joi.string().max(100).allow(null).optional(),
  is_featured: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  image_url: Joi.string().uri().max(500).allow(null).optional(),
});

const updateStockSchema = Joi.object({
  stock_quantity: Joi.number().integer().min(0).required().messages({
    "number.base": "Stock quantity must be a number",
    "number.integer": "Stock quantity must be an integer",
    "number.min": "Stock quantity cannot be negative",
    "any.required": "Stock quantity is required",
  }),
});

module.exports = {
  getProductsSchema,
  searchProductsSchema,
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
};
