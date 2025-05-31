const Joi = require('joi');

const getProductsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    category: Joi.string().optional(),
    min_price: Joi.number().min(0).optional(),
    max_price: Joi.number().min(0).optional(),
    search: Joi.string().min(1).max(100).optional()
});

const createProductSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    description: Joi.string().max(1000).optional(),
    price: Joi.number().positive().precision(2).required(),
    stock_quantity: Joi.number().integer().min(0).default(0),
    category: Joi.string().max(100).optional(),
    image_url: Joi.string().uri().max(500).optional()
});

const updateProductSchema = Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    description: Joi.string().max(1000).optional(),
    price: Joi.number().positive().precision(2).optional(),
    stock_quantity: Joi.number().integer().min(0).optional(),
    category: Joi.string().max(100).optional(),
    image_url: Joi.string().uri().max(500).optional(),
    is_active: Joi.boolean().optional()
});

module.exports = {
    getProductsSchema,
    createProductSchema,
    updateProductSchema
}