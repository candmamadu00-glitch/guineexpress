const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Mudámos o nome para não ter ponto. O Render não vai apagar isto!
  cacheDirectory: join(__dirname, 'chrome-cache'),
};