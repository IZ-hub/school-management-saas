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
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { rawBody: true });

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    const helmet = require('helmet');
    app.use((helmet.default ?? helmet)());
    // The site calls the API through Firebase Hosting on the same origin; only our own domains may call it cross-origin.
    app.enableCors({
      origin: [
        'https://school-management-1f070.web.app',
        'https://school-management-1f070.firebaseapp.com',
        ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o: string) => o.trim()) : []),
      ],
      credentials: true,
    });
    await app.init();
    server = expressApp;
  }
  return server;
}

export const api = onRequest({ invoker: 'public' }, async (req, res) => {
  const app = await getServer();
  app(req, res);
});
