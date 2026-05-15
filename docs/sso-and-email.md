# SSO & Email Setup

## Email transport

The app sends transactional email (currently just password resets) through a
small driver layer in `src/lib/server/email/`. Admins pick the driver and
credentials from **Settings → Outbound email** (`/settings`). Values are
stored in the `app_settings` table and can be overridden at any time with the
env vars below — when an env var is set, it wins and the UI shows an
`env override` badge so admins know the form input is read-only.

| Driver  | When to use                                            |
| ------- | ------------------------------------------------------ |
| `file`  | Default. Writes `.txt` files to `data/outbox/`.        |
| `smtp`  | Generic SMTP. Works with Gmail using an app password.  |
| `graph` | Microsoft Graph `sendMail` for Entra ID tenants.       |

If a configured driver fails at send time, the message falls back to the
`file` driver so reset links are never lost during a misconfiguration.

### Gmail (SMTP)

1. Enable 2-Step Verification on the Google account.
2. Create an [App Password](https://myaccount.google.com/apppasswords).
3. Set:

   ```
   EMAIL_DRIVER=smtp
   EMAIL_FROM=BlockQuiz <your-account@gmail.com>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-account@gmail.com
   SMTP_PASSWORD=<16-char app password>
   ```

### Entra ID (Microsoft Graph)

1. **Entra admin centre → App registrations → New registration.**
2. **API permissions →** add `Mail.Send` *(Application)* and grant admin
   consent.
3. **Certificates & secrets →** create a client secret.
4. Pick a licensed mailbox to send as (e.g. `noreply@school.onmicrosoft.com`).
   For tighter control, scope the app to that single mailbox using an
   [Application Access Policy](https://learn.microsoft.com/graph/auth-limit-mailbox-access).
5. Set:

   ```
   EMAIL_DRIVER=graph
   GRAPH_TENANT_ID=<directory-tenant-id>
   GRAPH_CLIENT_ID=<application-client-id>
   GRAPH_CLIENT_SECRET=<client-secret>
   GRAPH_FROM_USER=noreply@school.onmicrosoft.com
   ```

## SSO (OIDC + SAML)

Authentication uses Better Auth with the `@better-auth/sso` plugin. Provider
records live in the `ssoProvider` table; users sign in via the plugin's
`/api/auth/sso/sign-in/sso` endpoint with either an email (domain lookup) or
explicit `providerId`.

### Just-in-time (JIT) provisioning

On every successful SSO login, `provisionUser` in `src/lib/server/auth.ts`
maps the IdP's `groups`/`roles` claim to a BlockQuiz role using these env
vars (comma-separated values, matched case-sensitively):

```
SSO_ROLE_MAP_ADMIN=BlockQuiz-Admins
SSO_ROLE_MAP_AUTHOR=ContentAuthors
SSO_ROLE_MAP_TEACHER=Teachers,Lehrer
```

A user with no matching group falls through to `student`. Group changes in
the IdP propagate at the next login (the callback runs on every sign-in).

The app **never** stores or imports passwords from AD/Entra; the IdP holds
the credential and the app trusts the assertion.

### Registering providers

Admins manage OIDC providers from **Settings → Single sign-on** (`/settings`).
The form stores records directly in the `ssoProvider` table that the Better
Auth `@better-auth/sso` plugin reads from at login time. SAML providers and
programmatic registration still use the plugin's own endpoints (admin-only,
requires a logged-in admin session):

- `POST /api/auth/sso/register-oidc-provider`
- `POST /api/auth/sso/register-saml-provider`

#### Entra ID (OIDC)

App registration redirect URI: `<BETTER_AUTH_URL>/api/auth/sso/callback/<providerId>`.

```jsonc
POST /api/auth/sso/register-oidc-provider
{
  "providerId": "entra-school-a",
  "issuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
  "domain": "school-a.example",
  "oidcConfig": {
    "clientId": "<entra-client-id>",
    "clientSecret": "<entra-client-secret>",
    "discoveryEndpoint": "https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration",
    "scopes": ["openid", "profile", "email"]
  }
}
```

To get group claims, configure the Entra app's **Token configuration** to
include the `groups` claim (or app roles via `roles`).

#### ADFS / generic SAML

```jsonc
POST /api/auth/sso/register-saml-provider
{
  "providerId": "adfs-school-b",
  "issuer": "https://adfs.school-b.example/adfs/services/trust",
  "domain": "school-b.example",
  "samlConfig": {
    "idpMetadata": "<paste IdP metadata XML or URL>",
    "spEntityId": "<BETTER_AUTH_URL>",
    "callbackUrl": "<BETTER_AUTH_URL>/api/auth/sso/callback/adfs-school-b"
  }
}
```

Map ADFS group claims onto a `groups` attribute statement so the JIT role
mapping works.

### Sign-in from the client

```ts
import { authClient } from '$lib/client/auth';
await authClient.signIn.sso({
  email: 'user@school-a.example',          // domain → provider lookup
  callbackURL: '/'
});
```

## Future work: SCIM

For schools that need pre-provisioning, deprovisioning, or automatic class
roster sync (e.g. mapping Entra groups → BlockQuiz courses), expose a
SCIM 2.0 endpoint at `/scim/v2`. Entra/Okta push `Users` and `Groups`
on a schedule; the JIT path stays as a fallback for first-time logins
between syncs. Estimated effort: ~1 week including testing against
Entra's quirks.
