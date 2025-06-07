const ActivationCodeModel = require("../auth/activationCodeModel");
const {
  NotFoundError,
  BusinessLogicError,
} = require("../../../middleware/errorHandler");

class AdminActivationController {
  /**
   * Generate new activation code
   */
  static async generateActivationCode(req, res) {
    try {
      const { format, expires_in_days, notes, custom_code } = req.body;
      const adminId = req.user.id;

      let expires_at = null;
      if (expires_in_days) {
        expires_at = new Date();
        expires_at.setDate(expires_at.getDate() + parseInt(expires_in_days));
      }

      const codeData = {
        code: custom_code || null, // Use custom code if provided
        format: format || "JANAH",
        expires_at,
        notes,
      };

      const activationCode = await ActivationCodeModel.createActivationCode(
        codeData,
        adminId
      );

      res.status(201).json({
        status: true,
        message: "Activation code generated successfully",
        data: { activation_code: activationCode },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all activation codes
   */
  static async getAllActivationCodes(req, res) {
    try {
      const { page, limit, status, created_by } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        created_by: created_by ? parseInt(created_by) : undefined,
      };

      const result = await ActivationCodeModel.getAllCodes(options);

      res.json({
        status: true,
        message: "Activation codes retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get activation code details
   */
  static async getActivationCode(req, res) {
    try {
      const { code } = req.params;

      const activationCode = await ActivationCodeModel.findByCode(code);
      if (!activationCode) {
        throw new NotFoundError("Activation code not found");
      }

      res.json({
        status: true,
        message: "Activation code retrieved successfully",
        data: { activation_code: activationCode },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate activation code
   */
  static async deactivateCode(req, res) {
    try {
      const { code } = req.params;

      const activationCode = await ActivationCodeModel.findByCode(code);
      if (!activationCode) {
        throw new NotFoundError("Activation code not found");
      }

      if (activationCode.used_by) {
        throw new BusinessLogicError(
          "Cannot deactivate a code that has already been used"
        );
      }

      const updatedCode = await ActivationCodeModel.deactivateCode(code);

      res.json({
        status: true,
        message: "Activation code deactivated successfully",
        data: { activation_code: updatedCode },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get activation statistics
   */
  static async getActivationStatistics(req, res) {
    try {
      const stats = await ActivationCodeModel.getStatistics();

      res.json({
        status: true,
        message: "Activation statistics retrieved successfully",
        data: { statistics: stats },
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AdminActivationController;
