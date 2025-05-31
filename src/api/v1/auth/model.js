const { executeQuery, executeTransaction, buildInsertQuery, buildUpdateQuery } = require('../../../helpers/db');
const { DatabaseError } = require('../../../errors/customErrors');

class UserModel {
    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user
     */
    static async createUser(userData) {
        try {
            const query = buildInsertQuery('users', userData);
            const result = await executeQuery(query.sql, query.params, 'Create User');
            
            if (result.insertId) {
                return await this.findById(result.insertId);
            }
            throw new Error('Failed to create user');
        } catch (error) {
            throw new DatabaseError(`Error creating user: ${error.message}`, error);
        }
    }

    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {Promise<Object|null>} User object or null
     */
    static async findById(id) {
        try {
            const sql = `
                SELECT id, phone_number, first_name, last_name, email, 
                       is_phone_verified, is_active, role, created_at, 
                       updated_at, activated_at
                FROM users 
                WHERE id = ?
            `;
            const result = await executeQuery(sql, [id], 'Find User By ID');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error finding user by ID: ${error.message}`, error);
        }
    }

    /**
     * Find user by phone number
     * @param {string} phoneNumber - Phone number
     * @returns {Promise<Object|null>} User object or null
     */
    static async findByPhoneNumber(phoneNumber) {
        try {
            const sql = `
                SELECT id, phone_number, password, first_name, last_name, email, 
                       is_phone_verified, is_active, role, created_at, 
                       updated_at, activated_at
                FROM users 
                WHERE phone_number = ?
            `;
            const result = await executeQuery(sql, [phoneNumber], 'Find User By Phone');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error finding user by phone: ${error.message}`, error);
        }
    }

    /**
     * Find user by email
     * @param {string} email - Email address
     * @returns {Promise<Object|null>} User object or null
     */
    static async findByEmail(email) {
        try {
            const sql = `
                SELECT id, phone_number, first_name, last_name, email, 
                       is_phone_verified, is_active, role, created_at, 
                       updated_at, activated_at
                FROM users 
                WHERE email = ?
            `;
            const result = await executeQuery(sql, [email], 'Find User By Email');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error finding user by email: ${error.message}`, error);
        }
    }

    /**
     * Update user
     * @param {number} id - User ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated user
     */
    static async updateUser(id, updateData) {
        try {
            const query = buildUpdateQuery('users', updateData, { id });
            await executeQuery(query.sql, query.params, 'Update User');
            return await this.findById(id);
        } catch (error) {
            throw new DatabaseError(`Error updating user: ${error.message}`, error);
        }
    }

    /**
     * Activate user account
     * @param {number} userId - User ID to activate
     * @param {number} adminId - Admin ID who is activating
     * @returns {Promise<Object>} Updated user
     */
    static async activateUser(userId, adminId) {
        try {
            const updateData = {
                is_active: true,
                activated_at: new Date(),
                activated_by: adminId
            };
            return await this.updateUser(userId, updateData);
        } catch (error) {
            throw new DatabaseError(`Error activating user: ${error.message}`, error);
        }
    }

    /**
     * Deactivate user account
     * @param {number} userId - User ID to deactivate
     * @returns {Promise<Object>} Updated user
     */
    static async deactivateUser(userId) {
        try {
            const updateData = {
                is_active: false,
                activated_at: null,
                activated_by: null
            };
            return await this.updateUser(userId, updateData);
        } catch (error) {
            throw new DatabaseError(`Error deactivating user: ${error.message}`, error);
        }
    }

    /**
     * Verify user's phone number
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Updated user
     */
    static async verifyPhoneNumber(userId) {
        try {
            const updateData = { is_phone_verified: true };
            return await this.updateUser(userId, updateData);
        } catch (error) {
            throw new DatabaseError(`Error verifying phone: ${error.message}`, error);
        }
    }

    /**
     * Update user password
     * @param {number} userId - User ID
     * @param {string} hashedPassword - New hashed password
     * @returns {Promise<Object>} Updated user
     */
    static async updatePassword(userId, hashedPassword) {
        try {
            const updateData = { password: hashedPassword };
            return await this.updateUser(userId, updateData);
        } catch (error) {
            throw new DatabaseError(`Error updating password: ${error.message}`, error);
        }
    }

    /**
     * Get all users with pagination and filters
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Users list with pagination info
     */
    static async getAllUsers(options = {}) {
        try {
            const { page = 1, limit = 10, role, isActive, isPhoneVerified } = options;
            const offset = (page - 1) * limit;
            
            let whereConditions = [];
            let params = [];
            
            if (role) {
                whereConditions.push('role = ?');
                params.push(role);
            }
            
            if (isActive !== undefined) {
                whereConditions.push('is_active = ?');
                params.push(isActive);
            }
            
            if (isPhoneVerified !== undefined) {
                whereConditions.push('is_phone_verified = ?');
                params.push(isPhoneVerified);
            }
            
            const whereClause = whereConditions.length > 0 ? 
                `WHERE ${whereConditions.join(' AND ')}` : '';
            
            // Get total count
            const countSql = `SELECT COUNT(*) as total FROM users ${whereClause}`;
            const countResult = await executeQuery(countSql, params, 'Count Users');
            const total = countResult[0].total;
            
            // Get users
            const sql = `
                SELECT id, phone_number, first_name, last_name, email, 
                       is_phone_verified, is_active, role, created_at, 
                       updated_at, activated_at
                FROM users 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            const users = await executeQuery(sql, [...params, limit, offset], 'Get All Users');
            
            return {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new DatabaseError(`Error getting users: ${error.message}`, error);
        }
    }
}

module.exports = UserModel;