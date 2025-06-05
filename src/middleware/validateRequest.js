const validateRequest = (schema) => {
  return (req, res, next) => {
    const payload = {
      ...req.body,
      ...req.params,
      ...req.query,
      // image: req.file || req.files?.image
    };
    const { error } = schema.validate(payload);
    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
      });
    }
    next();
  };
};

module.exports = validateRequest;
