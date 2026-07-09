// THIS FILE IS A PLACEHOLDER - the auth team decides whether to use it, modify it, or replace it entirely
// do not add any logic here without consulting the auth team first

// what a guard does in NestJS:
// a guard is a gatekeeper - NestJS calls it automatically before the controller method runs
// if the guard returns false, the request is rejected (401 Unauthorized) before reaching the controller
// it would typically validate the token sent by the frontend (JWT or session cookie)
// and confirm the user is authenticated before allowing access to the route

// HARD BLOCKER for the PR that adds the first real route handler (not just this file's
// problem to fix later): every controller in this codebase has TODOs that assume
// req.user.id exists (ownership/membership checks - see notifications, projects, tasks,
// etc.). None of that works without a real guard wired globally in app.module.ts's
// providers array (alongside ThrottlerGuard, as { provide: APP_GUARD, useClass: ... }).
// Shipping even one real handler before this exists means that route is open to
// unauthenticated callers, regardless of what its own TODO comments say.
