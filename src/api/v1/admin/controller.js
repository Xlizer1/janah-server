const UserModel = require('../auth/model');
const TwilioService = require('../../../services/twilio');
const { 
    NotFoundError,
    BusinessLogicError 
} = require('../../../middleware/errorHandler');

class AdminController {
    /**
     * Get all users with pagination and filters
     */
    static async getAllUsers(req, res) {
        try {
            const { page, limit, role, is_active, is_phone_verified } = req.query;
            
            const options = {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                role,
                isActive: is_active !== undefined ? is_active === 'true' : undefined,
                isPhoneVerified: is_phone_verified !== undefined ? is_phone_verified === 'true' : undefined
            };
            
            const result = await UserModel.getAllUsers(options);
            
            res.json({
                status: true,
                message: 'Users retrieved successfully',
                data: result
            });
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get pending users (not activated)
     */
    static async getPendingUsers(req, res) {
        try {
            const { page, limit } = req.query;
            
            const options = {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                role: 'user',
                isActive: false,
                isPhoneVerified: true // Only show users who have verified their phone
            };
            
            const result = await UserModel.getAllUsers(options);
            
            res.json({
                status: true,
                message: 'Pending users retrieved successfully',
                data: result
            });
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get user by ID
     */
    static async getUserById(req, res) {
        try {
            const { user_id } = req.params;
            
            const user = await UserModel.findById(user_id);
            if (!user) {
                throw new NotFoundError('User not found');
            }
            
            res.json({
                status: true,
                message: 'User retrieved successfully',
                data: { user }
            });
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Activate user account
     */
    static async activateUser(req, res) {
        try {
            const { user_id } = req.body;
            const adminId = req.user.id;
            
            // Find user
            const user = await UserModel.findById(user_id);
            if (!user) {
                throw new NotFoundError('User not found');
            }
            
            // Check if user is already active
            if (user.is_active) {
                throw new BusinessLogicError('User account is already active');
            }
            
            // Check if phone is verified
            if (!user.is_phone_verified) {
                throw new BusinessLogicError('User must verify their phone number before activation');
            }
            
            // Activate user
            const updatedUser = await UserModel.activateUser(user_id, adminId);
            
            // Send activation notification via SMS
            try {
                await TwilioService.sendActivationNotification(
                    user.phone_number, 
                    user.first_name
                );
            } catch (smsError) {
                console.error('Failed to send activation SMS:', smsError);
                // Don't fail the activation if SMS fails
            }
            
            res.json({
                status: true,
                message: 'User account activated successfully',
                data: { user: updatedUser }
            });
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Deactivate user account
     */
    static async deactivateUser(req, res) {
        try {
            const { user_id } = req.body;
            
            // Find user
            const user = await UserModel.findById(user_id);
            if (!user) {
                throw new NotFoundError('User not found');
            }
            
            // Prevent deactivating admin users
            if (user.role === 'admin') {
                throw new BusinessLogicError('Cannot deactivate admin users');
            }
            
            // Check if user is already inactive
            if (!user.is_active) {
                throw new BusinessLogicError('User account is already inactive');
            }
            
            // Deactivate user
            const updatedUser = await UserModel.deactivateUser(user_id);
            
            res.json({
                status: true,
                message: 'User account deactivated successfully',
                data: { user: updatedUser }
            });
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get activation statistics
     */
    static async getActivationStats(req, res) {
        try {
            // Get various user counts
            const [
                totalUsersResult,
                activeUsersResult,
                pendingUsersResult,
                unverifiedUsersResult
            ] = await Promise.all([
                UserModel.getAllUsers({ role: 'user', limit: 1 }),
                UserModel.getAllUsers({ role: 'user', isActive: true, limit: 1 }),
                UserModel.getAllUsers({ role: 'user', isActive: false, isPhoneVerified: true, limit: 1 }),
                UserModel.getAllUsers({ role: 'user', isPhoneVerified: false, limit: 1 })
            ]);
            
            const stats = {
                total_users: totalUsersResult.pagination.total,
                active_users: activeUsersResult.pagination.total,
                pending_activation: pendingUsersResult.pagination.total,
                unverified_phone: unverifiedUsersResult.pagination.total,
                activation_rate: totalUsersResult.pagination.total > 0 
                    ? ((activeUsersResult.pagination.total / totalUsersResult.pagination.total) * 100).toFixed(2)
                    : 0
            };
            
            res.json({
                status: true,
                message: 'Activation statistics retrieved successfully',
                data: { stats }
            });
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Bulk activate users
     */
    static async bulkActivateUsers(req, res) {
        try {
            const { user_ids } = req.body;
            const adminId = req.user.id;
            
            if (!Array.isArray(user_ids) || user_ids.length === 0) {
                throw new BusinessLogicError('User IDs array is required');
            }
            
            if (user_ids.length > 50) {
                throw new BusinessLogicError('Cannot activate more than 50 users at once');
            }
            
            const results = {
                activated: [],
                failed: [],
                already_active: [],
                not_found: []
            };
            
            for (const userId of user_ids) {
                try {
                    const user = await UserModel.findById(userId);
                    
                    if (!user) {
                        results.not_found.push(userId);
                        continue;
                    }
                    
                    if (user.is_active) {
                        results.already_active.push(userId);
                        continue;
                    }
                    
                    if (!user.is_phone_verified) {
                        results.failed.push({
                            user_id: userId,
                            reason: 'Phone not verified'
                        });
                        continue;
                    }
                    
                    await UserModel.activateUser(userId, adminId);
                    results.activated.push(userId);
                    
                    // Send SMS notification (don't await to avoid slowing down the process)
                    TwilioService.sendActivationNotification(user.phone_number, user.first_name)
                        .catch(error => console.error(`SMS notification failed for user ${userId}:`, error));
                    
                } catch (error) {
                    results.failed.push({
                        user_id: userId,
                        reason: error.message
                    });
                }
            }
            
            res.json({
                status: true,
                message: 'Bulk activation completed',
                data: results
            });
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Search users
     */
    static async searchUsers(req, res) {
        try {
            const { query, type = 'phone' } = req.query;
            
            if (!query) {
                throw new BusinessLogicError('Search query is required');
            }
            
            let user = null;
            
            switch (type) {
                case 'phone':
                    user = await UserModel.findByPhoneNumber(query);
                    break;
                case 'email':
                    user = await UserModel.findByEmail(query);
                    break;
                case 'id':
                    user = await UserModel.findById(query);
                    break;
                default:
                    throw new BusinessLogicError('Search type must be phone, email, or id');
            }
            
            res.json({
                status: true,
                message: user ? 'User found' : 'User not found',
                data: { user }
            });
            
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AdminController;