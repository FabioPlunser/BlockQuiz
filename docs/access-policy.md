# Access Policy

BlockQuiz separates public guest play from authenticated school workflows.

## Public Routes

These routes are available without a session:

- `/login`: sign in and password-help information.
- `/privacy`: privacy information.
- `/demo`: public guest play for published courses and published exercises.
- `/api/auth/*`: Better Auth endpoints required for authentication.

## Authenticated Routes

These routes require an active user session:

- `/`: authenticated app landing page.
- `/courses`: assigned course play and authenticated progress.
- `/settings`: account/help hub.
- `/test`: internal canvas test page.

## Role-Protected Routes

Server-side route loads and remote functions enforce role checks for sensitive areas and operations:

- `/cms`: teacher, author, or admin content management.
- `/users`: admin-only user management.
- `/logs`: admin-only application logs.

Inactive users are treated as unauthenticated and redirected to `/login`.

Public course play intentionally starts at `/demo`; there is no separate shareable public course URL in this thesis build.
