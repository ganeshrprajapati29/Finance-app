class ClubAPIError extends Error {
  constructor(message, statusCode = 500, originalError = null) {
    super(message);
    this.name = 'ClubAPIError';
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

const handleClubAPIError = (error, req, res, next) => {
  console.error('ClubAPI Error:', error);

  if (error instanceof ClubAPIError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: error.originalError?.message || null
    });
  }

  // Handle axios errors
  if (error.response) {
    return res.status(error.response.status).json({
      success: false,
      message: 'ClubAPI service error',
      error: error.response.data
    });
  }

  // Handle network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      message: 'ClubAPI service unavailable',
      error: 'Service temporarily unavailable'
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid request data',
      error: error.message
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
};

export {
  ClubAPIError,
  handleClubAPIError
};
