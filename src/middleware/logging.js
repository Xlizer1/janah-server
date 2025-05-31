const { Logger } = require('../utils/logger');

const requestLogger = (req, res, next) => {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    
    // Log the request
    Logger.info('Request received', {
        method,
        url,
        ip,
        userAgent: userAgent.substring(0, 100) // Truncate long user agents
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        
        Logger.info('Request completed', {
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            ip
        });
        
        // Call original end
        originalEnd.call(res, chunk, encoding);
    };
    
    next();
};

const apiRateLimit = (req, res, next) => {
    const isAdmin = req.user?.role === 'admin';
    const isAuthenticated = !!req.user;
    
    // Set different limits based on user type
    if (isAdmin) {
        req.rateLimit = { max: 1000, window: 3600 }; // 1000/hour for admins
    } else if (isAuthenticated) {
        req.rateLimit = { max: 300, window: 3600 }; // 300/hour for users
    } else {
        req.rateLimit = { max: 100, window: 3600 }; // 100/hour for guests
    }
    
    next();
};

module.exports = {
    requestLogger,
    apiRateLimit
}