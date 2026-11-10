import { OAuth2Client } from "google-auth-library";

export type IdTokenVerifier = {
  verifyIdToken: (options: { idToken: string; audience: string }) => Promise<{
    getPayload: () => { email?: string; email_verified?: boolean } | undefined;
  }>;
};

export type InternalAuthOptions = {
  /** Emails of the service accounts allowed to call the internal routes. */
  allowedCallers: readonly string[];
  /** Audience the token must be issued for: the URL of the service. */
  audience?: string;
  /** Accept every request, for local development against emulators. */
  skip?: boolean;
  /** Verifies the token. Defaults to the Google auth library, which checks the signature and the audience. */
  verifier?: IdTokenVerifier;
};

export type RequestWithHeaders = {
  headers: { authorization?: string };
};

const EMULATOR_VARIABLES = [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_DATABASE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "PUBSUB_EMULATOR_HOST",
];

/**
 * Checks a request to an internal route, such as a job called by Cloud Scheduler: it must carry a
 * bearer ID token issued by Google for `audience`, with the verified email of one of the
 * `allowedCallers`. Without an audience or allowed callers every request is rejected.
 *
 * The returned function answers `true` or `false`, so it can be used as the security handler of an
 * OpenAPI validator, or wrapped in a middleware with `internalAuthMiddleware`.
 */
export const createInternalAuthHandler = (options: InternalAuthOptions) => {
  const verifier: IdTokenVerifier = options.verifier ?? new OAuth2Client();

  return async (req: RequestWithHeaders): Promise<boolean> => {
    if (options.skip) return true;

    const { audience, allowedCallers } = options;
    const header = req.headers.authorization;
    if (!audience || allowedCallers.length === 0 || !header?.startsWith("Bearer ")) {
      return false;
    }

    try {
      const ticket = await verifier.verifyIdToken({
        idToken: header.substring("Bearer ".length),
        audience,
      });
      const payload = ticket.getPayload();

      return Boolean(payload?.email_verified && payload.email && allowedCallers.includes(payload.email));
    } catch {
      return false;
    }
  };
};

/**
 * Options from `INTERNAL_ALLOWED_CALLERS` (comma separated emails) and `INTERNAL_AUDIENCE`. The check
 * is skipped when an emulator host is configured, since there is no Google issued token against the
 * emulators.
 */
export const internalAuthOptionsFromEnvironment = (
  environment: NodeJS.ProcessEnv = process.env
): InternalAuthOptions => ({
  allowedCallers: (environment.INTERNAL_ALLOWED_CALLERS ?? "")
    .split(",")
    .map((caller) => caller.trim())
    .filter(Boolean),
  audience: environment.INTERNAL_AUDIENCE,
  skip: EMULATOR_VARIABLES.some((name) => Boolean(environment[name])),
});

type MiddlewareResponse = {
  status: (code: number) => { end: () => void };
};

/**
 * Express style middleware: calls `next()` for an accepted request and answers 401 otherwise.
 */
export const internalAuthMiddleware = (options: InternalAuthOptions) => {
  const isAllowed = createInternalAuthHandler(options);

  return (req: RequestWithHeaders, res: MiddlewareResponse, next: (error?: unknown) => void): void => {
    isAllowed(req).then(
      (allowed) => (allowed ? next() : res.status(401).end()),
      (error: unknown) => next(error)
    );
  };
};
