# Agent Notes

## Local Development

- The canonical local stack is Docker Compose through the root Makefile.
- Start the application with `make up` from the repository root.
- Open the full local app at `http://localhost`; nginx is the published entrypoint on port `8080`.
- Use `make up-build` or the service-specific rebuild targets only when dependencies, Dockerfiles, or container setup changed.
- Do not use `make re` for routine checks. It removes Docker volumes and local database data.
- Do not run `npm run dev` from the repository root; there is no root `package.json`.
- For UI-only visual verification, it is acceptable to run `cd frontend && npm run dev -- --host 127.0.0.1`
and open `http://127.0.0.1:5173/`, but use it as a frontend-only convenience loop, not as the main project startup flow.

## Verification

- Prefer `make up`, `make ps`, and service logs when checking the integrated stack.
- Use `cd frontend && npm run build` to validate frontend TypeScript and Vite changes.
- Keep changes scoped and avoid resetting Docker volumes unless the user explicitly asks for a clean reset.