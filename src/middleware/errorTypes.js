class BaseError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends BaseError {
    constructor(message) {
        super(message, 400, true);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed') {
        super(message, 401, true);
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends BaseError {
    constructor(message = 'Not authorized') {
        super(message, 403, true);
        this.name = 'AuthorizationError';
    }
}

class NotFoundError extends BaseError {
    constructor(message) {
        super(message, 404, true);
        this.name = 'NotFoundError';
    }
}

class ConflictError extends BaseError {
    constructor(message) {
        super(message, 409, true);
        this.name = 'ConflictError';
    }
}

class DatabaseError extends BaseError {
    constructor(message = 'Database operation failed') {
        super(message, 500, true);
        this.name = 'DatabaseError';
    }
}

class BusinessLogicError extends BaseError {
    constructor(message) {
        super(message, 422, true);
        this.name = 'BusinessLogicError';
    }
}

module.exports = {
    BaseError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    DatabaseError,
    BusinessLogicError
};
