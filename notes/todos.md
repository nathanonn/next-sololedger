- After the reddit connection is established, when it was redirected back to the app, the app crashes with a null pointer exception. /api/integrations/reddit/callback?state=<token>, it logged out the user and redirected to the login page. It shouldn't do that. Please fix this.
- Add a test connection button on all the integrations settings section to allow users to test if their app integration is working properly after they set it up. When testing the connection, user can trigger a simple API call to verify if the integration is working fine.
  - For example, when user clicks on "Test Connection" button for Reddit integration, it would. open a modal that shows which API route will be called to test the connection. There should be a prefill simple API route, e.g., fetching the user's Reddit profile info. User can also change the API route if they want to test a different endpoint. All the CRUD methods (GET, POST, etc.) should be supported. If JSON body is required for the selected method, there should be a text area for user to input the JSON body.
  - After user confirms, it would make the API call and show the result (success or error message) in the modal, wrap the response in a code block for better readability. You can follow how AI playground works.

- For Notion integration, at the moment, it's only support public integration. We need to add support for internal integration as well. This means that there should be 2 types of Notion integration setup:
  1/ internal integration?
  An internal integration allows Notion workspace members to interact with the workspace through the Notion REST API. Each internal integration is tied to a single, specific workspace and only members within the workspace can use the integration. After an internal integration is added to a workspace, members must manually give the integration access to the specific pages or databases that they want it to use.

  2/ public integration?
  Public integrations can be used by any Notion user in any workspace. They allow members to interact with their workspace using Notion’s REST API once the integration has been properly authorized.

  Public integrations follow the OAuth 2.0 protocol. This allows workspace members to give access to Notion pages directly through the auth flow, without having to open each Notion workspace page directly and manually give permission to the integration. (More on this below.)

  Public integrations can technically be used without permitting workspace pages access as long as the auth flow is completed and an access token is created — a process which will be described in detail below. For example, if a public integration only needs to interact with the Notion User endpoints, it does not need to be given access to workspace pages.

  So, in the INTEGRATIONS_ALLOWED environment variable, there could be 2 options for Notion integration: "notion_internal" and "notion_public". The setup flow would be different based on which type of integration user want to set up. Since internal integration doesn't need OAuth flow, user would just need to provide the integration token and the workspace id to set it up. For public integration, it would follow the OAuth flow as it is now. For internal integration, we will need to store the API token and the workspace id in the database.
