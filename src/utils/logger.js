const winston = require("winston");
const fs = require("fs");
const path = require("path");

const logDir = path.join(process.cwd(), "logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message }) => {
    return `${level} ${message}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",

  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),

    new winston.transports.File({
      filename: path.join(logDir, "scraper.log"),
      format: fileFormat,
    }),

    new winston.transports.File({
      filename: path.join(logDir, "errors.log"),
      level: "error",
      format: fileFormat,
    }),
  ],
});

module.exports = logger;