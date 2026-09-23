import { onRequest } from 'firebase-functions/v2/https';

let server: any;

async function getServer() {
  if (!server) {
    const express = require('express');
    const { NestFactory } = require('@nestjs/core');
    const { ValidationPipe } = require('@nestjs/common');
    const { ExpressAdapter } = require('@nestjs/platform-express');
    const { AppModule } = require('./app.module');

    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableCors({ origin: true, credentials: true });
    await app.init();
    server = expressApp;
  }
  return server;
}

export const api = onRequest({ invoker: 'public' }, async (req, res) => {
  const app = await getServer();
  app(req, res);
});
