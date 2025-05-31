const TwilioService = require("../services/twilio");

class ValidationUtils {
  /**
   * Validate and format phone number
   */
  static validatePhoneNumber(phoneNumber, countryCode = "+964") {
    try {
      const formattedPhone = TwilioService.formatPhoneNumber(
        phoneNumber,
        countryCode
      );
      return {
        isValid: true,
        formattedPhone,
        error: null,
      };
    } catch (error) {
      return {
        isValid: false,
        formattedPhone: null,
        error: error.message,
      };
    }
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password) {
    const minLength = 6;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (!hasLetter) {
      errors.push("Password must contain at least one letter");
    }

    if (!hasNumber) {
      errors.push("Password must contain at least one number");
    }

    // Optional: require special characters for stronger passwords
    // if (!hasSpecialChar) {
    //     errors.push('Password must contain at least one special character');
    // }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password),
    };
  }

  /**
   * Calculate password strength score
   */
  static calculatePasswordStrength(password) {
    let score = 0;

    // Length
    if (password.length >= 8) score += 2;
    else if (password.length >= 6) score += 1;

    // Character types
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 2;

    // Complexity
    if (password.length >= 12) score += 1;

    if (score <= 2) return "weak";
    if (score <= 4) return "medium";
    if (score <= 6) return "strong";
    return "very_strong";
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input) {
    if (typeof input !== "string") return input;

    return input
      .trim()
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate email format (more comprehensive than Joi)
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);

    return {
      isValid,
      error: isValid ? null : "Invalid email format",
    };
  }

  /**
   * Check if text contains prohibited content
   */
  static containsProhibitedContent(text) {
    const prohibitedPatterns = [
      /spam/i,
      /hack/i,
      /fraud/i,
      // Add more patterns as needed
    ];

    return prohibitedPatterns.some((pattern) => pattern.test(text));
  }
}

module.exports = {
  ValidationUtils,
};
