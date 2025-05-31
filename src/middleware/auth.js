const { verifyUserToken, resultObject } = require("../helpers/common");

const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!token) {
      return res
        .status(401)
        .json(resultObject(false, "Access token is required", null, 401));
    }

    // Verify token using the helper function
    const decoded = await verifyUserToken(token);

    if (!decoded) {
      return res
        .status(401)
        .json(resultObject(false, "Invalid or expired token", null, 401));
    }

    // Set user in request object
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(401)
      .json(resultObject(false, "Authentication failed", null, 401));
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(resultObject(false, "Authentication required", null, 401));
    }

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json(resultObject(false, "Admin access required", null, 403));
    }

    next();
  } catch (error) {
    console.error("Authorization error:", error);
    return res
      .status(403)
      .json(resultObject(false, "Access denied", null, 403));
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (token) {
      const decoded = await verifyUserToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
};
