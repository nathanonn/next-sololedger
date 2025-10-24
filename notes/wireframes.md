# UX Flow Map and Wireframes (Notion Public + Internal)

Below are the UX flow map and the screen-by-screen ASCII wireframes. Code blocks are used for proper formatting.

## UX Flow Map

```
[Settings > Organization > Integrations]
			 |
			 v
  [Notion card]
	  |
	  +-- Connect ▼ (dropdown)
	  |       |-- (if notion_public enabled)  A) Connect with OAuth (Public) -----> [Authorize Endpoint] -> Redirect to Notion -> [OAuth Callback] -> Success toast
	  |       |-- (if notion_internal enabled) B) Connect with Token (Internal) --> [Internal Connect Dialog] -> Verify token -> Success toast
	  |
	  +-- When Connected: [Badge: Connected] [Badge: Type: Public|Internal] [Test Connection] [Disconnect]
									  |
									  +-- If Internal: [Update Token] -> [Internal Connect Dialog (Update)] -> PATCH -> Success toast
									  |
									  +-- If Error: [Reconnect] (Public) | [Update Token] (Internal)

  [Test Connection]
	  -> Opens "Integration Test" dialog (existing) -> calls /test -> shows response

  [Disconnect]
	  -> Confirm -> DELETE -> Success toast -> Card returns to disconnected state
```

## Screen-by-Screen Wireframes

### 1) Organization Integrations Settings (Disconnected)

```
+----------------------------------------------------------------------------------+
| Organization Settings / Integrations                                             |
|----------------------------------------------------------------------------------|
|                                                                                  |
|  Notion [Card]                                                                   |
|  --------------------------------------------------------------------------------|
|  Title: Notion                                                                   |
|  Description: Connect your Notion workspace.                                     |
|                                                                                  |
|  Status: [Disconnected]                                                          |
|                                                                                  |
|  Actions:                                                                        |
|   [ Connect ▼ ]                                                                  |
|       ├─ (if enabled) Connect with OAuth (Public)                                |
|       └─ (if enabled) Connect with Token (Internal)                              |
|                                                                                  |
|  (If scopes are known after connect, show them below as read-only detail)        |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

### 2) Connect with Token (Internal) Dialog

```
+----------------------------------- Dialog: Connect Notion (Internal) -----------------------------------+
|                                                                                                          |
|  Title: Connect Notion (Internal)                                                                        |
|  Description: Use your Notion Internal Integration token. Ensure the integration has access to pages.    |
|                                                                                                          |
|  [ Token (required)                              ]                                                       |
|      helper: Paste your Notion internal integration token.                                              |
|  [ Workspace ID (optional)                       ]                                                       |
|      helper: If you use it in downstream logic, supply the Notion workspace ID.                          |
|                                                                                                          |
|  [ Cancel ]                                         [ Connect ]                                          |
|                                                                                                          |
|  Validation errors appear inline; network/API errors show as toasts.                                     |
|                                                                                                          |
+----------------------------------------------------------------------------------------------------------+
```

### 3) Organization Integrations Settings (Connected: Public)

```
+----------------------------------------------------------------------------------+
| Organization Settings / Integrations                                             |
|----------------------------------------------------------------------------------|
|                                                                                  |
|  Notion [Card]                                                                   |
|  --------------------------------------------------------------------------------|
|  Title: Notion    [Badge: Connected]   [Badge: Type: Public]                    |
|  Account: Acme Corp Workspace                                                   |
|  Last updated: 2025-10-25 12:34                                                 |
|                                                                                  |
|  Actions:  [ Test Connection ]   [ Disconnect ]   [ Connect ▼ ]                 |
|           (Reconnect available if status == error)                               |
|                                                                                  |
|  Scopes: read:databases, read:pages (if available)                               |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

### 4) Organization Integrations Settings (Connected: Internal)

```
+----------------------------------------------------------------------------------+
| Organization Settings / Integrations                                             |
|----------------------------------------------------------------------------------|
|                                                                                  |
|  Notion [Card]                                                                   |
|  --------------------------------------------------------------------------------|
|  Title: Notion    [Badge: Connected]   [Badge: Type: Internal]                  |
|  Account: Acme Corp Workspace                                                   |
|  Last updated: 2025-10-25 12:34                                                 |
|                                                                                  |
|  Actions:  [ Test Connection ]   [ Update Token ]   [ Disconnect ]              |
|                                                                                  |
|  Note: Ensure required pages/databases are shared with the integration in Notion.|
|                                                                                  |
+----------------------------------------------------------------------------------+
```

### 5) Update Token (Internal) Dialog

```
+----------------------------------- Dialog: Update Notion Token -----------------------------------------+
|                                                                                                          |
|  Title: Update Notion Token                                                                              |
|  Description: Rotate your Notion Internal Integration token.                                             |
|                                                                                                          |
|  [ New Token (required)                           ]                                                      |
|      helper: Paste your new Notion internal integration token.                                          |
|                                                                                                          |
|  [ Cancel ]                                         [ Update ]                                           |
|                                                                                                          |
+----------------------------------------------------------------------------------------------------------+
```

### 6) OAuth Flow Touchpoints (Public)

```
User clicks: Connect ▼ -> Connect with OAuth (Public)
	↓
[ POST /api/orgs/:slug/integrations/notion/authorize ]
	↓ redirect
[ Notion OAuth consent ]
	↓ redirect back
[ GET /api/integrations/notion/callback ]  -> Success toast -> Return to Integrations page
```

### 7) Test Connection Dialog (Existing)

```
+---------------------------------------- Dialog: Test Connection ----------------------------------------+
|                                                                                                          |
|  Preview: GET https://api.notion.com/v1/users/me                                                         |
|                                                                                                          |
|  Method: [GET v]   Endpoint: [/users/me___________]   Headers: { ... }                                   |
|  Body (for non-GET): { }                                                                                 |
|                                                                                                          |
|  [ Run Test ]   [ Close ]                                                                                |
|                                                                                                          |
|  Response:                                                                                               |
|    - Success / Error badge, HTTP status                                                                  |
|    - JSON response body (truncated/pretty)                                                               |
|    - Correlation ID (if logging enabled)                                                                 |
|                                                                                                          |
+----------------------------------------------------------------------------------------------------------+
```
