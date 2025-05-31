const {
  executeQuery,
  executeTransaction,
  buildInsertQuery,
  buildUpdateQuery,
} = require("../../../helpers/db");
const { DatabaseError } = require("../../../errors/customErrors");

export class ProductModel {
  /**
   * Get all products with pagination and filters
   */
  static async getAllProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        category,
        isActive = true,
        minPrice,
        maxPrice,
        search,
      } = options;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let params = [];

      // Only show active products to regular users
      if (isActive !== undefined) {
        whereConditions.push("is_active = ?");
        params.push(isActive);
      }

      if (category) {
        whereConditions.push("category = ?");
        params.push(category);
      }

      if (minPrice) {
        whereConditions.push("price >= ?");
        params.push(minPrice);
      }

      if (maxPrice) {
        whereConditions.push("price <= ?");
        params.push(maxPrice);
      }

      if (search) {
        whereConditions.push("(name LIKE ? OR description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;
      const countResult = await executeQuery(
        countSql,
        params,
        "Count Products"
      );
      const total = countResult[0].total;

      // Get products
      const sql = `
                SELECT id, name, description, price, stock_quantity, 
                       category, image_url, is_active, created_at, updated_at
                FROM products 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

      const products = await executeQuery(
        sql,
        [...params, limit, offset],
        "Get All Products"
      );

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Error getting products: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get product by ID
   */
  static async findById(id) {
    try {
      const sql = `
                SELECT id, name, description, price, stock_quantity, 
                       category, image_url, is_active, created_at, updated_at
                FROM products 
                WHERE id = ?
            `;
      const result = await executeQuery(sql, [id], "Find Product By ID");
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(`Error finding product: ${error.message}`, error);
    }
  }

  /**
   * Get all categories
   */
  static async getCategories() {
    try {
      const sql = `
                SELECT DISTINCT category 
                FROM products 
                WHERE category IS NOT NULL AND is_active = true
                ORDER BY category
            `;
      const result = await executeQuery(sql, [], "Get Categories");
      return result.map((row) => row.category);
    } catch (error) {
      throw new DatabaseError(
        `Error getting categories: ${error.message}`,
        error
      );
    }
  }

  /**
   * Create new product (admin only)
   */
  static async createProduct(productData) {
    try {
      const query = buildInsertQuery("products", productData);
      const result = await executeQuery(
        query.sql,
        query.params,
        "Create Product"
      );

      if (result.insertId) {
        return await this.findById(result.insertId);
      }
      throw new Error("Failed to create product");
    } catch (error) {
      throw new DatabaseError(
        `Error creating product: ${error.message}`,
        error
      );
    }
  }

  /**
   * Update product (admin only)
   */
  static async updateProduct(id, updateData) {
    try {
      const query = buildUpdateQuery("products", updateData, { id });
      await executeQuery(query.sql, query.params, "Update Product");
      return await this.findById(id);
    } catch (error) {
      throw new DatabaseError(
        `Error updating product: ${error.message}`,
        error
      );
    }
  }

  /**
   * Delete product (admin only)
   */
  static async deleteProduct(id) {
    try {
      const sql = "DELETE FROM products WHERE id = ?";
      const result = await executeQuery(sql, [id], "Delete Product");
      return result.affectedRows > 0;
    } catch (error) {
      throw new DatabaseError(
        `Error deleting product: ${error.message}`,
        error
      );
    }
  }
}
