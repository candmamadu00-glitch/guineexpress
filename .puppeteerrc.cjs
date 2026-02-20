const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Diz para o Puppeteer salvar o Chrome dentro da nossa pasta do projeto!
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};