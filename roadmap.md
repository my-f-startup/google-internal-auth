# Roadmap

Work planned for this library, driven by the authentication rules of the my-f-startup reference architecture (`authentication.md`, section 3). The library stays generic: it knows nothing about a specific service or app.

Legend: Done, Open, Not verified.

| Item | Status | Evidence and note |
|---|---|---|
| Verify the ID token, the audience and the allowed callers | Done | `createInternalAuthHandler` (0.1.0), moved from the services bootstrap, where it had come from the user-service. Unit tests with a fake verifier |
| Express style middleware | Done | `internalAuthMiddleware` (0.1.0) |
| Lint and format check in CI | Done | `build_and_test` runs `lint` and `format:check` before the tests (0.1.0) |
| Publish the first version and make the bootstrap use it | Open | The services bootstrap re-exports it |
| Check against a real token issued by Google | Not verified | Runs in the real environment verification of a deployed service |
| Pub/Sub push subscriptions | Open | Push deliveries carry the same kind of token; not used by any service yet |
