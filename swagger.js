/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const packageJson = require('./package.json');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ZEUS Swaps API',
      version: packageJson.version,
    },
  },
  apis: ['./lib/api/v2/routers/*'],
  failOnErrors: true,
};

const specs = swaggerJsdoc(options);
specs.servers = [
  {
    url: 'https://swaps.zeuslsp.com/api/v2',
    description: 'Mainnet',
  },
  {
    url: 'https://testnet-swaps.zeuslsp.com/api/v2',
    description: 'Testnet',
  },
  {
    url: 'http://localhost:9006/v2',
    description: 'Regtest',
  },
];

fs.writeFileSync('swagger-spec.json', JSON.stringify(specs, undefined, 2));
