class ResponseHelpers {
  /**
   * Standard success response
   */
  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      status: true,
      message,
      data,
    });
  }

  /**
   * Standard error response
   */
  static error(res, message, statusCode = 400, errors = null) {
    return res.status(statusCode).json({
      status: false,
      message,
      errors,
    });
  }

  /**
   * Pagination response
   */
  static paginated(res, message, items, pagination, statusCode = 200) {
    return res.status(statusCode).json({
      status: true,
      message,
      data: {
        items,
        pagination,
      },
    });
  }

  /**
   * Created response
   */
  static created(res, message, data = null) {
    return this.success(res, message, data, 201);
  }

  /**
   * No content response
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Unauthorized response
   */
  static unauthorized(res, message = "Unauthorized") {
    return this.error(res, message, 401);
  }

  /**
   * Forbidden response
   */
  static forbidden(res, message = "Forbidden") {
    return this.error(res, message, 403);
  }

  /**
   * Not found response
   */
  static notFound(res, message = "Resource not found") {
    return this.error(res, message, 404);
  }

  /**
   * Validation error response
   */
  static validationError(res, errors) {
    return this.error(res, "Validation failed", 400, errors);
  }

  /**
   * Rate limit error response
   */
  static rateLimitError(res, resetTime = null) {
    const message = resetTime
      ? `Too many requests. Try again after ${resetTime.toLocaleTimeString()}`
      : "Too many requests. Please try again later.";

    return this.error(res, message, 429);
  }
}

module.exports = {
  ResponseHelpers,
};
