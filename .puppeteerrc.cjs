const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Diz ao Puppeteer para instalar e ler o Chrome sempre na mesma pasta oculta
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};