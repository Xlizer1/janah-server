const { executeQuery, executeTransaction, buildInsertQuery, buildUpdateQuery } = require('../../../helpers/db');
const { DatabaseError } = require('../../../errors/customErrors');

class CategoryModel {
    /**
     * Get all categories with pagination and filters
     */
    static async getAllCategories(options = {}) {
        try {
            const { 
                page = 1, 
                limit = 50, 
                isActive = true,
                includeInactive = false 
            } = options;
            
            const offset = (page - 1) * limit;
            let whereConditions = [];
            let params = [];
            
            // Filter by active status unless specifically including inactive
            if (!includeInactive) {
                whereConditions.push('is_active = ?');
                params.push(isActive);
            }
            
            const whereClause = whereConditions.length > 0 ? 
                `WHERE ${whereConditions.join(' AND ')}` : '';
            
            // Get total count
            const countSql = `SELECT COUNT(*) as total FROM categories ${whereClause}`;
            const countResult = await executeQuery(countSql, params, 'Count Categories');
            const total = countResult[0].total;
            
            // Get categories
            const sql = `
                SELECT id, name, slug, description, image_url, is_active, 
                       sort_order, created_at, updated_at
                FROM categories 
                ${whereClause}
                ORDER BY sort_order ASC, name ASC
                LIMIT ? OFFSET ?
            `;
            
            const categories = await executeQuery(sql, [...params, limit, offset], 'Get All Categories');
            
            return {
                categories,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new DatabaseError(`Error getting categories: ${error.message}`, error);
        }
    }

    /**
     * Get category by ID
     */
    static async findById(id) {
        try {
            const sql = `
                SELECT id, name, slug, description, image_url, is_active, 
                       sort_order, created_at, updated_at
                FROM categories 
                WHERE id = ?
            `;
            const result = await executeQuery(sql, [id], 'Find Category By ID');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error finding category: ${error.message}`, error);
        }
    }

    /**
     * Get category by slug
     */
    static async findBySlug(slug) {
        try {
            const sql = `
                SELECT id, name, slug, description, image_url, is_active, 
                       sort_order, created_at, updated_at
                FROM categories 
                WHERE slug = ?
            `;
            const result = await executeQuery(sql, [slug], 'Find Category By Slug');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error finding category by slug: ${error.message}`, error);
        }
    }

    /**
     * Create new category
     */
    static async createCategory(categoryData) {
        try {
            // Generate slug if not provided
            if (!categoryData.slug) {
                categoryData.slug = this.generateSlug(categoryData.name);
            }
            
            const query = buildInsertQuery('categories', categoryData);
            const result = await executeQuery(query.sql, query.params, 'Create Category');
            
            if (result.insertId) {
                return await this.findById(result.insertId);
            }
            throw new Error('Failed to create category');
        } catch (error) {
            throw new DatabaseError(`Error creating category: ${error.message}`, error);
        }
    }

    /**
     * Update category
     */
    static async updateCategory(id, updateData) {
        try {
            // Generate slug if name is being updated and slug is not provided
            if (updateData.name && !updateData.slug) {
                updateData.slug = this.generateSlug(updateData.name);
            }
            
            const query = buildUpdateQuery('categories', updateData, { id });
            await executeQuery(query.sql, query.params, 'Update Category');
            return await this.findById(id);
        } catch (error) {
            throw new DatabaseError(`Error updating category: ${error.message}`, error);
        }
    }

    /**
     * Delete category (only if no products are associated)
     */
    static async deleteCategory(id) {
        try {
            // Check if category has products
            const productCount = await this.getCategoryProductCount(id);
            if (productCount > 0) {
                throw new Error(`Cannot delete category with ${productCount} associated products`);
            }
            
            const sql = 'DELETE FROM categories WHERE id = ?';
            const result = await executeQuery(sql, [id], 'Delete Category');
            return result.affectedRows > 0;
        } catch (error) {
            throw new DatabaseError(`Error deleting category: ${error.message}`, error);
        }
    }

    /**
     * Get category with product count
     */
    static async getCategoryWithProductCount(id) {
        try {
            const sql = `
                SELECT c.id, c.name, c.slug, c.description, c.image_url, 
                       c.is_active, c.sort_order, c.created_at, c.updated_at,
                       COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.id = ?
                GROUP BY c.id
            `;
            const result = await executeQuery(sql, [id], 'Get Category With Product Count');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error getting category with product count: ${error.message}`, error);
        }
    }

    /**
     * Get all categories with product counts
     */
    static async getAllCategoriesWithProductCounts(includeEmpty = false) {
        try {
            const havingClause = includeEmpty ? '' : 'HAVING product_count > 0';
            
            const sql = `
                SELECT c.id, c.name, c.slug, c.description, c.image_url, 
                       c.is_active, c.sort_order, c.created_at, c.updated_at,
                       COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
                WHERE c.is_active = true
                GROUP BY c.id, c.name, c.slug, c.description, c.image_url, 
                         c.is_active, c.sort_order, c.created_at, c.updated_at
                ${havingClause}
                ORDER BY c.sort_order ASC, c.name ASC
            `;
            const result = await executeQuery(sql, [], 'Get Categories With Product Counts');
            return result;
        } catch (error) {
            throw new DatabaseError(`Error getting categories with product counts: ${error.message}`, error);
        }
    }

    /**
     * Get product count for a category
     */
    static async getCategoryProductCount(categoryId) {
        try {
            const sql = `
                SELECT COUNT(*) as count 
                FROM products 
                WHERE category_id = ? AND is_active = true
            `;
            const result = await executeQuery(sql, [categoryId], 'Get Category Product Count');
            return result[0].count;
        } catch (error) {
            throw new DatabaseError(`Error getting category product count: ${error.message}`, error);
        }
    }

    /**
     * Update category sort orders
     */
    static async updateSortOrders(categoryUpdates) {
        try {
            const queries = categoryUpdates.map(update => ({
                sql: 'UPDATE categories SET sort_order = ? WHERE id = ?',
                params: [update.sort_order, update.id]
            }));
            
            await executeTransaction(queries, 'Update Category Sort Orders');
            return true;
        } catch (error) {
            throw new DatabaseError(`Error updating sort orders: ${error.message}`, error);
        }
    }

    /**
     * Generate URL-friendly slug from name
     */
    static generateSlug(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }

    /**
     * Check if slug exists (for validation)
     */
    static async slugExists(slug, excludeId = null) {
        try {
            let sql = 'SELECT id FROM categories WHERE slug = ?';
            let params = [slug];
            
            if (excludeId) {
                sql += ' AND id != ?';
                params.push(excludeId);
            }
            
            const result = await executeQuery(sql, params, 'Check Slug Exists');
            return result.length > 0;
        } catch (error) {
            throw new DatabaseError(`Error checking slug existence: ${error.message}`, error);
        }
    }

    /**
     * Get categories for dropdown/select options
     */
    static async getCategoryOptions() {
        try {
            const sql = `
                SELECT id, name 
                FROM categories 
                WHERE is_active = true 
                ORDER BY sort_order ASC, name ASC
            `;
            const result = await executeQuery(sql, [], 'Get Category Options');
            return result;
        } catch (error) {
            throw new DatabaseError(`Error getting category options: ${error.message}`, error);
        }
    }

    /**
     * Search categories
     */
    static async searchCategories(searchTerm) {
        try {
            const sql = `
                SELECT id, name, slug, description, image_url, is_active, 
                       sort_order, created_at, updated_at
                FROM categories 
                WHERE (name LIKE ? OR description LIKE ?) 
                AND is_active = true
                ORDER BY sort_order ASC, name ASC
                LIMIT 20
            `;
            const searchPattern = `%${searchTerm}%`;
            const result = await executeQuery(sql, [searchPattern, searchPattern], 'Search Categories');
            return result;
        } catch (error) {
            throw new DatabaseError(`Error searching categories: ${error.message}`, error);
        }
    }
}

module.exports = CategoryModel;