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
        sortBy = "created_at",
        sortOrder = "DESC",
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
        whereConditions.push(
          "(p.name LIKE ? OR p.description LIKE ? OR p.code LIKE ? OR CONCAT(COALESCE(c.code, ''), p.code) LIKE ?)"
        );
        params.push(
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`
        );
      }

      if (isFeatured !== undefined) {
        whereConditions.push("p.is_featured = ?");
        params.push(isFeatured);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Validate and build ORDER BY clause
      const validSortFields = [
        "name",
        "price",
        "created_at",
        "stock_quantity",
        "id",
        "code",
        "full_code",
      ];
      const validSortOrders = ["ASC", "DESC"];

      const safeSortBy = validSortFields.includes(sortBy)
        ? sortBy
        : "created_at";
      const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      // Handle full_code sorting
      let orderByClause;
      if (safeSortBy === "full_code") {
        orderByClause = `ORDER BY CONCAT(COALESCE(c.code, ''), p.code) ${safeSortOrder}`;
      } else {
        orderByClause = `ORDER BY p.${safeSortBy} ${safeSortOrder}`;
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`;
      const countResult = await executeQuery(
        countSql,
        params,
        "Count Products"
      );
      const total = countResult[0].total;

      // Get products with category information and full code
      const sql = `
                SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.code as category_code, c.slug as category_slug,
                       CONCAT(COALESCE(c.code, ''), p.code) as full_code
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                ${whereClause}
                ${orderByClause}
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
                SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.code as category_code, c.slug as category_slug,
                       CONCAT(COALESCE(c.code, ''), p.code) as full_code
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
                SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.code as category_code, c.slug as category_slug,
                       CONCAT(COALESCE(c.code, ''), p.code) as full_code
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
   * Get product by code
   */
  static async findByCode(code) {
    try {
      const sql = `
                SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.code as category_code, c.slug as category_slug,
                       CONCAT(COALESCE(c.code, ''), p.code) as full_code
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.code = ?
            `;
      const result = await executeQuery(sql, [code], "Find Product By Code");
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get product by full code (category_code + product_code)
   */
  static async findByFullCode(fullCode) {
    try {
      const sql = `
                SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.weight, 
                       p.dimensions, p.is_active, p.is_featured, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.code as category_code, c.slug as category_slug,
                       CONCAT(COALESCE(c.code, ''), p.code) as full_code
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE CONCAT(COALESCE(c.code, ''), p.code) = ? AND p.is_active = true
            `;
      const result = await executeQuery(
        sql,
        [fullCode],
        "Find Product By Full Code"
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by full code: ${error.message}`,
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
                SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.code as category_code, c.slug as category_slug,
                       CONCAT(COALESCE(c.code, ''), p.code) as full_code
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_featured = true AND p.is_active = true
                ORDER BY p.created_at DESC
                LIMIT ?
            `;
      const result = await executeQuery(sql, [limit], "Get Featured Products");
      return {
        products: result,
        total: result.length,
      };
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
      const {
        limit = 20,
        isActive = true,
        sortBy = "name",
        sortOrder = "ASC",
        categoryId,
      } = options;

      let whereConditions = [
        "(p.name LIKE ? OR p.description LIKE ? OR p.code LIKE ? OR CONCAT(COALESCE(c.code, ''), p.code) LIKE ?)",
      ];
      let params = [
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
      ];

      if (isActive !== undefined) {
        whereConditions.push("p.is_active = ?");
        params.push(isActive);
      }

      if (categoryId) {
        whereConditions.push("p.category_id = ?");
        params.push(categoryId);
      }

      const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

      // Validate sort parameters
      const validSortFields = [
        "name",
        "price",
        "created_at",
        "relevance",
        "full_code",
      ];
      const validSortOrders = ["ASC", "DESC"];

      let safeSortBy = validSortFields.includes(sortBy) ? sortBy : "name";
      const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "ASC";

      // Handle relevance and full_code sorting
      let orderByClause;
      if (safeSortBy === "relevance") {
        orderByClause = `ORDER BY 
          CASE 
            WHEN p.name LIKE ? THEN 1
            WHEN p.name LIKE ? THEN 2
            WHEN p.description LIKE ? THEN 3
            WHEN CONCAT(COALESCE(c.code, ''), p.code) LIKE ? THEN 4
            ELSE 5
          END, p.name ASC`;
        params.push(
          `${searchTerm}`,
          `%${searchTerm}%`,
          `%${searchTerm}%`,
          `%${searchTerm}%`
        );
      } else if (safeSortBy === "full_code") {
        orderByClause = `ORDER BY CONCAT(COALESCE(c.code, ''), p.code) ${safeSortOrder}`;
      } else {
        orderByClause = `ORDER BY p.${safeSortBy} ${safeSortOrder}`;
      }

      const countSql = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`;
      const countParams = params.slice(0, whereConditions.length === 3 ? 7 : 6);
      const countResult = await executeQuery(
        countSql,
        countParams,
        "Count Search Products"
      );
      const total = countResult[0].total;

      const sql = `
                SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
                       p.stock_quantity, p.category_id, p.image_url, 
                       p.created_at, p.updated_at,
                       c.name as category_name, c.code as category_code, c.slug as category_slug,
                       CONCAT(COALESCE(c.code, ''), p.code) as full_code
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                ${whereClause}
                ${orderByClause}
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
                SELECT c.id, c.name, c.code, c.slug
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

      // Validate product code uniqueness within the same category
      if (productData.code && productData.category_id) {
        const existingProduct = await this.findProductByCodeAndCategory(
          productData.code,
          productData.category_id
        );
        if (existingProduct) {
          throw new Error(
            `Product code '${productData.code}' already exists in this category`
          );
        }
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
   * Find product by code and category
   */
  static async findProductByCodeAndCategory(code, categoryId) {
    try {
      const sql = `
                SELECT id FROM products 
                WHERE code = ? AND category_id = ?
            `;
      const result = await executeQuery(
        sql,
        [code, categoryId],
        "Find Product By Code And Category"
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by code and category: ${error.message}`,
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

      // Validate product code uniqueness within the same category if code or category is being updated
      if (updateData.code || updateData.category_id) {
        const currentProduct = await this.findById(id);
        if (!currentProduct) {
          throw new Error("Product not found");
        }

        const checkCode = updateData.code || currentProduct.code;
        const checkCategoryId =
          updateData.category_id || currentProduct.category_id;

        if (checkCode && checkCategoryId) {
          const existingProduct = await this.findProductByCodeAndCategory(
            checkCode,
            checkCategoryId
          );
          if (existingProduct && existingProduct.id !== parseInt(id)) {
            throw new Error(
              `Product code '${checkCode}' already exists in this category`
            );
          }
        }
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
}

module.exports = ProductModel;
