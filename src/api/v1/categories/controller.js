const CategoryModel = require("./model");
const {
  NotFoundError,
  ConflictError,
  ValidationError,
} = require("../../../middleware/errorHandler");
const { FileUploadService } = require("../../../middleware/multer");

class CategoryController {
  /**
   * Get all categories
   */
  static async getAllCategories(req, res) {
    try {
      const { page, limit, include_inactive } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        includeInactive: include_inactive === "true",
      };

      const result = await CategoryModel.getAllCategories(options);

      // Convert file paths to URLs
      result.categories = result.categories.map((category) => ({
        ...category,
        image_url: category.image_url
          ? FileUploadService.getFileUrl(req, category.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: "Categories retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get categories with product counts (for frontend)
   */
  static async getCategoriesWithCounts(req, res) {
    try {
      const includeEmpty = req.query.include_empty === "true";
      const categories = await CategoryModel.getAllCategoriesWithProductCounts(
        includeEmpty
      );

      // Convert file paths to URLs
      const categoriesWithUrls = categories.map((category) => ({
        ...category,
        image_url: category.image_url
          ? FileUploadService.getFileUrl(req, category.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: "Categories with product counts retrieved successfully",
        data: { categories: categoriesWithUrls },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category by ID or slug
   */
  static async getCategory(req, res) {
    try {
      const { identifier } = req.params;

      // Check if identifier is numeric (ID) or string (slug)
      const isNumeric = /^\d+$/.test(identifier);
      const category = isNumeric
        ? await CategoryModel.findById(identifier)
        : await CategoryModel.findBySlug(identifier);

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      // Get category with product count
      const categoryWithCount = await CategoryModel.getCategoryWithProductCount(
        category.id
      );

      // Convert file path to URL
      categoryWithCount.image_url = categoryWithCount.image_url
        ? FileUploadService.getFileUrl(req, categoryWithCount.image_url)
        : null;

      res.json({
        status: true,
        message: "Category retrieved successfully",
        data: { category: categoryWithCount },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category options for dropdowns
   */
  static async getCategoryOptions(req, res) {
    try {
      const categories = await CategoryModel.getCategoryOptions();

      // Convert file paths to URLs
      const categoriesWithUrls = categories.map((category) => ({
        ...category,
        image_url: category.image_url
          ? FileUploadService.getFileUrl(req, category.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: "Category options retrieved successfully",
        data: { categories: categoriesWithUrls },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search categories
   */
  static async searchCategories(req, res) {
    try {
      const { q: searchTerm } = req.query;

      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new ValidationError(
          "Search term must be at least 2 characters long"
        );
      }

      const categories = await CategoryModel.searchCategories(
        searchTerm.trim()
      );

      // Convert file paths to URLs
      const categoriesWithUrls = categories.map((category) => ({
        ...category,
        image_url: category.image_url
          ? FileUploadService.getFileUrl(req, category.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: "Categories found",
        data: { categories: categoriesWithUrls },
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin-only methods

  /**
   * Create new category (Admin only)
   */
  static async createCategory(req, res) {
    try {
      const categoryData = { ...req.body };

      // Handle uploaded image
      if (req.file) {
        categoryData.image_url = req.file.path;
      }

      // Check if code already exists
      if (categoryData.code) {
        const existingByCode = await CategoryModel.findByCode(
          categoryData.code
        );
        if (existingByCode) {
          // Delete uploaded file if validation fails
          if (req.file) {
            await FileUploadService.deleteFile(req.file.path);
          }
          throw new ConflictError(
            `Category code '${categoryData.code}' already exists`
          );
        }
      }

      // Check if name/slug already exists
      const existingCategory = await CategoryModel.findBySlug(
        categoryData.slug || CategoryModel.generateSlug(categoryData.name)
      );

      if (existingCategory) {
        // Delete uploaded file if validation fails
        if (req.file) {
          await FileUploadService.deleteFile(req.file.path);
        }
        throw new ConflictError("A category with this name already exists");
      }

      const category = await CategoryModel.createCategory(categoryData);

      // Convert file path to URL for response
      category.image_url = category.image_url
        ? FileUploadService.getFileUrl(req, category.image_url)
        : null;

      res.status(201).json({
        status: true,
        message: "Category created successfully",
        data: { category },
      });
    } catch (error) {
      // Delete uploaded file if error occurs
      if (req.file) {
        await FileUploadService.deleteFile(req.file.path);
      }
      throw error;
    }
  }

  /**
   * Update category (Admin only)
   */
  static async updateCategory(req, res) {
    try {
      const { category_id } = req.params;
      const updateData = { ...req.body };

      const existingCategory = await CategoryModel.findById(category_id);
      if (!existingCategory) {
        // Delete uploaded file if category doesn't exist
        if (req.file) {
          await FileUploadService.deleteFile(req.file.path);
        }
        throw new NotFoundError("Category not found");
      }

      // Handle uploaded image
      if (req.file) {
        updateData.image_url = req.file.path;

        // Delete old image file if it exists and is a local file
        if (
          existingCategory.image_url &&
          !existingCategory.image_url.startsWith("http")
        ) {
          await FileUploadService.deleteFile(existingCategory.image_url);
        }
      }

      // Check for code conflicts if code is being updated
      if (updateData.code) {
        const codeExists = await CategoryModel.codeExists(
          updateData.code,
          category_id
        );
        if (codeExists) {
          // Delete uploaded file if validation fails
          if (req.file) {
            await FileUploadService.deleteFile(req.file.path);
          }
          throw new ConflictError(
            `Category code '${updateData.code}' already exists`
          );
        }
      }

      // Check for slug conflicts if slug is being updated
      if (updateData.slug) {
        const slugExists = await CategoryModel.slugExists(
          updateData.slug,
          category_id
        );
        if (slugExists) {
          // Delete uploaded file if validation fails
          if (req.file) {
            await FileUploadService.deleteFile(req.file.path);
          }
          throw new ConflictError("A category with this slug already exists");
        }
      }

      const updatedCategory = await CategoryModel.updateCategory(
        category_id,
        updateData
      );

      // Convert file path to URL for response
      updatedCategory.image_url = updatedCategory.image_url
        ? FileUploadService.getFileUrl(req, updatedCategory.image_url)
        : null;

      res.json({
        status: true,
        message: "Category updated successfully",
        data: { category: updatedCategory },
      });
    } catch (error) {
      // Delete uploaded file if error occurs
      if (req.file) {
        await FileUploadService.deleteFile(req.file.path);
      }
      throw error;
    }
  }

  /**
   * Delete category (Admin only)
   */
  static async deleteCategory(req, res) {
    try {
      const { category_id } = req.params;

      const existingCategory = await CategoryModel.findById(category_id);
      if (!existingCategory) {
        throw new NotFoundError("Category not found");
      }

      // Delete associated image file if it exists and is a local file
      if (
        existingCategory.image_url &&
        !existingCategory.image_url.startsWith("http")
      ) {
        await FileUploadService.deleteFile(existingCategory.image_url);
      }

      const deleted = await CategoryModel.deleteCategory(category_id);
      if (!deleted) {
        throw new Error("Failed to delete category");
      }

      res.json({
        status: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update category sort orders (Admin only)
   */
  static async updateSortOrders(req, res) {
    try {
      const { categories } = req.body;

      await CategoryModel.updateSortOrders(categories);

      res.json({
        status: true,
        message: "Category sort orders updated successfully",
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category by code (Admin only)
   */
  static async getCategoryByCode(req, res) {
    try {
      const { code } = req.params;

      const category = await CategoryModel.findByCode(code);
      if (!category) {
        throw new NotFoundError("Category not found");
      }

      // Convert file path to URL
      category.image_url = category.image_url
        ? FileUploadService.getFileUrl(req, category.image_url)
        : null;

      res.json({
        status: true,
        message: "Category retrieved successfully",
        data: { category },
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CategoryController;
