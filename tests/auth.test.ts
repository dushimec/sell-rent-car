import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import {
  authRouter,
  createResetTokenForTestOrRecovery,
  requireAuth,
} from '../src/server/routes/authRoutes.ts';

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.post('/api/protected-check', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

test('auth session endpoint rejects malformed/forged Firebase ID tokens and protects guarded routes', async () => {
  await withServer(async (baseUrl) => {
    const missingAuth = await fetch(`${baseUrl}/api/protected-check`, { method: 'POST' });
    assert.equal(missingAuth.status, 401);

    const invalidSessionGet = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer forged.jwt.token' },
    });
    assert.equal(invalidSessionGet.status, 401);

    const invalidExchange = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'not-a-valid-firebase-id-token-string', rememberMe: true }),
    });
    assert.equal(invalidExchange.status, 401);

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(logoutRes.status, 200);
  });
});

test('forgot-password endpoint enforces valid email and never enumerates accounts', async () => {
  await withServer(async (baseUrl) => {
    const badEmailRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email' }),
    });
    assert.equal(badEmailRes.status, 400);

    const resA = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'existing.user@example.com' }),
    });
    const resB = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.user@example.com' }),
    });

    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    const bodyA = await resA.json();
    const bodyB = await resB.json();
    assert.equal(bodyA.message, bodyB.message);
  });
});

test('reset-password/validate enforces password complexity, expiry, and single-use tokens', async () => {
  await withServer(async (baseUrl) => {
    const { token: validToken } = createResetTokenForTestOrRecovery('client@example.com', 60_000);
    const { token: expiredToken } = createResetTokenForTestOrRecovery('client@example.com', -1000);

    // Weak password rejected
    const weakRes = await fetch(`${baseUrl}/api/auth/reset-password/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        newPassword: 'weak',
        confirmPassword: 'weak',
      }),
    });
    assert.equal(weakRes.status, 400);

    // Expired token rejected
    const expiredRes = await fetch(`${baseUrl}/api/auth/reset-password/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: expiredToken,
        newPassword: 'StrongPassword1',
        confirmPassword: 'StrongPassword1',
      }),
    });
    assert.equal(expiredRes.status, 400);

    // Valid token + strong matching password succeeds once
    const okRes = await fetch(`${baseUrl}/api/auth/reset-password/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        newPassword: 'StrongPassword1',
        confirmPassword: 'StrongPassword1',
      }),
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.valid, true);

    // Replay of already-consumed token must be rejected
    const replayRes = await fetch(`${baseUrl}/api/auth/reset-password/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        newPassword: 'StrongPassword1',
        confirmPassword: 'StrongPassword1',
      }),
    });
    assert.equal(replayRes.status, 400);
  });
});

test('auth config diagnostics reports projectId, authDomain, and respects env custom auth domain overrides without exposing secrets', async () => {
  await withServer(async (baseUrl) => {
    const prevAuthDomain = process.env.FIREBASE_AUTH_DOMAIN;
    const prevWebsite = process.env.BUSINESS_WEBSITE_DOMAIN;

    try {
      process.env.FIREBASE_AUTH_DOMAIN = 'auth.dealership.rw';
      process.env.BUSINESS_WEBSITE_DOMAIN = 'www.dealership.rw';

      const res = await fetch(`${baseUrl}/api/auth/config`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.authDomain, 'auth.dealership.rw');
      assert.equal(data.websiteDomain, 'www.dealership.rw');
      assert.equal(data.usingDefaultFirebaseDomain, false);
      assert.equal(data.expectedRedirectUri, 'https://auth.dealership.rw/__/auth/handler');
      assert.equal('apiKey' in data, false);
      assert.equal('clientSecret' in data, false);
    } finally {
      if (prevAuthDomain === undefined) delete process.env.FIREBASE_AUTH_DOMAIN;
      else process.env.FIREBASE_AUTH_DOMAIN = prevAuthDomain;
      if (prevWebsite === undefined) delete process.env.BUSINESS_WEBSITE_DOMAIN;
      else process.env.BUSINESS_WEBSITE_DOMAIN = prevWebsite;
    }
  });
});
