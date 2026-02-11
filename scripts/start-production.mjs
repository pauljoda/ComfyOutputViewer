#!/usr/bin/env node

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

if (!process.env.SERVER_PORT && !process.env.PORT) {
  process.env.SERVER_PORT = '8008';
}

await import('../src/server/index.js');
