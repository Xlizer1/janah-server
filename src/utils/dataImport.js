const Papa = require("papaparse");
const ProductModel = require("../api/v1/products/model");
const CategoryModel = require("../api/v1/categories/model");
const fs = require("fs").promises;

class DataImporter {
  /**
   * Import products from CSV
   */
  static async importProductsFromCSV(filePath, options = {}) {
    try {
      const csvContent = await fs.readFile(filePath, "utf8");
      const { dryRun = false, skipErrors = false } = options;

      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) =>
          header.trim().toLowerCase().replace(/\s+/g, "_"),
      });

      if (parsed.errors.length > 0) {
        throw new Error(
          `CSV parsing errors: ${parsed.errors
            .map((e) => e.message)
            .join(", ")}`
        );
      }

      const results = {
        total: parsed.data.length,
        successful: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];

        try {
          // Map CSV columns to product fields
          const productData = {
            name: row.name || row.product_name,
            code: row.code || row.product_code, // Add code support
            description: row.description,
            price: parseFloat(row.price),
            stock_quantity: parseInt(row.stock_quantity) || 0,
            category_id: parseInt(row.category_id),
            weight: row.weight ? parseFloat(row.weight) : null,
            dimensions: row.dimensions,
            is_featured: row.is_featured === "true" || row.is_featured === "1",
            image_url: row.image_url,
          };

          // Validate required fields
          if (!productData.name) {
            throw new Error("Product name is required");
          }

          if (!productData.code) {
            throw new Error("Product code is required");
          }

          // Validate code format
          if (!/^[A-Z0-9]+$/.test(productData.code)) {
            throw new Error(
              "Product code must contain only uppercase letters and numbers"
            );
          }

          if (!productData.price || productData.price <= 0) {
            throw new Error("Valid price is required");
          }

          // Validate category exists if provided
          if (productData.category_id) {
            // Note: In a real implementation, you might want to cache categories
            // to avoid repeated database calls
          }

          if (!dryRun) {
            await ProductModel.createProduct(productData);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: error.message,
          });

          if (!skipErrors) {
            throw new Error(`Row ${i + 1}: ${error.message}`);
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Import categories from CSV
   */
  static async importCategoriesFromCSV(filePath, options = {}) {
    try {
      const csvContent = await fs.readFile(filePath, "utf8");
      const { dryRun = false, skipErrors = false } = options;

      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) =>
          header.trim().toLowerCase().replace(/\s+/g, "_"),
      });

      const results = {
        total: parsed.data.length,
        successful: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];

        try {
          const categoryData = {
            name: row.name,
            code: row.code,
            description: row.description,
            image_url: row.image_url,
            sort_order: parseInt(row.sort_order) || 0,
            is_active: row.is_active !== "false" && row.is_active !== "0",
          };

          // Validate required fields
          if (!categoryData.name) {
            throw new Error("Category name is required");
          }

          if (!categoryData.code) {
            throw new Error("Category code is required");
          }

          // Validate code format
          if (!/^[A-Z0-9]+$/.test(categoryData.code)) {
            throw new Error(
              "Category code must contain only uppercase letters and numbers"
            );
          }

          if (!dryRun) {
            await CategoryModel.createCategory(categoryData);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: error.message,
          });

          if (!skipErrors) {
            throw new Error(`Row ${i + 1}: ${error.message}`);
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Category import failed: ${error.message}`);
    }
  }

  /**
   * Export products to CSV
   */
  static async exportProductsToCSV(options = {}) {
    try {
      const { categoryId, isActive = true } = options;

      const productsResult = await ProductModel.getAllProducts({
        categoryId,
        isActive,
        limit: 10000, // Large limit to get all products
      });

      const csvData = productsResult.products.map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code, // Include product code
        slug: product.slug,
        description: product.description,
        price: product.price,
        stock_quantity: product.stock_quantity,
        category_id: product.category_id,
        category_name: product.category_name,
        category_code: product.category_code, // Include category code
        full_code: product.full_code, // Include full code
        weight: product.weight,
        dimensions: product.dimensions,
        is_active: product.is_active,
        is_featured: product.is_featured,
        image_url: product.image_url,
        created_at: product.created_at,
      }));

      const csv = Papa.unparse(csvData);
      return csv;
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Export categories to CSV
   */
  static async exportCategoriesToCSV(options = {}) {
    try {
      const { includeInactive = false } = options;

      const categoriesResult = await CategoryModel.getAllCategories({
        includeInactive,
        limit: 1000,
      });

      const csvData = categoriesResult.categories.map((category) => ({
        id: category.id,
        name: category.name,
        code: category.code,
        slug: category.slug,
        description: category.description,
        image_url: category.image_url,
        sort_order: category.sort_order,
        is_active: category.is_active,
        created_at: category.created_at,
      }));

      const csv = Papa.unparse(csvData);
      return csv;
    } catch (error) {
      throw new Error(`Category export failed: ${error.message}`);
    }
  }

  /**
   * Generate sample CSV template for products
   */
  static generateProductCSVTemplate() {
    const sampleData = [
      {
        name: "Sample Product 1",
        code: "SP001",
        description: "This is a sample product description",
        price: 99.99,
        stock_quantity: 50,
        category_id: 1,
        weight: 1.5,
        dimensions: "10x5x3",
        is_featured: false,
        image_url: "https://example.com/image1.jpg",
      },
      {
        name: "Sample Product 2",
        code: "SP002",
        description: "Another sample product",
        price: 149.99,
        stock_quantity: 25,
        category_id: 2,
        weight: 2.0,
        dimensions: "15x8x4",
        is_featured: true,
        image_url: "https://example.com/image2.jpg",
      },
    ];

    return Papa.unparse(sampleData);
  }

  /**
   * Generate sample CSV template for categories
   */
  static generateCategoryCSVTemplate() {
    const sampleData = [
      {
        name: "Electronics",
        code: "ELEC",
        description: "Electronic devices and accessories",
        image_url: "https://example.com/electronics.jpg",
        sort_order: 1,
        is_active: true,
      },
      {
        name: "Clothing",
        code: "CLOTH",
        description: "Fashion and apparel",
        image_url: "https://example.com/clothing.jpg",
        sort_order: 2,
        is_active: true,
      },
    ];

    return Papa.unparse(sampleData);
  }
}

module.exports = { DataImporter };
