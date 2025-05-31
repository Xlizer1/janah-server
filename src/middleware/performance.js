const performanceMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  // Add performance tracking to response
  const originalJson = res.json;
  res.json = function (body) {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds

    // Add performance data to response
    if (body && typeof body === "object") {
      body._performance = {
        response_time_ms: Math.round(duration * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    }

    // Log slow requests
    if (duration > 1000) {
      // Log requests slower than 1 second
      console.warn(
        `Slow request detected: ${req.method} ${req.url} - ${duration}ms`
      );
    }

    originalJson.call(this, body);
  };

  next();
};

module.exports = {
  performanceMiddleware,
};
