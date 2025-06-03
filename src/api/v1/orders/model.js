const {
  executeQuery,
  executeTransaction,
  buildInsertQuery,
  buildUpdateQuery,
} = require("../../../helpers/db");
const { DatabaseError } = require("../../../errors/customErrors");

class OrderModel {
  /**
   * Order statuses
   */
  static ORDER_STATUSES = {
    PENDING: "pending",
    CONFIRMED: "confirmed", 
    PREPARING: "preparing",
    READY_TO_SHIP: "ready_to_ship",
    SHIPPED: "shipped",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
  };

  /**
   * Create a new order
   */
  static async createOrder(orderData, orderItems) {
    try {
      const queries = [];
      
      // Generate order number
      const orderNumber = await this.generateOrderNumber();
      
      // Calculate total amount
      const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Prepare order data
      const finalOrderData = {
        ...orderData,
        order_number: orderNumber,
        total_amount: totalAmount,
        status: this.ORDER_STATUSES.PENDING
      };
      
      // Insert order
      const orderQuery = buildInsertQuery("orders", finalOrderData);
      queries.push(orderQuery);
      
      // Execute transaction
      const results = await executeTransaction(queries, "Create Order");
      const orderId = results[0].insertId;
      
      // Insert order items
      const itemQueries = orderItems.map(item => {
        const itemData = {
          ...item,
          order_id: orderId,
          subtotal: item.price * item.quantity
        };
        return buildInsertQuery("order_items", itemData);
      });
      
      if (itemQueries.length > 0) {
        await executeTransaction(itemQueries, "Create Order Items");
      }
      
      // Return complete order
      return await this.findById(orderId);
    } catch (error) {
      throw new DatabaseError(`Error creating order: ${error.message}`, error);
    }
  }

  /**
   * Find order by ID with items
   */
  static async findById(id) {
    try {
      // Get order details
      const orderSql = `
        SELECT o.*, 
               u.first_name, u.last_name, u.phone_number as user_phone,
               ca.first_name as confirmed_admin_name, ca.last_name as confirmed_admin_lastname,
               sa.first_name as shipped_admin_name, sa.last_name as shipped_admin_lastname,
               da.first_name as delivered_admin_name, da.last_name as delivered_admin_lastname
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN users ca ON o.confirmed_by = ca.id
        LEFT JOIN users sa ON o.shipped_by = sa.id  
        LEFT JOIN users da ON o.delivered_by = da.id
        WHERE o.id = ?
      `;
      
      const orderResult = await executeQuery(orderSql, [id], "Find Order By ID");
      if (orderResult.length === 0) return null;
      
      const order = orderResult[0];
      
      // Get order items
      const itemsSql = `
        SELECT oi.*, p.name as current_product_name, p.image_url
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
        ORDER BY oi.id
      `;
      
      const items = await executeQuery(itemsSql, [id], "Find Order Items");
      order.items = items;
      
      return order;
    } catch (error) {
      throw new DatabaseError(`Error finding order: ${error.message}`, error);
    }
  }

  /**
   * Find order by order number
   */
  static async findByOrderNumber(orderNumber) {
    try {
      const sql = `
        SELECT o.*, 
               u.first_name, u.last_name, u.phone_number as user_phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.order_number = ?
      `;
      
      const result = await executeQuery(sql, [orderNumber], "Find Order By Number");
      if (result.length === 0) return null;
      
      const order = result[0];
      
      // Get order items
      const itemsSql = `
        SELECT oi.*, p.name as current_product_name, p.image_url
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `;
      
      const items = await executeQuery(itemsSql, [order.id], "Find Order Items By Number");
      order.items = items;
      
      return order;
    } catch (error) {
      throw new DatabaseError(`Error finding order by number: ${error.message}`, error);
    }
  }

  /**
   * Get all orders with pagination and filters
   */
  static async getAllOrders(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        userId,
        startDate,
        endDate,
        searchTerm
      } = options;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let params = [];

      if (status) {
        whereConditions.push("o.status = ?");
        params.push(status);
      }

      if (userId) {
        whereConditions.push("o.user_id = ?");
        params.push(userId);
      }

      if (startDate) {
        whereConditions.push("o.created_at >= ?");
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push("o.created_at <= ?");
        params.push(endDate);
      }

      if (searchTerm) {
        whereConditions.push("(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)");
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
      const countResult = await executeQuery(countSql, params, "Count Orders");
      const total = countResult[0].total;

      // Get orders
      const sql = `
        SELECT o.*, 
               u.first_name, u.last_name, u.phone_number as user_phone,
               COUNT(oi.id) as items_count
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        ${whereClause}
        GROUP BY o.id, u.first_name, u.last_name, u.phone_number
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const orders = await executeQuery(sql, [...params, limit, offset], "Get All Orders");

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new DatabaseError(`Error getting orders: ${error.message}`, error);
    }
  }

  /**
   * Get user's orders
   */
  static async getUserOrders(userId, options = {}) {
    try {
      const { page = 1, limit = 10, status } = options;
      
      return await this.getAllOrders({
        ...options,
        userId,
        page,
        limit,
        status
      });
    } catch (error) {
      throw new DatabaseError(`Error getting user orders: ${error.message}`, error);
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(orderId, newStatus, adminId, notes = null) {
    try {
      // Get current order
      const currentOrder = await this.findById(orderId);
      if (!currentOrder) {
        throw new Error("Order not found");
      }

      const oldStatus = currentOrder.status;
      
      // Prepare update data
      const updateData = { status: newStatus };
      
      // Set timestamp fields based on status
      switch (newStatus) {
        case this.ORDER_STATUSES.CONFIRMED:
          updateData.confirmed_at = new Date();
          updateData.confirmed_by = adminId;
          break;
        case this.ORDER_STATUSES.SHIPPED:
          updateData.shipped_at = new Date();
          updateData.shipped_by = adminId;
          break;
        case this.ORDER_STATUSES.DELIVERED:
          updateData.delivered_at = new Date();
          updateData.delivered_by = adminId;
          break;
      }

      if (notes) {
        updateData.admin_notes = notes;
      }

      // Update order and create history entry in transaction
      const queries = [
        buildUpdateQuery("orders", updateData, { id: orderId }),
        buildInsertQuery("order_status_history", {
          order_id: orderId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: adminId,
          notes: notes
        })
      ];

      await executeTransaction(queries, "Update Order Status");
      
      return await this.findById(orderId);
    } catch (error) {
      throw new DatabaseError(`Error updating order status: ${error.message}`, error);
    }
  }

  /**
   * Get order status history
   */
  static async getOrderStatusHistory(orderId) {
    try {
      const sql = `
        SELECT osh.*, 
               u.first_name, u.last_name
        FROM order_status_history osh
        LEFT JOIN users u ON osh.changed_by = u.id
        WHERE osh.order_id = ?
        ORDER BY osh.created_at DESC
      `;
      
      const result = await executeQuery(sql, [orderId], "Get Order Status History");
      return result;
    } catch (error) {
      throw new DatabaseError(`Error getting order status history: ${error.message}`, error);
    }
  }

  /**
   * Get order statistics
   */
  static async getOrderStatistics(options = {}) {
    try {
      const { startDate, endDate } = options;
      
      let dateFilter = "";
      let params = [];
      
      if (startDate && endDate) {
        dateFilter = "WHERE created_at BETWEEN ? AND ?";
        params = [startDate, endDate];
      }
      
      const sql = `
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
          COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders,
          COUNT(CASE WHEN status = 'ready_to_ship' THEN 1 END) as ready_to_ship_orders,
          COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as average_order_value
        FROM orders 
        ${dateFilter}
      `;
      
      const result = await executeQuery(sql, params, "Get Order Statistics");
      return result[0];
    } catch (error) {
      throw new DatabaseError(`Error getting order statistics: ${error.message}`, error);
    }
  }

  /**
   * Generate unique order number
   */
  static async generateOrderNumber() {
    try {
      const today = new Date();
      const year = today.getFullYear().toString().slice(-2);
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      const datePrefix = `${year}${month}${day}`;
      
      // Get today's order count
      const sql = `
        SELECT COUNT(*) as count 
        FROM orders 
        WHERE DATE(created_at) = CURDATE()
      `;
      
      const result = await executeQuery(sql, [], "Get Today Order Count");
      const todayCount = result[0].count + 1;
      
      const orderNumber = `ORD${datePrefix}${String(todayCount).padStart(3, '0')}`;
      
      // Check if number already exists (just in case)
      const existsResult = await executeQuery(
        "SELECT id FROM orders WHERE order_number = ?", 
        [orderNumber], 
        "Check Order Number Exists"
      );
      
      if (existsResult.length > 0) {
        // If exists, add random suffix
        return `${orderNumber}${Math.floor(Math.random() * 99)}`;
      }
      
      return orderNumber;
    } catch (error) {
      throw new DatabaseError(`Error generating order number: ${error.message}`, error);
    }
  }

  /**
   * Cancel order
   */
  static async cancelOrder(orderId, adminId, reason = null) {
    try {
      return await this.updateOrderStatus(
        orderId, 
        this.ORDER_STATUSES.CANCELLED, 
        adminId, 
        reason
      );
    } catch (error) {
      throw new DatabaseError(`Error cancelling order: ${error.message}`, error);
    }
  }

  /**
   * Get orders by status
   */
  static async getOrdersByStatus(status, options = {}) {
    try {
      return await this.getAllOrders({
        ...options,
        status
      });
    } catch (error) {
      throw new DatabaseError(`Error getting orders by status: ${error.message}`, error);
    }
  }
}

module.exports = OrderModel;