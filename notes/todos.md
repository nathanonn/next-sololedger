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
