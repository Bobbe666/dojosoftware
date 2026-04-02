/**
 * tdaSync.js - Stub
 */
const logger = require("./logger");
async function sendToTdaEvents(type, action, data) {
  logger.debug("tdaSync (stub)", { type, action });
  return null;
}
module.exports = { sendToTdaEvents };
