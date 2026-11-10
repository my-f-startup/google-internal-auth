# @my-f-startup/google-internal-auth

Authentication of internal calls between Google Cloud services.

A Cloud Run service often has routes that only another Google service may call: a job triggered by Cloud Scheduler, a Pub/Sub push subscription, another service. Those callers send an ID token issued by Google for the service account they run as, with the URL of the target service as audience. This package accepts a request only when that token is valid for the audience of the service and its verified email is in the list of allowed callers.

---

## Why this exists

Cloud Run services that sit behind a gateway such as Firebase Hosting must accept requests at the platform level, so the platform does not check who calls an internal route. Each service checks it itself. The Google auth library verifies the signature and the audience of the token; the rest is the same in every service: read the bearer token, require the verified email of an allowed caller, reject everything when nothing is configured, read the configuration from the environment, and skip the check against the emulators, where no Google token exists. This package holds that once.

---

## Features

- ✅ **Signature and audience** – verified by the Google auth library
- ✅ **Allowed callers** – the verified email of the token must be in the list
- ✅ **Closed by default** – without an audience or allowed callers, every request is rejected
- ✅ **Environment configuration** – `INTERNAL_ALLOWED_CALLERS` and `INTERNAL_AUDIENCE`
- ✅ **Local development** – the check is skipped when an emulator host is configured
- ✅ **Two shapes** – a function that answers `true` or `false`, usable as an OpenAPI security handler, and an Express style middleware

---

## Installation

```bash
npm install @my-f-startup/google-internal-auth
```

---

## Quick Start

As the security handler of an OpenAPI validator (for example `express-openapi-validator`):

```ts
import {
  createInternalAuthHandler,
  internalAuthOptionsFromEnvironment,
} from "@my-f-startup/google-internal-auth";

const validateSecurity = {
  handlers: {
    internalAuth: createInternalAuthHandler(internalAuthOptionsFromEnvironment()),
  },
};
```

As an Express middleware:

```ts
import { internalAuthMiddleware, internalAuthOptionsFromEnvironment } from "@my-f-startup/google-internal-auth";

app.post("/internal/jobs/publish-outbox", internalAuthMiddleware(internalAuthOptionsFromEnvironment()), handler);
```

---

## API

### `createInternalAuthHandler(options)`

Returns `(req) => Promise<boolean>`. A request is accepted when it has `Authorization: Bearer <token>`, the token is valid for `audience`, and its email is verified and listed in `allowedCallers`.

| Option | Type | Description |
| --- | --- | --- |
| `allowedCallers` | `string[]` | Emails of the service accounts allowed to call. Empty rejects every request |
| `audience` | `string` | Audience the token must be issued for: the URL of the service. Missing rejects every request |
| `skip` | `boolean` | Accept every request, for local development |
| `verifier` | `IdTokenVerifier` | Verifies the token. Defaults to the `OAuth2Client` of the Google auth library; tests pass a fake |

### `internalAuthOptionsFromEnvironment(environment?)`

Reads `INTERNAL_ALLOWED_CALLERS` (comma separated emails) and `INTERNAL_AUDIENCE`. `skip` is `true` when `FIRESTORE_EMULATOR_HOST`, `FIREBASE_DATABASE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` or `PUBSUB_EMULATOR_HOST` is set.

### `internalAuthMiddleware(options)`

Calls `next()` for an accepted request and answers 401 otherwise.

---

## Tests

- Unit: `npm run test:unit`
- All tests: `npm test`

The check against a real token issued by Google runs only in a deployed environment.

---

## Compatibility

- Node.js: >= 20

---

## Changelog

The [CHANGELOG.md](CHANGELOG.md) file is **automatically generated** during pull requests from Conventional Commits (`feat`, `fix`, `refactor`, `perf`). Do not edit it manually.

---

Made with ❤️ by My F* Startup
