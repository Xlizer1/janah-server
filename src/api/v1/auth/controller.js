const UserModel = require("./model");
const ActivationCodeModel = require("./activationCodeModel");
const {
  hash,
  verifyPassword,
  createToken,
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
   * Register a new user (NO PHONE VERIFICATION)
   */
  static async register(req, res) {
    try {
      const { phone_number, password, first_name, last_name, email } = req.body;

      // Check if user already exists
      const existingUser = await UserModel.findByPhoneNumber(phone_number);
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

      // Create user (INACTIVE by default)
      const userData = {
        phone_number,
        password: hashedPassword,
        first_name,
        last_name,
        email: email || null,
        is_active: false, // User must activate with code
      };

      const newUser = await UserModel.createUser(userData);

      delete newUser.password;

      res.status(201).json({
        status: true,
        message:
          "Registration successful. Please contact an administrator to get an activation code.",
        data: {
          user: newUser,
          next_step: "get_activation_code",
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Activate account with activation code
   */
  static async activateAccount(req, res) {
    try {
      const { phone_number, activation_code } = req.body;

      // Find user
      const user = await UserModel.findByPhoneNumber(phone_number);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Check if already activated
      if (user.is_active) {
        throw new BusinessLogicError("Account is already activated");
      }

      // Validate activation code
      const validation = await ActivationCodeModel.validateCode(
        activation_code
      );
      if (!validation.isValid) {
        throw new ValidationError(validation.message);
      }

      // Use the activation code
      await ActivationCodeModel.useCode(activation_code, user.id);

      // Activate user account
      const updatedUser = await UserModel.activateUserWithCode(
        user.id,
        activation_code
      );

      // Remove password from response
      delete updatedUser.password;

      res.json({
        status: true,
        message: "Account activated successfully! You can now login.",
        data: {
          user: updatedUser,
          next_step: "login",
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * User login (ONLY CHECK is_active)
   */
  static async login(req, res) {
    try {
      const { phone_number, password } = req.body;

      // Find user with password
      const user = await UserModel.findByPhoneNumber(phone_number);
      if (!user) {
        throw new AuthenticationError("Invalid phone number or password");
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        throw new AuthenticationError("Invalid phone number or password");
      }

      // Check if account is active (ONLY CHECK is_active)
      if (!user.is_active) {
        throw new AuthenticationError(
          "Your account is not activated. Please contact an administrator to get an activation code."
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

      // Remove password from response
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
