# Security policy

Please report suspected vulnerabilities privately to the repository owner (use GitHub's
"Report a vulnerability" under the Security tab) instead of opening a public issue.
Include steps to reproduce and the affected page or endpoint.

Secrets (`KITCHEN_*`, `ADMIN_*`, `TRACKING_SECRET`) must only be set through
`.dev.vars` locally and `wrangler secret put` in production. If one may have leaked,
rotate it immediately; rotating `KITCHEN_SESSION_SECRET` or `ADMIN_SESSION_SECRET`
signs everyone out, and rotating `TRACKING_SECRET` invalidates existing customers'
tracking passwords.
