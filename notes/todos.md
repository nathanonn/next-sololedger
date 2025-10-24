- For Notion integration, at the moment, it's only support public integration. We need to add support for internal integration as well. This means that there should be 2 types of Notion integration setup:
  1/ internal integration?
  An internal integration allows Notion workspace members to interact with the workspace through the Notion REST API. Each internal integration is tied to a single, specific workspace and only members within the workspace can use the integration. After an internal integration is added to a workspace, members must manually give the integration access to the specific pages or databases that they want it to use.

  2/ public integration?
  Public integrations can be used by any Notion user in any workspace. They allow members to interact with their workspace using Notion’s REST API once the integration has been properly authorized.

  Public integrations follow the OAuth 2.0 protocol. This allows workspace members to give access to Notion pages directly through the auth flow, without having to open each Notion workspace page directly and manually give permission to the integration. (More on this below.)

  Public integrations can technically be used without permitting workspace pages access as long as the auth flow is completed and an access token is created — a process which will be described in detail below. For example, if a public integration only needs to interact with the Notion User endpoints, it does not need to be given access to workspace pages.

  So, in the INTEGRATIONS_ALLOWED environment variable, there could be 2 options for Notion integration: "notion_internal" and "notion_public". The setup flow would be different based on which type of integration user want to set up. Since internal integration doesn't need OAuth flow, user would just need to provide the integration token and the workspace id to set it up. For public integration, it would follow the OAuth flow as it is now. For internal integration, we will need to store the API token and the workspace id in the database.
