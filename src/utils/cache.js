const { CacheService } = require("../config/cache");

class CacheManager {
  static cache = new CacheService();

  // Cache key generators
  static keys = {
    categories: () => "categories:all",
    categoryOptions: () => "categories:options",
    categoryWithCount: (id) => `category:${id}:with-count`,
    topCategories: (limit) => `categories:top:${limit}`,
    productsByCategory: (categoryId, page, limit) =>
      `products:category:${categoryId}:${page}:${limit}`,
    featuredProducts: (limit) => `products:featured:${limit}`,
    product: (id) => `product:${id}`,
    productBySlug: (slug) => `product:slug:${slug}`,
    analytics: (type, params) => `analytics:${type}:${JSON.stringify(params)}`,
    searchSuggestions: (query) => `search:suggestions:${query.toLowerCase()}`,
  };

  // Cache wrapper for category operations
  static async getCategories() {
    const key = this.keys.categories();
    let categories = await this.cache.get(key);

    if (!categories) {
      const CategoryModel = require("../api/v1/categories/model");
      const result = await CategoryModel.getAllCategories();
      categories = result.categories;
      await this.cache.set(key, categories, 3600); // Cache for 1 hour
    }

    return categories;
  }

  // Cache wrapper for featured products
  static async getFeaturedProducts(limit = 10) {
    const key = this.keys.featuredProducts(limit);
    let products = await this.cache.get(key);

    if (!products) {
      const ProductModel = require("../api/v1/products/model");
      const result = await ProductModel.getFeaturedProducts(limit);
      products = result.products;
      await this.cache.set(key, products, 1800); // Cache for 30 minutes
    }

    return products;
  }

  // Cache invalidation methods
  static async invalidateCategory(categoryId) {
    const patterns = [
      this.keys.categories(),
      this.keys.categoryOptions(),
      this.keys.categoryWithCount(categoryId),
      this.keys.topCategories("*"),
    ];

    for (const pattern of patterns) {
      await this.cache.del(pattern);
    }
  }

  static async invalidateProduct(productId) {
    const patterns = [
      this.keys.product(productId),
      this.keys.featuredProducts("*"),
      "products:*", // Invalidate all product caches
    ];

    for (const pattern of patterns) {
      await this.cache.del(pattern);
    }
  }
}

module.exports = {
  CacheManager,
};
