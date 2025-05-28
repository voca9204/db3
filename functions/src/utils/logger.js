/**
 * Simple Logger for DB3 Project
 * Firebase Functions compatible logging
 */

const getContextLogger = () => {
  return {
    debug: (message, ...args) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] ${message}`, ...args);
      }
    },
    info: (message, ...args) => {
      console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message, ...args) => {
      console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message, ...args) => {
      console.error(`[ERROR] ${message}`, ...args);
    }
  };
};

module.exports = {
  getContextLogger
};
