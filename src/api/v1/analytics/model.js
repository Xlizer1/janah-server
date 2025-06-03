const { executeQuery } = require("../../../helpers/db");
const { DatabaseError } = require("../../../errors/customErrors");

class AnalyticsModel {
  /**
   * Get category performance metrics
   */
  static async getCategoryAnalytics(options = {}) {
    try {
      const { startDate, endDate } = options;

      let dateFilter = "";
      let params = [];

      if (startDate && endDate) {
        dateFilter = "AND p.created_at BETWEEN ? AND ?";
        params = [startDate, endDate];
      }

      const sql = `
                SELECT 
                    c.id,
                    c.name as category_name,
                    c.code as category_code,
                    c.slug,
                    COUNT(p.id) as total_products,
                    COUNT(CASE WHEN p.is_active = true THEN 1 END) as active_products,
                    COUNT(CASE WHEN p.is_featured = true THEN 1 END) as featured_products,
                    AVG(p.price) as avg_price,
                    MIN(p.price) as min_price,
                    MAX(p.price) as max_price,
                    SUM(p.stock_quantity) as total_stock,
                    AVG(p.stock_quantity) as avg_stock
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id ${dateFilter}
                WHERE c.is_active = true
                GROUP BY c.id, c.name, c.code, c.slug
                ORDER BY total_products DESC
            `;

      const result = await executeQuery(sql, params, "Get Category Analytics");
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting category analytics: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get top categories by product count
   */
  static async getTopCategories(limit = 10) {
    try {
      const sql = `
                SELECT 
                    c.id,
                    c.name,
                    c.code,
                    c.slug,
                    COUNT(p.id) as product_count,
                    c.sort_order
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.is_active = true
                GROUP BY c.id, c.name, c.code, c.slug, c.sort_order
                ORDER BY product_count DESC, c.sort_order ASC
                LIMIT ?
            `;

      const result = await executeQuery(sql, [limit], "Get Top Categories");
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting top categories: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get inventory status by category
   */
  static async getInventoryByCategory() {
    try {
      const sql = `
                SELECT 
                    c.name as category_name,
                    c.code as category_code,
                    COUNT(p.id) as total_products,
                    COUNT(CASE WHEN p.stock_quantity > 0 THEN 1 END) as in_stock,
                    COUNT(CASE WHEN p.stock_quantity = 0 THEN 1 END) as out_of_stock,
                    COUNT(CASE WHEN p.stock_quantity < 5 THEN 1 END) as low_stock,
                    SUM(p.stock_quantity) as total_inventory,
                    ROUND(AVG(p.stock_quantity), 2) as avg_stock_per_product
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.is_active = true
                GROUP BY c.id, c.name, c.code
                ORDER BY total_inventory DESC
            `;

      const result = await executeQuery(sql, [], "Get Inventory By Category");
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting inventory by category: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get products needing attention (low stock, no category, etc.)
   */
  static async getProductsNeedingAttention() {
    try {
      const sql = `
                SELECT 
                    p.id,
                    p.name,
                    p.code as product_code,
                    p.slug,
                    p.stock_quantity,
                    p.category_id,
                    c.name as category_name,
                    c.code as category_code,
                    CONCAT(COALESCE(c.code, ''), p.code) as full_code,
                    CASE 
                        WHEN p.category_id IS NULL THEN 'No Category'
                        WHEN p.stock_quantity = 0 THEN 'Out of Stock'
                        WHEN p.stock_quantity < 5 THEN 'Low Stock'
                        WHEN p.price = 0 THEN 'No Price'
                        WHEN p.image_url IS NULL THEN 'No Image'
                        WHEN p.code = '' OR p.code IS NULL THEN 'No Product Code'
                        ELSE 'OK'
                    END as issue_type
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = true 
                AND (
                    p.category_id IS NULL 
                    OR p.stock_quantity < 5 
                    OR p.price = 0 
                    OR p.image_url IS NULL
                    OR p.code = '' 
                    OR p.code IS NULL
                )
                ORDER BY 
                    CASE 
                        WHEN p.stock_quantity = 0 THEN 1
                        WHEN p.category_id IS NULL THEN 2
                        WHEN p.code = '' OR p.code IS NULL THEN 3
                        WHEN p.stock_quantity < 5 THEN 4
                        WHEN p.price = 0 THEN 5
                        ELSE 6
                    END,
                    p.name
            `;

      const result = await executeQuery(
        sql,
        [],
        "Get Products Needing Attention"
      );
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting products needing attention: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get code usage statistics
   */
  static async getCodeStatistics() {
    try {
      const sql = `
                SELECT 
                    'categories' as type,
                    COUNT(*) as total_items,
                    COUNT(CASE WHEN code IS NOT NULL AND code != '' THEN 1 END) as items_with_codes,
                    ROUND(COUNT(CASE WHEN code IS NOT NULL AND code != '' THEN 1 END) * 100.0 / COUNT(*), 2) as code_coverage_percentage
                FROM categories
                WHERE is_active = true
                
                UNION ALL
                
                SELECT 
                    'products' as type,
                    COUNT(*) as total_items,
                    COUNT(CASE WHEN code IS NOT NULL AND code != '' THEN 1 END) as items_with_codes,
                    ROUND(COUNT(CASE WHEN code IS NOT NULL AND code != '' THEN 1 END) * 100.0 / COUNT(*), 2) as code_coverage_percentage
                FROM products
                WHERE is_active = true
            `;

      const result = await executeQuery(sql, [], "Get Code Statistics");
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting code statistics: ${error.message}`,
        error
      );
    }
  }

  // NEW: Order Analytics Methods

  /**
   * Get order analytics overview
   */
  static async getOrderAnalytics(options = {}) {
    try {
      const { startDate, endDate } = options;

      let dateFilter = "";
      let params = [];

      if (startDate && endDate) {
        dateFilter = "WHERE o.created_at BETWEEN ? AND ?";
        params = [startDate, endDate];
      }

      const sql = `
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
                    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
                    COUNT(CASE WHEN o.status = 'preparing' THEN 1 END) as preparing_orders,
                    COUNT(CASE WHEN o.status = 'ready_to_ship' THEN 1 END) as ready_to_ship_orders,
                    COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) as shipped_orders,
                    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders,
                    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
                    SUM(o.total_amount) as total_revenue,
                    AVG(o.total_amount) as avg_order_value,
                    COUNT(DISTINCT o.user_id) as unique_customers
                FROM orders o
                ${dateFilter}
            `;

      const result = await executeQuery(sql, params, "Get Order Analytics");
      return result[0];
    } catch (error) {
      throw new DatabaseError(
        `Error getting order analytics: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get daily order trends
   */
  static async getDailyOrderTrends(days = 30) {
    try {
      const sql = `
                SELECT 
                    DATE(created_at) as order_date,
                    COUNT(*) as order_count,
                    SUM(total_amount) as daily_revenue,
                    AVG(total_amount) as avg_order_value
                FROM orders
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(created_at)
                ORDER BY order_date DESC
            `;

      const result = await executeQuery(sql, [days], "Get Daily Order Trends");
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting daily order trends: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get top selling products (by order quantity)
   */
  static async getTopSellingProducts(options = {}) {
    try {
      const { limit = 10, startDate, endDate } = options;

      let dateFilter = "";
      let params = [];

      if (startDate && endDate) {
        dateFilter = "AND o.created_at BETWEEN ? AND ?";
        params = [startDate, endDate];
      }

      const sql = `
                SELECT 
                    oi.product_id,
                    oi.product_name,
                    oi.product_code,
                    oi.category_code,
                    oi.full_code,
                    SUM(oi.quantity) as total_quantity_sold,
                    COUNT(DISTINCT o.id) as order_count,
                    SUM(oi.subtotal) as total_revenue,
                    AVG(oi.price) as avg_price
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status NOT IN ('cancelled') ${dateFilter}
                GROUP BY oi.product_id, oi.product_name, oi.product_code, oi.category_code, oi.full_code
                ORDER BY total_quantity_sold DESC
                LIMIT ?
            `;

      params.push(limit);
      const result = await executeQuery(
        sql,
        params,
        "Get Top Selling Products"
      );
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting top selling products: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get top customers by order value
   */
  static async getTopCustomers(options = {}) {
    try {
      const { limit = 10, startDate, endDate } = options;

      let dateFilter = "";
      let params = [];

      if (startDate && endDate) {
        dateFilter = "AND o.created_at BETWEEN ? AND ?";
        params = [startDate, endDate];
      }

      const sql = `
                SELECT 
                    o.user_id,
                    o.customer_name,
                    o.customer_phone,
                    COUNT(o.id) as total_orders,
                    SUM(o.total_amount) as total_spent,
                    AVG(o.total_amount) as avg_order_value,
                    MAX(o.created_at) as last_order_date
                FROM orders o
                WHERE o.status NOT IN ('cancelled') ${dateFilter}
                GROUP BY o.user_id, o.customer_name, o.customer_phone
                ORDER BY total_spent DESC
                LIMIT ?
            `;

      params.push(limit);
      const result = await executeQuery(sql, params, "Get Top Customers");
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting top customers: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get order fulfillment metrics
   */
  static async getOrderFulfillmentMetrics(options = {}) {
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
                    AVG(TIMESTAMPDIFF(HOUR, created_at, confirmed_at)) as avg_confirmation_time_hours,
                    AVG(TIMESTAMPDIFF(HOUR, confirmed_at, shipped_at)) as avg_preparation_time_hours,
                    AVG(TIMESTAMPDIFF(HOUR, shipped_at, delivered_at)) as avg_delivery_time_hours,
                    AVG(TIMESTAMPDIFF(HOUR, created_at, delivered_at)) as avg_total_fulfillment_time_hours,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) / COUNT(*) * 100 as delivery_success_rate,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) / COUNT(*) * 100 as cancellation_rate
                FROM orders
                ${dateFilter}
            `;

      const result = await executeQuery(
        sql,
        params,
        "Get Order Fulfillment Metrics"
      );
      return result[0];
    } catch (error) {
      throw new DatabaseError(
        `Error getting order fulfillment metrics: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get comprehensive dashboard analytics
   */
  static async getDashboardAnalytics(options = {}) {
    try {
      const orderAnalytics = await this.getOrderAnalytics(options);
      const dailyTrends = await this.getDailyOrderTrends(7); // Last 7 days
      const topProducts = await this.getTopSellingProducts({
        limit: 5,
        ...options,
      });
      const topCustomers = await this.getTopCustomers({ limit: 5, ...options });
      const fulfillmentMetrics = await this.getOrderFulfillmentMetrics(options);

      return {
        order_overview: orderAnalytics,
        daily_trends: dailyTrends,
        top_products: topProducts,
        top_customers: topCustomers,
        fulfillment_metrics: fulfillmentMetrics,
      };
    } catch (error) {
      throw new DatabaseError(
        `Error getting dashboard analytics: ${error.message}`,
        error
      );
    }
  }
}

module.exports = {
  AnalyticsModel,
};
