import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInternalAuthHandler,
  internalAuthMiddleware,
  internalAuthOptionsFromEnvironment,
  type IdTokenVerifier,
} from "../src";

const AUDIENCE = "https://orders-service.example.run.app";
const SCHEDULER = "scheduler@project.iam.gserviceaccount.com";

const verifierReturning = (payload: { email?: string; email_verified?: boolean } | undefined): IdTokenVerifier => ({
  verifyIdToken: () => Promise.resolve({ getPayload: () => payload }),
});

const bearer = (token = "token") => ({ headers: { authorization: `Bearer ${token}` } });

void describe("createInternalAuthHandler", () => {
  void it("accepts a verified token of an allowed caller", async () => {
    const handler = createInternalAuthHandler({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: verifierReturning({ email: SCHEDULER, email_verified: true }),
    });

    assert.equal(await handler(bearer()), true);
  });

  void it("passes the token and the audience to the verification", async () => {
    let received: { idToken: string; audience: string } | undefined;
    const handler = createInternalAuthHandler({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: {
        verifyIdToken: (options) => {
          received = options;
          return Promise.resolve({ getPayload: () => ({ email: SCHEDULER, email_verified: true }) });
        },
      },
    });

    await handler(bearer("abc"));

    assert.deepEqual(received, { idToken: "abc", audience: AUDIENCE });
  });

  void it("rejects a caller that is not allowed", async () => {
    const handler = createInternalAuthHandler({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: verifierReturning({ email: "other@project.iam.gserviceaccount.com", email_verified: true }),
    });

    assert.equal(await handler(bearer()), false);
  });

  void it("rejects an email that is not verified", async () => {
    const handler = createInternalAuthHandler({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: verifierReturning({ email: SCHEDULER, email_verified: false }),
    });

    assert.equal(await handler(bearer()), false);
  });

  void it("rejects a token that fails verification", async () => {
    const handler = createInternalAuthHandler({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: { verifyIdToken: () => Promise.reject(new Error("Wrong recipient")) },
    });

    assert.equal(await handler(bearer()), false);
  });

  void it("rejects a request without a bearer token", async () => {
    const handler = createInternalAuthHandler({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: verifierReturning({ email: SCHEDULER, email_verified: true }),
    });

    assert.equal(await handler({ headers: {} }), false);
  });

  void it("rejects everything when the audience or the allowed callers are not configured", async () => {
    const verifier = verifierReturning({ email: SCHEDULER, email_verified: true });

    assert.equal(await createInternalAuthHandler({ allowedCallers: [SCHEDULER], verifier })(bearer()), false);
    assert.equal(
      await createInternalAuthHandler({ allowedCallers: [], audience: AUDIENCE, verifier })(bearer()),
      false
    );
  });

  void it("accepts any request when it is told to skip the check", async () => {
    const handler = createInternalAuthHandler({ allowedCallers: [], skip: true });

    assert.equal(await handler({ headers: {} }), true);
  });
});

void describe("internalAuthOptionsFromEnvironment", () => {
  void it("reads the allowed callers and the audience", () => {
    const options = internalAuthOptionsFromEnvironment({
      INTERNAL_ALLOWED_CALLERS: ` ${SCHEDULER} , other@project.iam.gserviceaccount.com ,`,
      INTERNAL_AUDIENCE: AUDIENCE,
    });

    assert.deepEqual(options.allowedCallers, [SCHEDULER, "other@project.iam.gserviceaccount.com"]);
    assert.equal(options.audience, AUDIENCE);
    assert.equal(options.skip, false);
  });

  void it("skips the check when an emulator is configured", () => {
    for (const name of [
      "FIRESTORE_EMULATOR_HOST",
      "FIREBASE_DATABASE_EMULATOR_HOST",
      "FIREBASE_AUTH_EMULATOR_HOST",
      "PUBSUB_EMULATOR_HOST",
    ]) {
      assert.equal(internalAuthOptionsFromEnvironment({ [name]: "localhost:1234" }).skip, true, name);
    }
  });

  void it("has no allowed callers when the variable is missing", () => {
    assert.deepEqual(internalAuthOptionsFromEnvironment({}).allowedCallers, []);
  });
});

void describe("internalAuthMiddleware", () => {
  const run = (middleware: ReturnType<typeof internalAuthMiddleware>, req: { headers: { authorization?: string } }) =>
    new Promise<{ next: boolean; status?: number }>((resolve) => {
      middleware(req, { status: (code) => ({ end: () => resolve({ next: false, status: code }) }) }, () =>
        resolve({ next: true })
      );
    });

  void it("calls next for an accepted request", async () => {
    const middleware = internalAuthMiddleware({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: verifierReturning({ email: SCHEDULER, email_verified: true }),
    });

    assert.deepEqual(await run(middleware, bearer()), { next: true });
  });

  void it("answers 401 for a rejected request", async () => {
    const middleware = internalAuthMiddleware({
      allowedCallers: [SCHEDULER],
      audience: AUDIENCE,
      verifier: verifierReturning({ email: "other@project.iam.gserviceaccount.com", email_verified: true }),
    });

    assert.deepEqual(await run(middleware, bearer()), { next: false, status: 401 });
  });

  void it("answers 401 without a token", async () => {
    const middleware = internalAuthMiddleware({ allowedCallers: [SCHEDULER], audience: AUDIENCE });

    assert.deepEqual(await run(middleware, { headers: {} }), { next: false, status: 401 });
  });
});
