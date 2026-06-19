export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface DraftReport {
  id: string;
  title: string;
  markdown: string;
  severity: Severity;
  vulnType: string;
  target?: string;
  lastSaved: string;
  createdAt: string;
}

export interface GithubTemplate {
  name: string;
  path: string;
  sha: string;
  download_url: string;
  html_url: string;
  type: string;
}

export const FALLBACK_TEMPLATES = [
  {
    name: "Report-1.md",
    title: "IDOR on /api/v1/users/{id}/profile Allows Unauthorized Access to User PII",
    vulnType: "IDOR",
    severity: "High" as Severity,
    markdown: `# IDOR on \`/api/v1/users/{id}/profile\` allows unauthorized access to user PII

## Description

The \`/api/v1/users/{id}/profile\` endpoint fails to verify that the authenticated user matches the requested \`{id}\` parameter. By changing the user ID to another user's ID, an attacker can read that user's full profile, including name, email, phone number, and home address.

## Proof of Concept

\`\`\`
GET /api/v1/users/1337/profile HTTP/2
Host: app.example.com
Authorization: Bearer eyJ...
Content-Type: application/json

---

HTTP/2 200 OK

{
  "id": 1337,
  "name": "Integriti",
  "email": "hunter2@example.com",
  "phone": "+1-555-5555",
  "address": "1337 Hackers Ave"
}
\`\`\`

## Steps to Reproduce

1. Log in as user A (attacker) at app.example.com/login.
2. Navigate to your own profile and intercept the request to \`/api/v1/users/{your_id}/profile\`.
3. Change the user ID in the path to another user's ID (e.g., 1337).
4. Observe the full profile data of user 1337 in the response.

## Impact

Any authenticated user can read the full personal profile (name, email, phone, home address) of any other user on the platform by iterating over user IDs.
`
  },
  {
    name: "Report-2.md",
    title: "Disclosure of Hidden Admin Path /administrator-panel-yb556 via JavaScript",
    vulnType: "Information Disclosure",
    severity: "Low" as Severity,
    markdown: `# Disclosure of Hidden Admin Path \`/administrator-panel-yb556\` via JavaScript

## Description
Hiding admin functionality behind an obscure URL is **not** a security control. If the URL is embedded in client-side JavaScript, any user can discover it by viewing source or inspecting scripts.

Example:
\`\`\`
https://insecure-website.com/administrator-panel-yb556
\`\`\`

Exposed in client-side JS:
\`\`\`javascript
if (isAdmin) {
  var adminPanelTag = document.createElement('a');
  adminPanelTag.setAttribute('href', 'https://insecure-website.com/administrator-panel-yb556');
}
\`\`\`

## Steps to Reproduce
1. Open the homepage.
2. View source (\`view-source:\`) or inspect JS files.
3. Search for references to admin paths (e.g., \`/administrator-panel-...\`).
4. Open the discovered admin URL directly.

## Impact
Attackers can discover and attempt to access admin functionality, leading to privilege escalation if backend access controls are weak.

## Recommendation
- Do **not** rely on obscurity for admin paths.
- Remove admin URLs from client-side code.
- Enforce robust server-side authorization checks.
`
  },
  {
    name: "Report-3.md",
    title: "Unauthorized Access to Admin Panel via Client-Side Role Control",
    vulnType: "Privilege Escalation",
    severity: "High" as Severity,
    markdown: `# Unauthorized Access to Admin Panel via Client-Side Role Control

## Description

The application determines user privileges at login and stores them in a user-controllable location (e.g., hidden field, cookie, or query string parameter). This allows attackers to easily elevate their privileges by modifying these values, granting themselves unauthorized admin access. For example:

- \`https://insecure-website.com/login/home.jsp?admin=true\`
- Cookie: \`Admin=true\`

The following HTTP request shows the insecure usage of an \`Admin\` cookie:

\`\`\`
GET /admin HTTP/1.1
Host: ac961f1c1ef4adef80bd6a6c0000006c.web-security-academy.net
...
Cookie: session=DOOAJa8Mkf2EDu4mLoLImfnDaP5My8yS; Admin=false
...
\`\`\`

## Steps to Reproduce

1. Attempt to access \`/admin\` to confirm lack of access.
2. Log in via the standard user login page.
3. Intercept the login response (e.g., with Burp Suite) and observe the \`Admin=false\` cookie being set.
4. Modify the cookie to \`Admin=true\` and resend the request.
5. Access \`/admin\`—the user now has admin privileges.

## Impact

This vulnerability enables any user to gain administrative access by simply changing the client-side value, potentially resulting in privilege escalation, unauthorized actions (e.g., deleting users), and full system compromise.

## Recommendation

Implement server-side access control checks for all sensitive endpoints. Do not rely on user-modifiable data such as cookies or URL parameters for authorization decisions.
`
  },
  {
    name: "Report-4.md",
    title: "Bypassing Access Controls via X-Original-URL Header",
    vulnType: "Authentication Bypass",
    severity: "High" as Severity,
    markdown: `# Bypassing Access Controls via \`X-Original-URL\` Header

## Description

Some applications control access by restricting specific URLs and HTTP methods based on user roles (e.g., denying \`POST /admin/deleteUser\` for non-admins). However, these defenses can be bypassed if the app or its platform honors non-standard HTTP headers—like \`X-Original-URL\` or \`X-Rewrite-URL\`—used to override the requested URL.

If an application enforces access rules only at a front-end layer but allows the effective URL to be overridden by these headers, attackers can access admin endpoints with crafted requests:

\`\`\`
POST / HTTP/1.1
X-Original-URL: /admin/deleteUser
...
\`\`\`

Alternatively, an attacker could exploit the vulnerability as follows:

\`\`\`
GET /delete?username=carlos HTTP/1.1
Host: [target]
X-Original-URL: /admin
...
Cookie: session=[attacker-session-token]
\`\`\`

This effectively bypasses URL-based access controls by tricking the backend into processing an unauthorized request.

## Steps to Reproduce

1. Attempt to access \`/admin\` as a non-admin user—access should be denied.
2. Send the request to an intercepting proxy (e.g., Burp Repeater).
3. Change the request line to \`/\` and add the header \`X-Original-URL: /admin\`.
4. Observe successful access to the admin page.
5. To perform actions (e.g., deleting a user), add parameters to the query string and adjust \`X-Original-URL:\` (e.g., \`X-Original-URL: /admin/deleteUser\` and \`?username=carlos\`).

## Impact

This vulnerability allows unauthorized users to perform critical admin actions, such as deleting users or changing configurations. Attackers could compromise data, disrupt service, or take full control of the application.
`
  }
];
