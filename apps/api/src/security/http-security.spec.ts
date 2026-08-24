import type { NextFunction, Request, Response } from 'express';
import {
  createRateLimitMiddleware,
  getTrustProxySetting,
} from './http-security';

describe('http security', () => {
  const originalAggregateIpLimit = process.env.API_AGGREGATE_IP_RATE_LIMIT;
  const originalAuthLimit = process.env.AUTH_RATE_LIMIT;
  const originalTrustProxyHops = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (originalAggregateIpLimit === undefined)
      delete process.env.API_AGGREGATE_IP_RATE_LIMIT;
    else process.env.API_AGGREGATE_IP_RATE_LIMIT = originalAggregateIpLimit;

    if (originalAuthLimit === undefined) delete process.env.AUTH_RATE_LIMIT;
    else process.env.AUTH_RATE_LIMIT = originalAuthLimit;

    if (originalTrustProxyHops === undefined)
      delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalTrustProxyHops;
  });

  it('no confia en X-Forwarded-For cuando Express no lo valido', () => {
    process.env.AUTH_RATE_LIMIT = '2';
    const middleware = createRateLimitMiddleware();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn().mockReturnThis();
    const response = {
      json,
      setHeader: jest.fn(),
      status,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    for (const spoofedIp of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      middleware(
        {
          headers: { 'x-forwarded-for': spoofedIp },
          ip: '203.0.113.77',
          method: 'POST',
          path: '/auth/login',
          socket: { remoteAddress: '203.0.113.77' },
        } as unknown as Request,
        response,
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 }),
    );
  });

  it('rechaza una configuracion de proxy ambigua', () => {
    process.env.TRUST_PROXY_HOPS = 'many';
    expect(() => getTrustProxySetting()).toThrow('TRUST_PROXY_HOPS');
  });

  it('aplica simultaneamente el limite por IP y por cuenta publica', () => {
    process.env.AUTH_RATE_LIMIT = '2';
    const middleware = createRateLimitMiddleware();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn().mockReturnThis();
    const response = {
      json,
      setHeader: jest.fn(),
      status,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    for (const email of [
      'uno@example.com',
      'dos@example.com',
      'tres@example.com',
    ]) {
      middleware(
        {
          body: { email },
          headers: { authorization: `Bearer ${email}` },
          ip: '203.0.113.88',
          method: 'POST',
          path: '/auth/login',
          socket: { remoteAddress: '203.0.113.88' },
        } as unknown as Request,
        response,
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledWith(429);
  });

  it('mantiene un limite agregado por IP aunque roten Bearer privados', () => {
    process.env.API_AGGREGATE_IP_RATE_LIMIT = '2';
    const middleware = createRateLimitMiddleware();
    const status = jest.fn().mockReturnThis();
    const response = {
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      status,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    for (const token of ['token-uno', 'token-dos', 'token-tres']) {
      middleware(
        {
          headers: { authorization: `Bearer ${token}` },
          ip: '203.0.113.99',
          method: 'GET',
          path: '/usuarios',
          socket: { remoteAddress: '203.0.113.99' },
        } as unknown as Request,
        response,
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledWith(429);
  });
});
