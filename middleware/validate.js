export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = source === 'query' ? req.query : req.body;

    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Replace with the validated (and default-filled) data
    if (source === 'query') {
      req.query = result.data;
    } else {
      req.body = result.data;
    }

    next();
  };
};