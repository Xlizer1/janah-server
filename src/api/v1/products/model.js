const {
  executeQuery,
  buildInsertQuery,
  buildUpdateQuery,
} = require("../../../helpers/db");
const { DatabaseError } = require("../../../errors/customErrors");

class ProductModel {
  /**
   * Get all products with pagination and filters
   */
  static async getAllProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        categoryId,
        isActive = true,
        minPrice,
        maxPrice,
        search,
        isFeatured,
      } = options;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let params = [];

      // Only show active products to regular users
      if (isActive !== undefined) {
        whereConditions.push("p.is_active = ?");
        params.push(isActive);
      }

      if (categoryId) {
        whereConditions.push("p.category_id = ?");
        params.push(categoryId);
      }

      if (minPrice) {
        whereConditions.push("p.price >= ?");
        params.push(minPrice);
      }

      if (maxPrice) {
        whereConditions.push("p.price <= ?");
        params.push(maxPrice);
      }

      if (search) {
        whereConditions.push("(p.name LIKE ? OR p.description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      if (isFeatured !== undefined) {
        whereConditions.push("p.is_featured = ?");
        params.push(isFeatured);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
      const countResult = await executeQuery(
        countSql,
        params,
        "Count Products"
      );
      const total = countResult[0].total;

      // Get products with category information
      const sql = `
                SELECT p.id, p.name, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.sku, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                ${whereClause}
                ORDER BY p.created_at DESC
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
                SELECT p.id, p.name, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.sku, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.id = ?
            `;
      const result = await executeQuery(sql, [id], "Find Product By ID");
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(`Error finding product: ${error.message}`, error);
    }
  }

  /**
   * Get product by slug
   */
  static async findBySlug(slug) {
    try {
      const sql = `
                SELECT p.id, p.name, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.sku, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.slug = ? AND p.is_active = true
            `;
      const result = await executeQuery(sql, [slug], "Find Product By Slug");
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by slug: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get featured products
   */
  static async getFeaturedProducts(limit = 10) {
    try {
      const sql = `
                SELECT p.id, p.name, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.sku, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_featured = true AND p.is_active = true
                ORDER BY p.created_at DESC
                LIMIT ?
            `;
      const result = await executeQuery(sql, [limit], "Get Featured Products");
      return { products: result };
    } catch (error) {
      throw new DatabaseError(
        `Error getting featured products: ${error.message}`,
        error
      );
    }
  }

  /**
   * Search products
   */
  static async searchProducts(searchTerm, options = {}) {
    try {
      const { limit = 20, isActive = true } = options;

      let whereConditions = [
        "(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)",
      ];
      let params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

      if (isActive !== undefined) {
        whereConditions.push("p.is_active = ?");
        params.push(isActive);
      }

      const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

      const countSql = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
      const countResult = await executeQuery(
        countSql,
        params,
        "Count Search Products"
      );
      const total = countResult[0].total;

      const sql = `
                SELECT p.id, p.name, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                ${whereClause}
                ORDER BY p.name ASC
                LIMIT ?
            `;

      const products = await executeQuery(
        sql,
        [...params, limit],
        "Search Products"
      );

      return {
        products,
        pagination: {
          total,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Error searching products: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get all categories (for backward compatibility)
   */
  static async getCategories() {
    try {
      const sql = `
                SELECT c.id, c.name, c.slug
                FROM categories c
                WHERE c.is_active = true
                ORDER BY c.sort_order ASC, c.name ASC
            `;
      const result = await executeQuery(sql, [], "Get Categories");
      return result;
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
      // Generate slug if not provided
      if (!productData.slug && productData.name) {
        productData.slug = this.generateSlug(productData.name);
      }

      // Generate SKU if not provided
      if (!productData.sku) {
        productData.sku = await this.generateSKU();
      }

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
      // Generate slug if name is being updated and slug is not provided
      if (updateData.name && !updateData.slug) {
        updateData.slug = this.generateSlug(updateData.name);
      }

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

  /**
   * Generate URL-friendly slug from name
   */
  static generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Generate unique SKU
   */
  static async generateSKU() {
    try {
      const sql = "SELECT MAX(id) as max_id FROM products";
      const result = await executeQuery(sql, [], "Get Max Product ID");
      const nextId = (result[0].max_id || 0) + 1;
      return `PROD${String(nextId).padStart(6, "0")}`;
    } catch (error) {
      return `PROD${Date.now()}`;
    }
  }
}

module.exports = ProductModel;
