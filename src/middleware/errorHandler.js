const { resultObject } = require("../helpers/common");
const { AppError, DatabaseError } = require("../errors/customErrors");

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends AppError {
  constructor(message = "Not authorized") {
    super(message, 403);
    this.name = "AuthorizationError";
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
    this.name = "ConflictError";
  }
}

class BusinessLogicError extends AppError {
  constructor(message) {
    super(message, 422);
    this.name = "BusinessLogicError";
  }
}

class CustomError extends AppError {
  constructor(message, statusCode = 500) {
    super(message, statusCode);
    this.name = "CustomError";
  }
}

const logError = (err) => {
  console.error("Error:", {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    isOperational: err.isOperational,
  });
};

const handleError = (err, res) => {
  logError(err);

  // Handle specific error types
  if (err instanceof ValidationError) {
    return res.status(400).json(resultObject(null, err.message, false));
  }
  if (err instanceof AuthenticationError) {
    return res.status(401).json(resultObject(null, err.message, false));
  }
  if (err instanceof AuthorizationError) {
    return res.status(403).json(resultObject(null, err.message, false));
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json(resultObject(null, err.message, false));
  }
  if (err instanceof ConflictError) {
    return res.status(409).json(resultObject(null, err.message, false));
  }
  if (err instanceof BusinessLogicError) {
    return res.status(422).json(resultObject(null, err.message, false));
  }
  if (err instanceof DatabaseError) {
    return res.status(500).json(resultObject(null, err.message, false));
  }
  if (err instanceof CustomError) {
    return res
      .status(err.statusCode)
      .json(resultObject(null, err.message, false));
  }

  // Handle unknown errors
  return res
    .status(500)
    .json(resultObject(null, "Internal Server Error", false));
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => handleError(err, res));
  };
};

module.exports = {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  DatabaseError,
  CustomError,
  handleError,
  asyncHandler,
};
