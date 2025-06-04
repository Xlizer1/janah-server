const UserModel = require("./model");
const VerificationCodeModel = require("./verificationModel");
const TwilioService = require("../../../services/twilio");
const {
  hash,
  verifyPassword,
  createToken,
  verifyUserToken,
} = require("../../../helpers/common");
const {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  BusinessLogicError,
} = require("../../../middleware/errorHandler");
const { FileUploadService } = require("../../../middleware/multer");

class AuthController {
  /**
   * Register a new user
   */
  static async register(req, res) {
    try {
      const { phone_number, password, first_name, last_name, email } = req.body;

      // Format phone number
      const formattedPhone = TwilioService.formatPhoneNumber(phone_number);

      // Check if user already exists
      const existingUser = await UserModel.findByPhoneNumber(formattedPhone);
      if (existingUser) {
        throw new ConflictError(
          "An account with this phone number already exists"
        );
      }

      // Check email if provided
      if (email) {
        const existingEmail = await UserModel.findByEmail(email);
        if (existingEmail) {
          throw new ConflictError("An account with this email already exists");
        }
      }

      // Hash password
      const hashedPassword = await hash(password);

      // Create user
      const userData = {
        phone_number: formattedPhone,
        password: hashedPassword,
        first_name,
        last_name,
        email: email || null,
        is_phone_verified: false,
        is_active: false,
      };

      const newUser = await UserModel.createUser(userData);

      // Generate and send verification code
      const verificationCode = TwilioService.generateVerificationCode();
      await VerificationCodeModel.createVerificationCode(
        formattedPhone,
        verificationCode,
        "registration"
      );

      // Send SMS
      await TwilioService.sendVerificationCode(
        formattedPhone,
        verificationCode,
        "registration"
      );

      // Remove password from response
      delete newUser.password;

      res.status(201).json({
        status: true,
        message: "Registration successful. Please verify your phone number.",
        data: {
          user: newUser,
          next_step: "verify_phone",
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify phone number
   */
  static async verifyPhone(req, res) {
    try {
      const { phone_number, verification_code } = req.body;

      const formattedPhone = TwilioService.formatPhoneNumber(phone_number);

      // Find valid verification code
      const verificationRecord = await VerificationCodeModel.findValidCode(
        formattedPhone,
        verification_code,
        "registration"
      );

      if (!verificationRecord) {
        throw new ValidationError("Invalid or expired verification code");
      }

      // Find user
      const user = await UserModel.findByPhoneNumber(formattedPhone);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Mark verification code as used
      await VerificationCodeModel.markAsUsed(verificationRecord.id);

      // Update user phone verification status
      const updatedUser = await UserModel.verifyPhoneNumber(user.id);

      // Remove password from response
      delete updatedUser.password;

      res.json({
        status: true,
        message:
          "Phone number verified successfully. Your account is pending admin activation.",
        data: {
          user: updatedUser,
          next_step: "wait_for_activation",
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resend verification code
   */
  static async resendVerificationCode(req, res) {
    try {
      const { phone_number, type = "registration" } = req.body;

      const formattedPhone = TwilioService.formatPhoneNumber(phone_number);

      // Check rate limit
      const rateLimit = await VerificationCodeModel.checkRateLimit(
        formattedPhone,
        type
      );
      if (!rateLimit.canRequest) {
        throw new BusinessLogicError(
          `Too many verification attempts. Please try again after ${rateLimit.resetTime.toLocaleTimeString()}`
        );
      }

      // Generate new code
      const verificationCode = TwilioService.generateVerificationCode();
      await VerificationCodeModel.createVerificationCode(
        formattedPhone,
        verificationCode,
        type
      );

      // Send SMS
      await TwilioService.sendVerificationCode(
        formattedPhone,
        verificationCode,
        type
      );

      res.json({
        status: true,
        message: "Verification code sent successfully",
        data: {
          attempts_left: rateLimit.attemptsLeft - 1,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * User login
   */
  static async login(req, res) {
    try {
      const { phone_number, password } = req.body;

      const formattedPhone = TwilioService.formatPhoneNumber(phone_number);

      // Find user with password
      const user = await UserModel.findByPhoneNumber(formattedPhone);
      if (!user) {
        throw new AuthenticationError("Invalid phone number or password");
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        throw new AuthenticationError("Invalid phone number or password");
      }

      // Check if phone is verified
      if (!user.is_phone_verified) {
        throw new AuthenticationError("Please verify your phone number first");
      }

      // Check if account is active
      if (!user.is_active) {
        throw new AuthenticationError(
          "Your account is pending admin activation"
        );
      }

      // Create token
      const tokenData = {
        id: user.id,
        phone_number: user.phone_number,
        email: user.email,
        role: user.role,
      };

      const token = await createToken(tokenData);

      // Remove password from response and convert profile picture path to URL
      delete user.password;
      user.profile_picture = user.profile_picture
        ? FileUploadService.getFileUrl(req, user.profile_picture)
        : null;

      res.json({
        status: true,
        message: "Login successful",
        data: {
          user,
          token,
          token_type: "Bearer",
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Forgot password - send reset code
   */
  static async forgotPassword(req, res) {
    try {
      const { phone_number } = req.body;

      const formattedPhone = TwilioService.formatPhoneNumber(phone_number);

      // Find user
      const user = await UserModel.findByPhoneNumber(formattedPhone);
      if (!user) {
        // Don't reveal that user doesn't exist
        res.json({
          status: true,
          message:
            "If an account with this phone number exists, a reset code has been sent.",
        });
        return;
      }

      // Check rate limit
      const rateLimit = await VerificationCodeModel.checkRateLimit(
        formattedPhone,
        "password_reset"
      );
      if (!rateLimit.canRequest) {
        throw new BusinessLogicError(
          `Too many reset attempts. Please try again after ${rateLimit.resetTime.toLocaleTimeString()}`
        );
      }

      // Generate reset code
      const resetCode = TwilioService.generateVerificationCode();
      await VerificationCodeModel.createVerificationCode(
        formattedPhone,
        resetCode,
        "password_reset"
      );

      // Send SMS
      await TwilioService.sendVerificationCode(
        formattedPhone,
        resetCode,
        "password_reset"
      );

      res.json({
        status: true,
        message: "Password reset code sent successfully",
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset password with verification code
   */
  static async resetPassword(req, res) {
    try {
      const { phone_number, verification_code, new_password } = req.body;

      const formattedPhone = TwilioService.formatPhoneNumber(phone_number);

      // Find valid reset code
      const verificationRecord = await VerificationCodeModel.findValidCode(
        formattedPhone,
        verification_code,
        "password_reset"
      );

      if (!verificationRecord) {
        throw new ValidationError("Invalid or expired reset code");
      }

      // Find user
      const user = await UserModel.findByPhoneNumber(formattedPhone);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Hash new password
      const hashedPassword = await hash(new_password);

      // Mark verification code as used
      await VerificationCodeModel.markAsUsed(verificationRecord.id);

      // Update password
      await UserModel.updatePassword(user.id, hashedPassword);

      res.json({
        status: true,
        message:
          "Password reset successful. You can now login with your new password.",
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Change password (for authenticated users)
   */
  static async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      const userId = req.user.id;

      // Get user with password
      const user = await UserModel.findByPhoneNumber(req.user.phone_number);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(
        current_password,
        user.password
      );
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError("Current password is incorrect");
      }

      // Hash new password
      const hashedPassword = await hash(new_password);

      // Update password
      await UserModel.updatePassword(userId, hashedPassword);

      res.json({
        status: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(req, res) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Convert profile picture path to URL
      user.profile_picture = user.profile_picture
        ? FileUploadService.getFileUrl(req, user.profile_picture)
        : null;

      res.json({
        status: true,
        message: "Profile retrieved successfully",
        data: { user },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req, res) {
    try {
      const { first_name, last_name, email } = req.body;
      const userId = req.user.id;

      // Get existing user data
      const existingUser = await UserModel.findById(userId);
      if (!existingUser) {
        // Delete uploaded file if user doesn't exist
        if (req.file) {
          await FileUploadService.deleteFile(req.file.path);
        }
        throw new NotFoundError("User not found");
      }

      // Check if email is being updated and if it already exists
      if (email) {
        const existingEmail = await UserModel.findByEmail(email);
        if (existingEmail && existingEmail.id !== userId) {
          // Delete uploaded file if validation fails
          if (req.file) {
            await FileUploadService.deleteFile(req.file.path);
          }
          throw new ConflictError("An account with this email already exists");
        }
      }

      // Update user
      const updateData = {};
      if (first_name) updateData.first_name = first_name;
      if (last_name) updateData.last_name = last_name;
      if (email !== undefined) updateData.email = email;

      // Handle uploaded profile picture
      if (req.file) {
        updateData.profile_picture = req.file.path;

        // Delete old profile picture if it exists and is a local file
        if (
          existingUser.profile_picture &&
          !existingUser.profile_picture.startsWith("http")
        ) {
          await FileUploadService.deleteFile(existingUser.profile_picture);
        }
      }

      const updatedUser = await UserModel.updateUser(userId, updateData);

      // Convert profile picture path to URL for response
      updatedUser.profile_picture = updatedUser.profile_picture
        ? FileUploadService.getFileUrl(req, updatedUser.profile_picture)
        : null;

      res.json({
        status: true,
        message: "Profile updated successfully",
        data: { user: updatedUser },
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
   * Upload/Update profile picture
   */
  static async updateProfilePicture(req, res) {
    try {
      const userId = req.user.id;

      if (!req.file) {
        throw new ValidationError("Profile picture file is required");
      }

      // Get existing user data
      const existingUser = await UserModel.findById(userId);
      if (!existingUser) {
        await FileUploadService.deleteFile(req.file.path);
        throw new NotFoundError("User not found");
      }

      // Delete old profile picture if it exists and is a local file
      if (
        existingUser.profile_picture &&
        !existingUser.profile_picture.startsWith("http")
      ) {
        await FileUploadService.deleteFile(existingUser.profile_picture);
      }

      // Update user with new profile picture
      const updatedUser = await UserModel.updateUser(userId, {
        profile_picture: req.file.path,
      });

      // Convert profile picture path to URL for response
      updatedUser.profile_picture = FileUploadService.getFileUrl(
        req,
        updatedUser.profile_picture
      );

      res.json({
        status: true,
        message: "Profile picture updated successfully",
        data: {
          user: updatedUser,
          profile_picture_url: updatedUser.profile_picture,
        },
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
   * Remove profile picture
   */
  static async removeProfilePicture(req, res) {
    try {
      const userId = req.user.id;

      // Get existing user data
      const existingUser = await UserModel.findById(userId);
      if (!existingUser) {
        throw new NotFoundError("User not found");
      }

      // Delete profile picture file if it exists and is a local file
      if (
        existingUser.profile_picture &&
        !existingUser.profile_picture.startsWith("http")
      ) {
        await FileUploadService.deleteFile(existingUser.profile_picture);
      }

      // Update user to remove profile picture
      const updatedUser = await UserModel.updateUser(userId, {
        profile_picture: null,
      });

      res.json({
        status: true,
        message: "Profile picture removed successfully",
        data: { user: updatedUser },
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuthController;
