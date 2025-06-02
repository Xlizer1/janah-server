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
}

module.exports = {
  AnalyticsModel,
};
