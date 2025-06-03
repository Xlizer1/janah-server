const OrderModel = require("./model");
const ProductModel = require("../products/model");
const TwilioService = require("../../../services/twilio");
const {
  NotFoundError,
  BusinessLogicError,
  ValidationError,
} = require("../../../middleware/errorHandler");

class OrderController {
  /**
   * Create a new order (for authenticated users)
   */
  static async createOrder(req, res) {
    try {
      const { delivery_address, delivery_notes, items } = req.body;
      const userId = req.user.id;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ValidationError("Order must contain at least one item");
      }

      // Validate and prepare order items
      const orderItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const { product_id, quantity } = item;

        if (!product_id || !quantity || quantity <= 0) {
          throw new ValidationError("Invalid product or quantity");
        }

        // Get product details
        const product = await ProductModel.findById(product_id);
        if (!product) {
          throw new NotFoundError(`Product with ID ${product_id} not found`);
        }

        if (!product.is_active) {
          throw new BusinessLogicError(
            `Product "${product.name}" is not available`
          );
        }

        if (product.stock_quantity < quantity) {
          throw new BusinessLogicError(
            `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, Requested: ${quantity}`
          );
        }

        const itemTotal = product.price * quantity;
        totalAmount += itemTotal;

        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          product_code: product.code,
          category_code: product.category_code,
          full_code: product.full_code,
          price: product.price,
          quantity: quantity,
        });
      }

      // Prepare order data
      const orderData = {
        user_id: userId,
        customer_name: `${req.user.first_name} ${req.user.last_name}`.trim(),
        customer_phone: req.user.phone_number,
        delivery_address,
        delivery_notes: delivery_notes || null,
      };

      // Create order
      const order = await OrderModel.createOrder(orderData, orderItems);

      // Send SMS notification to customer
      try {
        await TwilioService.sendSMS(
          req.user.phone_number,
          `Order confirmed! Your order #${order.order_number} has been received and is being processed. Total: ${order.total_amount} IQD. We'll notify you when it's ready for shipment.`
        );
      } catch (smsError) {
        console.error("Failed to send order confirmation SMS:", smsError);
        // Don't fail the order creation if SMS fails
      }

      res.status(201).json({
        status: true,
        message: "Order created successfully",
        data: { order },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's orders
   */
  static async getUserOrders(req, res) {
    try {
      const { page, limit, status } = req.query;
      const userId = req.user.id;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        status,
      };

      const result = await OrderModel.getUserOrders(userId, options);

      res.json({
        status: true,
        message: "Orders retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order by ID (for users - only their own orders)
   */
  static async getUserOrder(req, res) {
    try {
      const { order_id } = req.params;
      const userId = req.user.id;

      const order = await OrderModel.findById(order_id);
      if (!order) {
        throw new NotFoundError("Order not found");
      }

      // Users can only view their own orders
      if (order.user_id !== userId) {
        throw new NotFoundError("Order not found");
      }

      res.json({
        status: true,
        message: "Order retrieved successfully",
        data: { order },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order by order number (for users)
   */
  static async getUserOrderByNumber(req, res) {
    try {
      const { order_number } = req.params;
      const userId = req.user.id;

      const order = await OrderModel.findByOrderNumber(order_number);
      if (!order) {
        throw new NotFoundError("Order not found");
      }

      // Users can only view their own orders
      if (order.user_id !== userId) {
        throw new NotFoundError("Order not found");
      }

      res.json({
        status: true,
        message: "Order retrieved successfully",
        data: { order },
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin-only methods

  /**
   * Get all orders (Admin only)
   */
  static async getAllOrders(req, res) {
    try {
      const { page, limit, status, user_id, start_date, end_date, search } =
        req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        status,
        userId: user_id ? parseInt(user_id) : undefined,
        startDate: start_date,
        endDate: end_date,
        searchTerm: search,
      };

      const result = await OrderModel.getAllOrders(options);

      res.json({
        status: true,
        message: "Orders retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order by ID (Admin only)
   */
  static async getOrderById(req, res) {
    try {
      const { order_id } = req.params;

      const order = await OrderModel.findById(order_id);
      if (!order) {
        throw new NotFoundError("Order not found");
      }

      // Get status history
      const statusHistory = await OrderModel.getOrderStatusHistory(order_id);
      order.status_history = statusHistory;

      res.json({
        status: true,
        message: "Order retrieved successfully",
        data: { order },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update order status (Admin only)
   */
  static async updateOrderStatus(req, res) {
    try {
      const { order_id } = req.params;
      const { status, notes } = req.body;
      const adminId = req.user.id;

      // Validate status
      const validStatuses = Object.values(OrderModel.ORDER_STATUSES);
      if (!validStatuses.includes(status)) {
        throw new ValidationError(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`
        );
      }

      const order = await OrderModel.findById(order_id);
      if (!order) {
        throw new NotFoundError("Order not found");
      }

      // Check if status transition is valid
      const currentStatus = order.status;
      if (currentStatus === status) {
        throw new BusinessLogicError(`Order is already in ${status} status`);
      }

      // Update status
      const updatedOrder = await OrderModel.updateOrderStatus(
        order_id,
        status,
        adminId,
        notes
      );

      // Send SMS notification to customer for important status changes
      try {
        let message = null;
        switch (status) {
          case OrderModel.ORDER_STATUSES.CONFIRMED:
            message = `Your order #${order.order_number} has been confirmed and is being prepared for shipment.`;
            break;
          case OrderModel.ORDER_STATUSES.READY_TO_SHIP:
            message = `Great news! Your order #${order.order_number} is ready for shipment and will be sent out soon.`;
            break;
          case OrderModel.ORDER_STATUSES.SHIPPED:
            message = `Your order #${order.order_number} has been shipped! Please prepare the cash payment upon delivery.`;
            break;
          case OrderModel.ORDER_STATUSES.DELIVERED:
            message = `Your order #${order.order_number} has been delivered successfully. Thank you for your business!`;
            break;
          case OrderModel.ORDER_STATUSES.CANCELLED:
            message = `Your order #${order.order_number} has been cancelled. ${
              notes ? `Reason: ${notes}` : ""
            }`;
            break;
        }

        if (message) {
          await TwilioService.sendSMS(order.customer_phone, message);
        }
      } catch (smsError) {
        console.error("Failed to send status update SMS:", smsError);
        // Don't fail the status update if SMS fails
      }

      res.json({
        status: true,
        message: `Order status updated to ${status}`,
        data: { order: updatedOrder },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel order (Admin only)
   */
  static async cancelOrder(req, res) {
    try {
      const { order_id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      const order = await OrderModel.findById(order_id);
      if (!order) {
        throw new NotFoundError("Order not found");
      }

      if (order.status === OrderModel.ORDER_STATUSES.CANCELLED) {
        throw new BusinessLogicError("Order is already cancelled");
      }

      if (order.status === OrderModel.ORDER_STATUSES.DELIVERED) {
        throw new BusinessLogicError("Cannot cancel delivered order");
      }

      const updatedOrder = await OrderModel.cancelOrder(
        order_id,
        adminId,
        reason
      );

      res.json({
        status: true,
        message: "Order cancelled successfully",
        data: { order: updatedOrder },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get orders by status (Admin only)
   */
  static async getOrdersByStatus(req, res) {
    try {
      const { status } = req.params;
      const { page, limit } = req.query;

      const validStatuses = Object.values(OrderModel.ORDER_STATUSES);
      if (!validStatuses.includes(status)) {
        throw new ValidationError(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`
        );
      }

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
      };

      const result = await OrderModel.getOrdersByStatus(status, options);

      res.json({
        status: true,
        message: `Orders with status '${status}' retrieved successfully`,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order statistics (Admin only)
   */
  static async getOrderStatistics(req, res) {
    try {
      const { start_date, end_date } = req.query;

      const options = {};
      if (start_date) options.startDate = start_date;
      if (end_date) options.endDate = end_date;

      const stats = await OrderModel.getOrderStatistics(options);

      res.json({
        status: true,
        message: "Order statistics retrieved successfully",
        data: { statistics: stats },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order status history (Admin only)
   */
  static async getOrderStatusHistory(req, res) {
    try {
      const { order_id } = req.params;

      const order = await OrderModel.findById(order_id);
      if (!order) {
        throw new NotFoundError("Order not found");
      }

      const history = await OrderModel.getOrderStatusHistory(order_id);

      res.json({
        status: true,
        message: "Order status history retrieved successfully",
        data: { history },
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = OrderController;
