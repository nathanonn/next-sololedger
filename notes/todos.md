# AI API keys and providers for organizations

Here outlined the documentations on how to implement AI features to app:

- @notes/skills/ai_features.md
- @notes/skills/ai_features_wireframes.md

I want to implement this into the app. However, instead of per-user API keys, I want to implement organization-wide API keys that can be managed by organization admins. The usage logs should also reflect organization-wide usage, only accessible to organization admins.

Super admin users should be able to manage API keys and view usage logs for all organizations. We want to add two new tabs in the organization settings page for managing AI API keys and viewing usage logs.

====

# make the content in the organization settings page for super admin into tabs

We want to refactor the organization settings page for super admin users to use tabs for better organization and navigation. The tabs should include:

1. **General Settings**: This tab will contain the existing general settings for the organization, such as name, slug. Put the delete organization button here as well. Make sure to mark it as a danger zone so that super admins are cautious when using it.
2. **Members**: This tab will list all members of the organization with their roles and permissions.

The idea is to improve the user experience for super admin users by organizing the settings into clear and distinct sections. And also, to make sure that we can easily add more tabs in the future as needed.

- The "Danger Zone" section for deleting the organization should only be available at the /admin/organizations/[orgSlug]/settings/general tab.
- The table in the Members tab wasn't updated after performing actions like inviting a member, editing a member's details, or removing a member. Please ensure that the table reflects the latest data after such actions. Same for the "Pending Invitations" list.
- Create a reusable component for the following components that are used in the following places:
  - /admin/organizations/{orgId}/general & /o/{orgId}/settings/organization/general
    - create (or use existing if exists) the reusable component for "Organization Details" section that display organization name, slug, created date, and button to edit organization details. The button should open a modal to edit the organization details. Organization admin can only edit the organization name. Super admin can edit both name and slug.
      - When super admin edits the organization slug, make sure to validate that the new slug is unique and not already taken by another organization. If it's taken, show an error message and prevent the update.
  - /admin/organizations/{orgId}/settings/members & /o/{orgId}/settings/organization/members
    - create (or use existing if exists) the reusable component for "Members List" table that display list of members with their roles and Join date, and actions to edit or remove members.
      - In /o/{orgId}/settings/organization/members, super admin should not be in the members list. Only organization admins and members should be listed here.
      - If the logged in user is an organization admin, they should not be able to change their own role to "Member" or remove themselves from the organization. There must always be at least one organization admin in the organization.
      - The Invite Member button should be above the "Members List" table, aligned to the right side.
    - create (or use existing if exists) the reusable component for "Pending Invitations" list that display list of pending invitations with email, invited date, invited by who, expired at, and actions to resend or revoke invitations.
      - When you resend or revoke an invitation, there should be a confirmation dialog to prevent accidental clicks.
  - All the components should be full width and responsive.
- If user is just a member, they should not see the "Organization" option in the sidebar and user menu at all.
