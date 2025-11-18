MCP Personal API Keys – UX Flow & Wireframes

This document outlines the UX flow and screen-by-screen ASCII wireframes for the personal API key feature and the API key exchange flow, optimized for MCP integration.

---

## 1. UX Flow Map (High-Level)

```text
[User Dashboard / Shell]
	|
	v
[User Menu / Settings]
	|
	v
[API Access Page]
  |            |             |
  |            |             +--> [Edit API Key Modal]
  |            |
  |            +--> [Create API Key Modal]
  |
  +--> [Copy API Key Overlay]

[MCP Server Setup]
	|
	v
[User pastes API Key into MCP config]
	|
	v
[MCP → Exchange Flow]
	|
	v
[POST /api/auth/api-key/exchange]
	|
	v
[JWT Access Token Returned]
	|
	v
[MCP calls existing APIs with Bearer token]
```

---

## 2. API Access Entry Point in Shell

### 2.1 User Menu / Settings

```text
┌───────────────────────────────────────────────┐
│ User Menu                                    │
├───────────────────────────────────────────────┤
│ Profile                                      │
│ Security                                     │
│ Notifications                                │
│--------------------------------------------- │
│ API Access                                   │◄── New entry
│--------------------------------------------- │
│ Sign out                                     │
└───────────────────────────────────────────────┘
```

Action: Clicking "API Access" opens the API Access page within the existing account/settings area.

---

## 3. API Access Page – Overview

### 3.1 Layout

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Header                                                                    │
│───────────────────────────────────────────────────────────────────────────│
│ Title: API Access                                                         │
│ Subtitle: Manage your personal API keys for MCP and integrations.        │
│                                                                           │
│ [Org Selector:  v ]   (if user has multiple orgs)                         │
│                                                                           │
│ [ + Create API Key ]                                                      │
│                                                                           │
│───────────────────────────────────────────────────────────────────────────│
│ API Keys Table                                                            │
│                                                                           │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Name        | Prefix   | Org        | Status   | Last Used  | Actions │ │
│ │------------ |--------- |----------- |----------|----------- |---------│ │
│ │ MCP Server  | slk_abc1 | My Org A   | Active   | 2h ago     |  •••    │ │
│ │ Zapier Sync | slk_xyz9 | My Org B   | Revoked  | 1d ago     |  •••    │ │
│ │ ...         | ...      | ...        | ...      | ...        |  •••    │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│ Legend:                                                                   │
│  - Status: Active / Expired / Revoked                                     │
│  - Prefix: Short identifier shown instead of full key                     │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Row Actions Menu

```text
Row "Actions" (•••) menu:

┌───────────────────────┐
│ View details          │
│ Edit                  │
│ Revoke                │
└───────────────────────┘
```

---

## 4. Create API Key Flow

### 4.1 Create API Key Modal

Triggered by clicking `[ + Create API Key ]`.

```text
┌───────────────────────────────────────────────┐
│ Create API Key                               │
├───────────────────────────────────────────────┤
│ Name                                         │
│ [ MCP Server for My Org A              ]     │
│                                               │
│ Organization                                  │
│ [ My Org A           v ]                      │
│   (dropdown if multiple orgs; hidden if one)  │
│                                               │
│ Expiry                                        │
│ ( ) Never                                     │
│ (•) 90 days (recommended)                     │
│ ( ) 30 days                                   │
│ ( ) Custom: [        ] days                   │
│                                               │
│ (Advanced scopes - optional, v1 may omit)     │
│  [ ] Custom scopes                            │
│                                               │
│───────────────────────────────────────────────│
│ [ Cancel ]                      [ Create Key ]│
└───────────────────────────────────────────────┘
```

Validation: name required; organization required; expiry valid.

On success: Close this modal and open the "Copy API Key" overlay.

---

### 4.2 Copy API Key Overlay (Shown Once)

```text
┌───────────────────────────────────────────────┐
│ Your New API Key                             │
├───────────────────────────────────────────────┤
│ This key is shown only once.                 │
│ Copy and store it securely.                  │
│ If you lose it, you must create a new key.   │
│                                               │
│ API Key                                      │
│ [ slk_abcd1234efgh5678ijkl9012mnop3456      ]│
│                      [ Copy ]                │
│                                               │
│ Organization: My Org A                        │
│ Prefix: slk_abcd1                             │
│ Status: Active                                │
│ Expires: in 90 days                           │
│                                               │
│───────────────────────────────────────────────│
│ [ Close ]                                     │
└───────────────────────────────────────────────┘
```

Note: The list on the main API Access page shows only the prefix and metadata, never the full key.

---

## 5. Edit API Key Modal

Triggered from row action menu → "Edit".

```text
┌───────────────────────────────────────────────┐
│ Edit API Key                                 │
├───────────────────────────────────────────────┤
│ Name                                         │
│ [ MCP Server for My Org A              ]     │
│                                               │
│ Organization                                  │
│ [ My Org A           ] (read-only)           │
│                                               │
│ Expiry                                        │
│ ( ) Never                                     │
│ (•) 90 days                                   │
│ ( ) 30 days                                   │
│ ( ) Custom: [        ] days                   │
│                                               │
│ Scopes (for future use; v1 can default)       │
│ [x] Full access to org APIs                   │
│ [ ] Custom scopes (coming soon)               │
│                                               │
│ Status: Active / Expired / Revoked (read-only)│
│                                               │
│───────────────────────────────────────────────│
│ [ Cancel ]                      [ Save ]      │
└───────────────────────────────────────────────┘
```

---

## 6. Revoke API Key Confirmation

Triggered from row action menu → "Revoke".

```text
┌───────────────────────────────────────────────┐
│ Revoke API Key                               │
├───────────────────────────────────────────────┤
│ Are you sure you want to revoke this API key?│
│                                               │
│ Name: MCP Server for My Org A                │
│ Prefix: slk_abcd1                             │
│ Organization: My Org A                        │
│                                               │
│ Once revoked, this key can no longer be used. │
│                                               │
│───────────────────────────────────────────────│
│ [ Cancel ]                      [ Revoke ]    │
└───────────────────────────────────────────────┘
```

After revocation: status in table updates to "Revoked"; exchanges fail.

---

## 7. API Key Details View (Optional)

```text
┌─────────────────────────────────────────────────────────────┐
│ API Key Details                                             │
├─────────────────────────────────────────────────────────────┤
│ Name: MCP Server for My Org A                              │
│ Prefix: slk_abcd1                                           │
│ Organization: My Org A                                      │
│ Status: Active                                              │
│ Created: 2025-11-18                                         │
│ Last Used: 2 hours ago                                      │
│ Expires: 2026-02-16                                         │
│ Auth Method (tokens): api_key                               │
│                                                             │
│ Recent usage (optional):                                    │
│  - 2025-11-18 10:05: exchange from 192.0.2.10               │
│  - 2025-11-18 09:55: exchange from 192.0.2.10               │
│                                                             │
│ [ Revoke ]                                  [ Close ]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. MCP Exchange Flow (Conceptual UI)

Although the exchange is API-only, we illustrate it conceptually for clarity.

### 8.1 MCP Configuration (User Perspective)

```text
┌───────────────────────────────────────────────┐
│ MCP Server Configuration                     │
├───────────────────────────────────────────────┤
│ App Base URL                                 │
│ [ https://app.sololedger.local         ]     │
│                                               │
│ Personal API Key                             │
│ [ slk_abcd1234efgh5678ijkl9012...      ]     │
│                      [ Paste from clipboard ] │
│                                               │
│ Notes                                         │
│ - Key is tied to: My Org A                    │
│ - Has full CRUD access to org APIs            │
│                                               │
│───────────────────────────────────────────────│
│ [ Cancel ]                      [ Save ]      │
└───────────────────────────────────────────────┘
```

---

### 8.2 Exchange Request (API Perspective)

```text
Request:

POST /api/auth/api-key/exchange
Authorization: ApiKey slk_abcd1234efgh5678ijkl9012mnop3456

Response:

200 OK
{
  "accessToken": "<JWT>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

This is API-only; no UI in the app itself.

---

## 9. Using the Access Token (API Perspective)

```text
Example: List transactions for org.

GET /api/orgs/my-org-a/transactions
Authorization: Bearer <JWT_FROM_EXCHANGE>

Response: 200 OK with JSON payload as defined by existing API.
```

The UI for transactions/documents remains unchanged; MCP simply mimics browser clients using Bearer tokens.

---

## 10. Error States & Empty States

### 10.1 Empty State (No API Keys Yet)

```text
┌─────────────────────────────────────────────────────────────┐
│ API Access                                                  │
├─────────────────────────────────────────────────────────────┤
│ You have no API keys yet.                                   │
│                                                             │
│ [ + Create your first API key ]                             │
│                                                             │
│ Use personal API keys to connect MCP or other tools to      │
│ your SoloLedger workspace.                                  │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Exchange Error (Invalid/Revoked/Expired Key)

```text
HTTP 401 / 403 (API-only)

{
  "error": "invalid_api_key",
  "message": "The API key is invalid, revoked, or expired."
}
```

### 10.3 Rate Limit Reached for Exchange Endpoint

```text
HTTP 429 (API-only)

{
  "error": "rate_limited",
  "message": "Too many API key exchange attempts. Please try again later."
}
```

---

## 11. Summary

- The API Access page provides a clear, minimal UI for creating, listing, editing, and revoking org-scoped personal API keys.
- The Copy API Key overlay ensures users understand the key is shown only once and must be stored securely.
- MCP and other tools use the key via the `/api/auth/api-key/exchange` endpoint to obtain short-lived JWT access tokens, then call existing APIs with `Authorization: Bearer <token>`.
- Error and empty states are explicit to reduce confusion and make debugging easier.
