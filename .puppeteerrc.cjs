const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Nome novo para forçar o Render a baixar TUDO de novo sem ler o cache corrompido!
 cacheDirectory: join(__dirname, 'motor-zap'),
};