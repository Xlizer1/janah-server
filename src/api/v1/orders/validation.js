const Joi = require("joi");

// Create order validation schema
const createOrderSchema = Joi.object({
  delivery_address: Joi.string().min(10).max(500).required().messages({
    "string.min": "Delivery address must be at least 10 characters long",
    "string.max": "Delivery address cannot exceed 500 characters",
    "any.required": "Delivery address is required",
  }),
  delivery_notes: Joi.string().max(500).optional().messages({
    "string.max": "Delivery notes cannot exceed 500 characters",
  }),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().positive().required().messages({
          "number.base": "Product ID must be a number",
          "number.integer": "Product ID must be an integer",
          "number.positive": "Product ID must be positive",
          "any.required": "Product ID is required",
        }),
        quantity: Joi.number().integer().min(1).max(1000).required().messages({
          "number.base": "Quantity must be a number",
          "number.integer": "Quantity must be an integer",
          "number.min": "Quantity must be at least 1",
          "number.max": "Quantity cannot exceed 1000",
          "any.required": "Quantity is required",
        }),
      })
    )
    .min(1)
    .max(50)
    .required()
    .messages({
      "array.min": "Order must contain at least one item",
      "array.max": "Order cannot contain more than 50 items",
      "any.required": "Items are required",
    }),
});

// Update order status validation schema
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      "pending",
      "confirmed",
      "preparing",
      "ready_to_ship",
      "shipped",
      "delivered",
      "cancelled"
    )
    .required()
    .messages({
      "any.only":
        "Status must be one of: pending, confirmed, preparing, ready_to_ship, shipped, delivered, cancelled",
      "any.required": "Status is required",
    }),
  notes: Joi.string().max(1000).optional().messages({
    "string.max": "Notes cannot exceed 1000 characters",
  }),
  order_id: Joi.number().optional(),
});

// Cancel order validation schema
const cancelOrderSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required().messages({
    "string.min": "Cancellation reason must be at least 5 characters long",
    "string.max": "Cancellation reason cannot exceed 500 characters",
    "any.required": "Cancellation reason is required",
  }),
});

// Get orders validation schema (for query parameters)
const getOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  status: Joi.string()
    .valid(
      "pending",
      "confirmed",
      "preparing",
      "ready_to_ship",
      "shipped",
      "delivered",
      "cancelled"
    )
    .optional()
    .messages({
      "any.only":
        "Status must be one of: pending, confirmed, preparing, ready_to_ship, shipped, delivered, cancelled",
    }),
  user_id: Joi.number().integer().positive().optional().messages({
    "number.base": "User ID must be a number",
    "number.integer": "User ID must be an integer",
    "number.positive": "User ID must be positive",
  }),
  start_date: Joi.date().optional().messages({
    "date.base": "Start date must be a valid date",
  }),
  end_date: Joi.date().min(Joi.ref("start_date")).optional().messages({
    "date.base": "End date must be a valid date",
    "date.min": "End date must be after start date",
  }),
  search: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Search term must be at least 2 characters long",
    "string.max": "Search term cannot exceed 100 characters",
  }),
});

// Order statistics validation schema
const orderStatisticsSchema = Joi.object({
  start_date: Joi.date().optional().messages({
    "date.base": "Start date must be a valid date",
  }),
  end_date: Joi.date().min(Joi.ref("start_date")).optional().messages({
    "date.base": "End date must be a valid date",
    "date.min": "End date must be after start date",
  }),
});

module.exports = {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  getOrdersSchema,
  orderStatisticsSchema,
};
