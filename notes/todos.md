# AI API keys and providers for organizations

Here outlined the documentations on how to implement AI features to app:

- @notes/skills/ai_features.md
- @notes/skills/ai_features_wireframes.md

I want to implement this into the app. However, instead of per-user API keys, I want to implement organization-wide API keys that can be managed by organization admins. The usage logs should also reflect organization-wide usage, only accessible to organization admins.

Super admin users should be able to manage API keys and view usage logs for all organizations. We want to add two new tabs in the organization settings page for managing AI API keys and viewing usage logs.

- The "Resend Invitation" feature does not work as expected. When I click on "Resend Invitation" for a pending user, the system does not send the invitation email.
- After I invited a new user, they do not appear in the Pending Invitations list immediately. I have to refresh the page to see them.
- When sign up is disabled vis "AUTH_SIGNUP_ENABLED=false", if the user is in the "Pending Invitations" list, they should be able to sign up even though sign up is disabled for general users. Currently, they are blocked from signing up. When AUTH_SIGNUP_ENABLED=false, only existing users can log in, and invited users should be able to sign up.
- If the user is already part of the organization, if they go through the invitation link, they should see a message indicating they are already a member of the organization, and show a button to go to their organization dashboard. Currently, it still show the "You've been invited!" card with the button to "Accept & Join", which is confusing. Same applied to super admin users as well since super admin users should have access to all organizations.
- In @app/invite/page.tsx, it doesn't show the organization name that the user is being invited to. It just shows "an organization", but it should show the actual organization name for clarity.
