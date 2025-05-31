const { executeQuery, buildInsertQuery, buildUpdateQuery } = require('../../../helpers/db');
const { DatabaseError } = require('../../../errors/customErrors');

class VerificationCodeModel {
    /**
     * Create a new verification code
     * @param {string} phoneNumber - Phone number
     * @param {string} code - Verification code
     * @param {string} type - Type (registration, password_reset)
     * @param {number} expiryMinutes - Expiry time in minutes (default: 10)
     * @returns {Promise<Object>} Created verification code
     */
    static async createVerificationCode(phoneNumber, code, type = 'registration', expiryMinutes = 10) {
        try {
            // First, invalidate any existing codes for this phone and type
            await this.invalidateExistingCodes(phoneNumber, type);
            
            const expiresAt = new Date(Date.now() + (expiryMinutes * 60 * 1000));
            
            const verificationData = {
                phone_number: phoneNumber,
                code: code,
                type: type,
                expires_at: expiresAt
            };
            
            const query = buildInsertQuery('phone_verification_codes', verificationData);
            const result = await executeQuery(query.sql, query.params, 'Create Verification Code');
            
            if (result.insertId) {
                return await this.findById(result.insertId);
            }
            throw new Error('Failed to create verification code');
        } catch (error) {
            throw new DatabaseError(`Error creating verification code: ${error.message}`, error);
        }
    }

    /**
     * Find verification code by ID
     * @param {number} id - Verification code ID
     * @returns {Promise<Object|null>} Verification code or null
     */
    static async findById(id) {
        try {
            const sql = `
                SELECT id, phone_number, code, type, expires_at, used_at, created_at
                FROM phone_verification_codes 
                WHERE id = ?
            `;
            const result = await executeQuery(sql, [id], 'Find Verification Code By ID');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error finding verification code: ${error.message}`, error);
        }
    }

    /**
     * Find valid verification code
     * @param {string} phoneNumber - Phone number
     * @param {string} code - Verification code
     * @param {string} type - Type (registration, password_reset)
     * @returns {Promise<Object|null>} Verification code or null
     */
    static async findValidCode(phoneNumber, code, type) {
        try {
            const sql = `
                SELECT id, phone_number, code, type, expires_at, used_at, created_at
                FROM phone_verification_codes 
                WHERE phone_number = ? 
                AND code = ? 
                AND type = ? 
                AND expires_at > NOW() 
                AND used_at IS NULL
                ORDER BY created_at DESC
                LIMIT 1
            `;
            const result = await executeQuery(sql, [phoneNumber, code, type], 'Find Valid Verification Code');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error finding valid verification code: ${error.message}`, error);
        }
    }

    /**
     * Mark verification code as used
     * @param {number} id - Verification code ID
     * @returns {Promise<Object>} Updated verification code
     */
    static async markAsUsed(id) {
        try {
            const updateData = { used_at: new Date() };
            const query = buildUpdateQuery('phone_verification_codes', updateData, { id });
            await executeQuery(query.sql, query.params, 'Mark Verification Code As Used');
            return await this.findById(id);
        } catch (error) {
            throw new DatabaseError(`Error marking verification code as used: ${error.message}`, error);
        }
    }

    /**
     * Invalidate existing codes for phone and type
     * @param {string} phoneNumber - Phone number
     * @param {string} type - Type (registration, password_reset)
     * @returns {Promise<void>}
     */
    static async invalidateExistingCodes(phoneNumber, type) {
        try {
            const sql = `
                UPDATE phone_verification_codes 
                SET used_at = NOW() 
                WHERE phone_number = ? 
                AND type = ? 
                AND used_at IS NULL
            `;
            await executeQuery(sql, [phoneNumber, type], 'Invalidate Existing Codes');
        } catch (error) {
            throw new DatabaseError(`Error invalidating existing codes: ${error.message}`, error);
        }
    }

    /**
     * Get verification attempt count for phone number in last hour
     * @param {string} phoneNumber - Phone number
     * @param {string} type - Type (registration, password_reset)
     * @returns {Promise<number>} Attempt count
     */
    static async getRecentAttemptCount(phoneNumber, type) {
        try {
            const sql = `
                SELECT COUNT(*) as count
                FROM phone_verification_codes 
                WHERE phone_number = ? 
                AND type = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `;
            const result = await executeQuery(sql, [phoneNumber, type], 'Get Recent Attempt Count');
            return result[0].count;
        } catch (error) {
            throw new DatabaseError(`Error getting attempt count: ${error.message}`, error);
        }
    }

    /**
     * Cleanup expired verification codes
     * @returns {Promise<number>} Number of deleted codes
     */
    static async cleanupExpiredCodes() {
        try {
            const sql = `
                DELETE FROM phone_verification_codes 
                WHERE expires_at < NOW() 
                OR used_at IS NOT NULL
            `;
            const result = await executeQuery(sql, [], 'Cleanup Expired Codes');
            return result.affectedRows;
        } catch (error) {
            throw new DatabaseError(`Error cleaning up expired codes: ${error.message}`, error);
        }
    }

    /**
     * Check if user can request new verification code (rate limiting)
     * @param {string} phoneNumber - Phone number
     * @param {string} type - Type (registration, password_reset)
     * @param {number} maxAttempts - Max attempts per hour (default: 5)
     * @returns {Promise<Object>} Rate limit status
     */
    static async checkRateLimit(phoneNumber, type, maxAttempts = 5) {
        try {
            const attemptCount = await this.getRecentAttemptCount(phoneNumber, type);
            
            if (attemptCount >= maxAttempts) {
                return {
                    canRequest: false,
                    attemptsLeft: 0,
                    resetTime: new Date(Date.now() + (60 * 60 * 1000)) // 1 hour from now
                };
            }
            
            return {
                canRequest: true,
                attemptsLeft: maxAttempts - attemptCount,
                resetTime: null
            };
        } catch (error) {
            throw new DatabaseError(`Error checking rate limit: ${error.message}`, error);
        }
    }

    /**
     * Get latest verification code for phone and type
     * @param {string} phoneNumber - Phone number
     * @param {string} type - Type (registration, password_reset)
     * @returns {Promise<Object|null>} Latest verification code or null
     */
    static async getLatestCode(phoneNumber, type) {
        try {
            const sql = `
                SELECT id, phone_number, code, type, expires_at, used_at, created_at
                FROM phone_verification_codes 
                WHERE phone_number = ? 
                AND type = ?
                ORDER BY created_at DESC
                LIMIT 1
            `;
            const result = await executeQuery(sql, [phoneNumber, type], 'Get Latest Verification Code');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            throw new DatabaseError(`Error getting latest verification code: ${error.message}`, error);
        }
    }
}

module.exports = VerificationCodeModel;