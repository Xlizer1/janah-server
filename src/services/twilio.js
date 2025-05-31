const twilio = require("twilio");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  DEFAULT_COUNTRY_CODE = "+964",
} = process.env;

// Validate configuration on startup
const validateTwilioConfig = () => {
  const errors = [];

  if (!TWILIO_ACCOUNT_SID) {
    errors.push("TWILIO_ACCOUNT_SID is not set");
  } else if (!/^AC[a-f0-9]{32}$/i.test(TWILIO_ACCOUNT_SID)) {
    errors.push("TWILIO_ACCOUNT_SID has invalid format");
  }

  if (!TWILIO_AUTH_TOKEN) {
    errors.push("TWILIO_AUTH_TOKEN is not set");
  } else if (!/^[a-f0-9]{32}$/i.test(TWILIO_AUTH_TOKEN)) {
    errors.push("TWILIO_AUTH_TOKEN has invalid format");
  }

  if (!TWILIO_PHONE_NUMBER) {
    errors.push("TWILIO_PHONE_NUMBER is not set");
  }

  if (errors.length > 0) {
    console.error("❌ Twilio Configuration Errors:");
    errors.forEach((error) => console.error(`   - ${error}`));
    throw new Error(`Twilio configuration invalid: ${errors.join(", ")}`);
  }

  console.log("✅ Twilio configuration validated successfully");
};

// Validate configuration on module load
try {
  validateTwilioConfig();
} catch (error) {
  console.error("Twilio service initialization failed:", error.message);
  // Don't throw here, let the service methods handle it gracefully
}

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

class TwilioService {
  /**
   * Check if Twilio is properly configured
   */
  static isConfigured() {
    return !!(
      TWILIO_ACCOUNT_SID &&
      TWILIO_AUTH_TOKEN &&
      TWILIO_PHONE_NUMBER &&
      twilioClient
    );
  }

  /**
   * Get detailed error information for Twilio errors
   */
  static getTwilioErrorInfo(error) {
    const errorInfo = {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    };

    // Add specific guidance for common errors
    switch (error.code) {
      case 20003:
        errorInfo.guidance =
          "Authentication failed. Check your Account SID and Auth Token in the Twilio Console.";
        break;
      case 21211:
        errorInfo.guidance =
          'Invalid "To" phone number. Check the phone number format.';
        break;
      case 21212:
        errorInfo.guidance =
          'Invalid "From" phone number. Check your Twilio phone number.';
        break;
      case 21408:
        errorInfo.guidance =
          "Permission denied. Your account may be suspended or have restrictions.";
        break;
      case 21610:
        errorInfo.guidance =
          "Message blocked due to spam filtering or carrier restrictions.";
        break;
      default:
        errorInfo.guidance = "Check Twilio documentation for more details.";
    }

    return errorInfo;
  }

  /**
   * Send SMS message with improved error handling
   * @param {string} to - Phone number to send to
   * @param {string} message - Message content
   * @returns {Promise<object>} Twilio response
   */
  static async sendSMS(to, message) {
    try {
      // Check configuration
      if (!this.isConfigured()) {
        throw new Error(
          "Twilio service is not properly configured. Check your environment variables."
        );
      }

      console.log(`📱 Sending SMS to ${to.slice(0, 5)}***`);

      const response = await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: to,
      });

      console.log(`✅ SMS sent successfully: ${response.sid}`);
      return {
        success: true,
        sid: response.sid,
        status: response.status,
        to: to,
      };
    } catch (error) {
      const errorInfo = this.getTwilioErrorInfo(error);

      console.error("❌ Twilio SMS Error:", {
        to: to.slice(0, 5) + "***",
        error: errorInfo,
      });

      // Create a more detailed error message
      const detailedMessage = `SMS failed: ${errorInfo.message} (Code: ${errorInfo.code}). ${errorInfo.guidance}`;

      throw new Error(detailedMessage);
    }
  }

  /**
   * Send verification code with specific formatting
   * @param {string} phoneNumber - Phone number
   * @param {string} code - Verification code
   * @param {string} type - Type of verification (registration, password_reset)
   * @returns {Promise<object>} Response
   */
  static async sendVerificationCode(phoneNumber, code, type = "registration") {
    let message;

    switch (type) {
      case "registration":
        message = `Welcome to Janah! Your verification code is: ${code}. This code expires in 10 minutes. If you didn't request this, please ignore.`;
        break;
      case "password_reset":
        message = `Your Janah password reset code is: ${code}. This code expires in 10 minutes. If you didn't request this, please ignore this message.`;
        break;
      default:
        message = `Your Janah verification code is: ${code}. This code expires in 10 minutes.`;
    }

    try {
      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      // Log the specific context
      console.error(
        `Failed to send ${type} verification code to ${phoneNumber.slice(
          0,
          5
        )}***:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Send account activation notification
   * @param {string} phoneNumber - Phone number
   * @param {string} firstName - User's first name
   * @returns {Promise<object>} Response
   */
  static async sendActivationNotification(phoneNumber, firstName) {
    const message = `Hi ${firstName}! Great news - your Janah account has been activated! You can now access all our products and start shopping. Welcome aboard! 🎉`;

    try {
      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      console.error(
        `Failed to send activation notification to ${firstName}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Generate random verification code
   * @param {number} length - Code length (default: 6)
   * @returns {string} Verification code
   */
  static generateVerificationCode(length = 6) {
    const digits = "0123456789";
    let code = "";

    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }

    return code;
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {object} Validation result
   */
  static validatePhoneNumber(phoneNumber) {
    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;

    if (!phoneNumber) {
      return { isValid: false, message: "Phone number is required" };
    }

    // Remove spaces and dashes
    const cleanPhone = phoneNumber.replace(/[\s-]/g, "");

    if (!phoneRegex.test(cleanPhone)) {
      return { isValid: false, message: "Invalid phone number format" };
    }

    return { isValid: true, cleanPhone };
  }

  /**
   * Format phone number with country code
   * @param {string} phoneNumber - Phone number
   * @param {string} defaultCountryCode - Default country code (e.g., '+964')
   * @returns {string} Formatted phone number
   */
  static formatPhoneNumber(
    phoneNumber,
    defaultCountryCode = DEFAULT_COUNTRY_CODE
  ) {
    const { isValid, cleanPhone } = this.validatePhoneNumber(phoneNumber);

    if (!isValid) {
      throw new Error("Invalid phone number format");
    }

    // If phone doesn't start with +, add default country code
    if (!cleanPhone.startsWith("+")) {
      return `${defaultCountryCode}${cleanPhone}`;
    }

    return cleanPhone;
  }

  /**
   * Test Twilio connection
   * @returns {Promise<object>} Connection test result
   */
  static async testConnection() {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: "Twilio not configured",
        };
      }

      const account = await twilioClient.api
        .accounts(TWILIO_ACCOUNT_SID)
        .fetch();

      return {
        success: true,
        account: {
          sid: account.sid,
          friendlyName: account.friendlyName,
          status: account.status,
          type: account.type,
        },
        warnings:
          account.type === "Trial"
            ? ["This is a trial account with restrictions"]
            : [],
      };
    } catch (error) {
      const errorInfo = this.getTwilioErrorInfo(error);
      return {
        success: false,
        error: errorInfo,
      };
    }
  }
}

module.exports = TwilioService;
