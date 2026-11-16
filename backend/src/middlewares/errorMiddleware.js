const { StatusCodes } = require("http-status-codes");
const logger = require("../observability/logger");

const notFound = (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
};

// Maps well-known library errors to client errors instead of a 500.
const normalize = (err) => {
  // Body-parser errors carry their own status but expose the parser's message.
  if (err.type === "entity.parse.failed") {
    return { statusCode: StatusCodes.BAD_REQUEST, message: "Malformed JSON body" };
  }
  if (err.type === "entity.too.large") {
    return { statusCode: StatusCodes.REQUEST_TOO_LONG, message: "Request body too large" };
  }
  if (err.statusCode) {
    return err;
  }
  if (err.name === "CastError") {
    return { statusCode: StatusCodes.BAD_REQUEST, message: `Invalid ${err.path}` };
  }
  if (err.name === "ValidationError") {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Validation failed",
      details: Object.values(err.errors || {}).map((item) => ({ path: item.path, msg: item.message })),
    };
  }
  if (err.code === 11000) {
    return {
      statusCode: StatusCodes.CONFLICT,
      message: `${Object.keys(err.keyValue || {}).join(", ") || "Value"} already exists`,
    };
  }
  return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, message: err.message };
};

const errorHandler = (err, req, res, _next) => {
  const normalized = normalize(err);
  const statusCode = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const isServerError = statusCode >= 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (isServerError) {
    // Logged with the request id, so a user's report can be traced to this line.
    (req.log || logger).error({ err, requestId: req.id }, "Unhandled error");
  }

  res.status(statusCode).json({
    success: false,
    // Internal error messages can expose implementation details; hide them in production.
    message: isServerError && isProduction ? "Something went wrong" : normalized.message || "Something went wrong",
    details: normalized.details || null,
    requestId: req.id,
    stack: isProduction ? undefined : err.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
