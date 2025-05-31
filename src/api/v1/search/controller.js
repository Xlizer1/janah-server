class SearchController {
  /**
   * Global search across products and categories
   */
  static async globalSearch(req, res) {
    try {
      const { q: query, limit = 20 } = req.query;

      if (!query || query.trim().length < 2) {
        throw new ValidationError("Search query must be at least 2 characters");
      }

      const searchTerm = query.trim();

      // Search products
      const productsResult = await ProductModel.searchProducts(searchTerm, {
        limit: Math.floor(limit * 0.7), // 70% of results for products
        isActive: true,
      });

      // Search categories
      const categories = await CategoryModel.searchCategories(searchTerm);

      res.json({
        status: true,
        message: "Search completed",
        data: {
          query: searchTerm,
          products: {
            items: productsResult.products,
            total: productsResult.pagination.total,
          },
          categories: {
            items: categories.slice(0, Math.floor(limit * 0.3)), // 30% for categories
            total: categories.length,
          },
          total_results: productsResult.pagination.total + categories.length,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search suggestions/autocomplete
   */
  static async getSearchSuggestions(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || query.trim().length < 1) {
        return res.json({
          status: true,
          message: "Search suggestions",
          data: { suggestions: [] },
        });
      }

      const searchTerm = query.trim();

      // Get product name suggestions
      const sql = `
                SELECT DISTINCT name as suggestion, 'product' as type, slug
                FROM products 
                WHERE name LIKE ? AND is_active = true
                UNION
                SELECT DISTINCT name as suggestion, 'category' as type, slug
                FROM categories 
                WHERE name LIKE ? AND is_active = true
                ORDER BY suggestion
                LIMIT ?
            `;

      const suggestions = await executeQuery(
        sql,
        [`%${searchTerm}%`, `%${searchTerm}%`, limit],
        "Get Search Suggestions"
      );

      res.json({
        status: true,
        message: "Search suggestions retrieved",
        data: { suggestions },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Advanced product filters
   */
  static async getFilterOptions(req, res) {
    try {
      const { category_id } = req.query;

      let categoryFilter = "";
      let params = [];

      if (category_id) {
        categoryFilter = "WHERE category_id = ?";
        params = [category_id];
      }

      // Get price ranges
      const priceRangeSQL = `
                SELECT 
                    MIN(price) as min_price,
                    MAX(price) as max_price,
                    AVG(price) as avg_price
                FROM products 
                WHERE is_active = true ${
                  category_id ? "AND category_id = ?" : ""
                }
            `;

      const priceRanges = await executeQuery(
        priceRangeSQL,
        params,
        "Get Price Ranges"
      );

      // Get available categories
      const categoriesSQL = `
                SELECT c.id, c.name, c.slug, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.is_active = true
                GROUP BY c.id, c.name, c.slug
                HAVING product_count > 0
                ORDER BY c.sort_order, c.name
            `;

      const categories = await executeQuery(
        categoriesSQL,
        [],
        "Get Filter Categories"
      );

      // Get feature flags
      const featuresSQL = `
                SELECT 
                    COUNT(CASE WHEN is_featured = true THEN 1 END) as featured_count,
                    COUNT(*) as total_count
                FROM products 
                WHERE is_active = true ${
                  category_id ? "AND category_id = ?" : ""
                }
            `;

      const features = await executeQuery(
        featuresSQL,
        params,
        "Get Feature Stats"
      );

      res.json({
        status: true,
        message: "Filter options retrieved",
        data: {
          price_range: priceRanges[0],
          categories,
          features: features[0],
          sort_options: [
            { value: "name_asc", label: "Name A-Z" },
            { value: "name_desc", label: "Name Z-A" },
            { value: "price_asc", label: "Price Low to High" },
            { value: "price_desc", label: "Price High to Low" },
            { value: "created_at_desc", label: "Newest First" },
            { value: "created_at_asc", label: "Oldest First" },
          ],
        },
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = { SearchController };
