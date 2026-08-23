function errorHandler(err, req, res, next) {
  console.error(`[Error] ${new Date().toISOString()} - ${err.message}`);
  console.error(err.stack);
  
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
}

module.exports = errorHandler;
