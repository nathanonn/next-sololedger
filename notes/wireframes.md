# Integrations UX — Flow Map and Wireframes

Below are the UX flow map and screen-by-screen ASCII wireframes for adding LinkedIn (member posting) and WordPress (self‑hosted via Application Passwords) integrations. All diagrams are wrapped in triple backticks for correct formatting.

## Flow map

```
											 +-----------------------------------------+
											 | Org Settings > Integrations (List View) |
											 +--------------------+--------------------+
																						|
												 Connect (LinkedIn) |  Connect (WordPress)
																						|
																						v          v
																	 +----------------+  +-----------------------------------+
																	 | POST /authorize|  | Open Internal Connect Dialog (WP) |
																	 +--------+-------+  +-------------------+---------------+
																						|                              |
																						v                              v
																	 +------------------+          +-------------------------------+
																	 | LinkedIn OAuth   |          | POST /wordpress/internal-     |
																	 |  (consent)       |          | connect (site/url/creds)      |
																	 +--------+---------+          +-------------------+-----------+
																						|                                |
																						v                                v
																	 +------------------+            +----------------------------+
																	 | GET /callback    |            | Connected (toast)          |
																	 | upsert tokens    |            | Manage WordPress page link |
																	 +--------+---------+            +-------------+--------------+
																						|                                    |
																						v                                    v
									 +------------------------------+            +------------------------------------+
									 | Redirect back to Integrations|            | WordPress Settings Page           |
									 | (toast: connected)           |            | - Defaults (status/category/...)  |
									 +--------+---------------------+            | - Quick Post                      |
														|                                  | - Analytics (basic CMS stats)     |
														|                                  | - Test, Disconnect                |
														v                                  +----------------+-------------------+
						 +-------------------------------+                                   |
						 | Manage LinkedIn (Settings)    |                                   v
						 | - Quick Post (member)         |                    +-----------------------------+
						 | - Recent posts list           |                    | DELETE /integrations/wp     |
						 | - Test, Disconnect            |                    | (revoke local, audit log)   |
						 +-------------------+-----------+                    +-----------------------------+
																 |
																 v
										+-----------------------------+
										| DELETE /integrations/linkedin|
										| (revoke where possible)      |
										+-----------------------------+

	From Integrations or Settings pages:
	- "Test Connection" => POST /integrations/[provider]/test (method, endpoint, headers, body) => show result.
```

## Screen 1: Integrations Management (Org Settings)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Sidebar (collapsible)             │ Org: Acme, Settings > Integrations       │
├───────────────────────────────────────────────────────────────────────────────┤
│ [Card] LinkedIn                                                        [•••] │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ Title: LinkedIn                                                     │   │
│  │ Badges: [Connected] / [Error] (conditional)                         │   │
│  │ Subtitle: Account: John Doe (if connected)                          │   │
│  │ Scopes: r_liteprofile w_member_social offline_access                │   │
│  │                                                                     │   │
│  │ Actions:                                                            │   │
│  │  - [Connect] or [Reconnect] (OAuth)                                 │   │
│  │  - [Test Connection] (if connected)                                 │   │
│  │  - [Manage] (go to LinkedIn settings)                               │   │
│  │  - [Disconnect] (if connected)                                      │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ [Card] WordPress                                                         [•••] │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ Title: WordPress                                                     │   │
│  │ Badges: [Connected] / [Error] (conditional); Type: [Internal]        │   │
│  │ Subtitle: Site: https://example.com (if connected)                   │   │
│  │ Scopes/Info: Basic auth via App Passwords                            │   │
│  │                                                                     │   │
│  │ Actions:                                                            │   │
│  │  - [Connect] (opens dialog) or [Update Credentials]                  │   │
│  │  - [Test Connection] (if connected)                                 │   │
│  │  - [Manage] (go to WordPress settings)                               │   │
│  │  - [Disconnect] (if connected)                                      │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ [AlertDialog] Disconnect confirmation (shared component)                      │
│   "Are you sure? This will revoke access and remove tokens."                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

Notes

- Connect (LinkedIn) -> redirects to OAuth; upon return, toast and refresh list.
- Connect (WordPress) -> opens internal dialog (see Screen 2).

## Screen 2: WordPress Internal Connect Dialog

```
┌─────────────────────────────────────────── Dialog: Connect WordPress ────────┐
│ Site URL             [ https://example.com           ]                        │
│ Username             [ admin                         ]                        │
│ Application Password [ •••••••••••••••••••           ] (eye toggle)           │
│                                                                               │
│ Defaults (optional)                                                            │
│  - Post status     [ draft ▾ ]    - Category ID [  ]   - Author ID [  ]       │
│                                                                               │
│ [Cancel]                                  [Connect] (primary)                  │
│                                                                               │
│ Validation messages:                                                           │
│  - Require HTTPS (unless dev-flag allows http)                                 │
│  - Show friendly errors on auth failure/CORS                                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

Notes

- On success: close dialog, toast.success("WordPress connected"), refresh list.
- On error: toast.error with API error message.

## Screen 3: LinkedIn Settings Page

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Header: LinkedIn — Connected as John Doe (Member)  [Test] [Disconnect]       │
├───────────────────────────────────────────────────────────────────────────────┤
│ Quick Post                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Text (member post):                                                     │  │
│  │ [ Share an update...                                                 ] │  │
│  │                                                                       │  │
│  │ [Post] (primary)                                   [Clear]            │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│ Recent Posts                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ | Date/Time         | URN/ID                     | Status | Preview    | │  │
│  │ | 2025-10-22 11:05  | urn:li:ugcPost:xxxx       | OK     | Lorem...   | │  │
│  │ | 2025-10-21 09:18  | urn:li:ugcPost:yyyy       | OK     | Ipsum...   | │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│ Notes: Member-only posting via w_member_social; advanced analytics hidden.    │
└───────────────────────────────────────────────────────────────────────────────┘
```

Notes

- [Post] -> POST /integrations/linkedin/post; show success with returned post URN.
- [Test] -> opens Test Connection dialog (shared).
- [Disconnect] -> opens confirmation and calls DELETE.

## Screen 4: WordPress Settings Page

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Header: WordPress — https://example.com (Internal) [Test] [Update] [Disconnect]│
├───────────────────────────────────────────────────────────────────────────────┤
│ Defaults                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Post status     [ draft ▾ ]    Category ID [    ]    Author ID [    ]  │  │
│  │ [Save Defaults]                                                        │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│ Quick Post                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Title     [ My first WP post                               ]           │  │
│  │ Content   [ Markdown/HTML content...                        ]           │  │
│  │ Status    [ draft ▾ ]                                                     │  │
│  │ [Publish] (primary)                                 [Save as Draft]     │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│ Analytics (basic CMS)                                                          │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │ Total Posts:   128  │  │ Total Comments: 542 │  │ Users: 8            │ │
│  └─────────────────────┘  └──────────────────────┘  └──────────────────────┘ │
│  Recent posts:                                                                 │
│   - 2025-10-22: "Release Notes" (publish)                                      │
│   - 2025-10-19: "October Update" (draft)                                       │
└───────────────────────────────────────────────────────────────────────────────┘
```

Notes

- [Update] opens the Internal Connect Dialog with existing credentials masked.
- [Publish]/[Save as Draft] call /integrations/wordpress/post; return post ID and link.

## Screen 5: Test Connection Dialog (Shared)

```
┌─────────────────────────────────────────── Dialog: Test Connection ───────────┐
│ Provider: [ LinkedIn ▾ ]  (also available when opened from settings)          │
│ Method:   [ GET ▾ ]                                                           │
│ Endpoint: [ /me ]  (LinkedIn)   or [ /wp-json/ ] (WordPress)                  │
│ Headers  (JSON, optional):                                                    │
│ [ { } ]                                                                       │
│ Query    (JSON, optional):                                                    │
│ [ { } ]                                                                       │
│ Body     (JSON, optional):                                                    │
│ [ { } ]                                                                       │
│                                                                                │
│ [Cancel]                                         [Run Test] (primary)         │
│                                                                                │
│ Result (readonly, scrollable):                                                 │
│ ┌───────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                          │ │
│ │   "ok": true,                                                             │ │
│ │   "httpStatus": 200,                                                      │ │
│ │   "correlationId": "abc123...",                                         │ │
│ │   "data": { ... provider response (truncated/logged) ... }                │ │
│ │ }                                                                          │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

Notes

- Uses POST /integrations/[provider]/test; shows friendly errors with correlationId.

## Screen 6: Empty/Error States

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ No Integrations Available                                                      │
│  - "No integration providers are currently enabled for this deployment."      │
│  - CTA: Link to docs/env keys.                                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│ Error banners / toasts                                                         │
│  - OAuth error on callback: show toast.error and restore Integrations page.    │
│  - CSRF invalid on POST: toast.error("Session expired. Please refresh.")      │
│  - 401/403: toast.error("Admin access required")                               │
│  - 429: toast.error("Rate limited. Try again shortly.")                        │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Mobile considerations (summary)

```
- Integrations cards stack vertically; actions move into overflow menu (…)
- Dialogs become full-screen Sheets on small screens
- Tables (recent posts) collapse to stacked rows: [Title] + [Meta] lines
```

## Navigation summary

```
Org Settings > Integrations List
	↳ LinkedIn > Settings (member posting)
	↳ WordPress > Settings (defaults, quick post, analytics)
	↳ Test Connection (either card or settings page)
	↳ Disconnect (confirm dialog)
```
