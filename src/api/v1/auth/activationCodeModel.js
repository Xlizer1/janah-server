const {
  executeQuery,
  buildInsertQuery,
  buildUpdateQuery,
} = require("../../../helpers/db");
const { DatabaseError } = require("../../../errors/customErrors");
const crypto = require("crypto");

class ActivationCodeModel {
  /**
   * Generate unique activation code
   */
  static generateCode(format = "JANAH", length = 8) {
    const timestamp = Date.now().toString().slice(-4);
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();

    switch (format) {
      case "JANAH":
        return `JANAH-${new Date().getFullYear()}-${timestamp.slice(-3)}`;
      case "PREMIUM":
        return `PREMIUM-${random.slice(0, 6)}`;
      case "TRIAL":
        return `TRIAL-${timestamp}${random.slice(0, 2)}`;
      case "CUSTOM":
        return `JAN-${random}`;
      default:
        return `JANAH-${random}`;
    }
  }

  /**
   * Create activation code (Admin only)
   */
  static async createActivationCode(codeData, adminId) {
    try {
      // Generate unique code if not provided
      if (!codeData.code) {
        let generatedCode;
        let attempts = 0;
        do {
          generatedCode = this.generateCode(codeData.format);
          attempts++;
          const existing = await this.findByCode(generatedCode);
          if (!existing) {
            codeData.code = generatedCode;
            break;
          }
        } while (attempts < 10);

        if (attempts >= 10) {
          throw new Error("Failed to generate unique activation code");
        }
      }

      const activationData = {
        code: codeData.code.toUpperCase(),
        created_by: adminId,
        expires_at: codeData.expires_at || null,
        notes: codeData.notes || null,
        is_active: true,
      };

      const query = buildInsertQuery("activation_codes", activationData);
      const result = await executeQuery(
        query.sql,
        query.params,
        "Create Activation Code"
      );

      if (result.insertId) {
        return await this.findById(result.insertId);
      }
      throw new Error("Failed to create activation code");
    } catch (error) {
      throw new DatabaseError(
        `Error creating activation code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Find activation code by code string
   */
  static async findByCode(code) {
    try {
      const sql = `
        SELECT ac.*, 
               creator.first_name as created_by_name, creator.last_name as created_by_lastname,
               user.first_name as used_by_name, user.last_name as used_by_lastname
        FROM activation_codes ac
        LEFT JOIN users creator ON ac.created_by = creator.id
        LEFT JOIN users user ON ac.used_by = user.id
        WHERE ac.code = ?
      `;
      const result = await executeQuery(
        sql,
        [code.toUpperCase()],
        "Find Activation Code"
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding activation code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Find activation code by ID
   */
  static async findById(id) {
    try {
      const sql = `
        SELECT ac.*, 
               creator.first_name as created_by_name, creator.last_name as created_by_lastname,
               user.first_name as used_by_name, user.last_name as used_by_lastname
        FROM activation_codes ac
        LEFT JOIN users creator ON ac.created_by = creator.id
        LEFT JOIN users user ON ac.used_by = user.id
        WHERE ac.id = ?
      `;
      const result = await executeQuery(
        sql,
        [id],
        "Find Activation Code By ID"
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding activation code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get all activation codes with pagination
   */
  static async getAllCodes(options = {}) {
    try {
      const { page = 1, limit = 20, status, created_by } = options;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let params = [];

      if (status === "used") {
        whereConditions.push("ac.used_by IS NOT NULL");
      } else if (status === "unused") {
        whereConditions.push("ac.used_by IS NULL AND ac.is_active = 1");
        whereConditions.push(
          "(ac.expires_at IS NULL OR ac.expires_at > NOW())"
        );
      } else if (status === "expired") {
        whereConditions.push(
          "ac.expires_at IS NOT NULL AND ac.expires_at <= NOW()"
        );
      }

      if (created_by) {
        whereConditions.push("ac.created_by = ?");
        params.push(created_by);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM activation_codes ac ${whereClause}`;
      const countResult = await executeQuery(
        countSql,
        params,
        "Count Activation Codes"
      );
      const total = countResult[0].total;

      // Get codes
      const sql = `
        SELECT ac.*, 
               creator.first_name as created_by_name, creator.last_name as created_by_lastname,
               user.first_name as used_by_name, user.last_name as used_by_lastname
        FROM activation_codes ac
        LEFT JOIN users creator ON ac.created_by = creator.id
        LEFT JOIN users user ON ac.used_by = user.id
        ${whereClause}
        ORDER BY ac.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const codes = await executeQuery(
        sql,
        [...params, limit, offset],
        "Get All Activation Codes"
      );

      return {
        codes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Error getting activation codes: ${error.message}`,
        error
      );
    }
  }

  /**
   * Use activation code
   */
  static async useCode(code, userId) {
    try {
      const updateData = {
        used_by: userId,
        used_at: new Date(),
      };

      const query = buildUpdateQuery("activation_codes", updateData, {
        code: code.toUpperCase(),
      });
      await executeQuery(query.sql, query.params, "Use Activation Code");

      return await this.findByCode(code);
    } catch (error) {
      throw new DatabaseError(
        `Error using activation code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate activation code
   */
  static async validateCode(code) {
    try {
      const activationCode = await this.findByCode(code);

      if (!activationCode) {
        return { isValid: false, message: "Activation code not found" };
      }

      if (!activationCode.is_active) {
        return { isValid: false, message: "Activation code is disabled" };
      }

      if (activationCode.used_by) {
        return {
          isValid: false,
          message: "Activation code has already been used",
        };
      }

      if (
        activationCode.expires_at &&
        new Date(activationCode.expires_at) < new Date()
      ) {
        return { isValid: false, message: "Activation code has expired" };
      }

      return { isValid: true, code: activationCode };
    } catch (error) {
      throw new DatabaseError(
        `Error validating activation code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Deactivate activation code
   */
  static async deactivateCode(code) {
    try {
      const query = buildUpdateQuery(
        "activation_codes",
        { is_active: false },
        { code: code.toUpperCase() }
      );
      await executeQuery(query.sql, query.params, "Deactivate Code");
      return await this.findByCode(code);
    } catch (error) {
      throw new DatabaseError(
        `Error deactivating code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get activation statistics
   */
  static async getStatistics() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_codes,
          COUNT(CASE WHEN used_by IS NOT NULL THEN 1 END) as used_codes,
          COUNT(CASE WHEN used_by IS NULL AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 END) as available_codes,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 1 END) as expired_codes,
          COUNT(CASE WHEN is_active = 0 THEN 1 END) as disabled_codes
        FROM activation_codes
      `;

      const result = await executeQuery(sql, [], "Get Activation Statistics");
      return result[0];
    } catch (error) {
      throw new DatabaseError(
        `Error getting activation statistics: ${error.message}`,
        error
      );
    }
  }
}

module.exports = ActivationCodeModel;
