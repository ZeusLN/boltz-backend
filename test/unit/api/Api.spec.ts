import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { brotliCompressSync, deflateSync, gzipSync } from 'zlib';
import Logger from '../../../lib/Logger';
import { createJsonParser, handleUnhandledError } from '../../../lib/api/Api';
import { mockRequest, mockResponse } from './Utils';

describe('Api', () => {
  describe('createJsonParser', () => {
    let server: Server;
    let url: string;

    beforeAll(async () => {
      const app = express();
      app.use(createJsonParser());
      app.post('/', (req: Request, res: Response) => {
        res.json({ body: req.body, rawBody: (req as any).rawBody });
      });
      app.use((error: any, req: Request, res: Response, next: NextFunction) =>
        handleUnhandledError(Logger.disabledLogger, error, req, res, next),
      );

      server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const payload = JSON.stringify({ some: 'data' });

    test('should parse plain JSON bodies and set rawBody', async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      expect(res.status).toEqual(200);
      await expect(res.json()).resolves.toEqual({
        body: { some: 'data' },
        rawBody: payload,
      });
    });

    test('should parse JSON bodies with identity Content-Encoding', async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'identity',
        },
        body: payload,
      });

      expect(res.status).toEqual(200);
      await expect(res.json()).resolves.toEqual({
        body: { some: 'data' },
        rawBody: payload,
      });
    });

    test.each`
      encoding     | compress
      ${'br'}      | ${brotliCompressSync}
      ${'gzip'}    | ${gzipSync}
      ${'deflate'} | ${deflateSync}
    `(
      'should reject bodies with Content-Encoding $encoding with 415',
      async ({ encoding, compress }) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Encoding': encoding,
          },
          body: compress(Buffer.from(payload)),
        });

        expect(res.status).toEqual(415);
        await expect(res.json()).resolves.toEqual({
          error: 'content encoding unsupported',
        });
      },
    );
  });

  describe('handleUnhandledError', () => {
    test('should forward to next when headers were already sent', () => {
      const req = mockRequest({});
      const res = mockResponse();
      (res as any).headersSent = true;
      const next = jest.fn();
      const error = new Error('some error');

      handleUnhandledError(Logger.disabledLogger, error, req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should respond with the status code of the error, e.g. Range Not Satisfiable', () => {
      const req = mockRequest({});
      const res = mockResponse();
      const next = jest.fn();

      const error: any = new Error('Range Not Satisfiable');
      error.status = 416;

      handleUnhandledError(Logger.disabledLogger, error, req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(416);
      expect(res.json).toHaveBeenCalledWith({ error: error.message });
    });

    test('should fall back to statusCode when status is not set', () => {
      const req = mockRequest({});
      const res = mockResponse();
      const next = jest.fn();

      const error: any = new Error('Teapot');
      error.statusCode = 418;

      handleUnhandledError(Logger.disabledLogger, error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(418);
      expect(res.json).toHaveBeenCalledWith({ error: error.message });
    });

    test('should fall back to 500 when neither status nor statusCode is set', () => {
      const req = mockRequest({});
      const res = mockResponse();
      const next = jest.fn();

      const error = new Error('unknown error');

      handleUnhandledError(Logger.disabledLogger, error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: error.message });
    });
  });
});
