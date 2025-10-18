I want to add multi-tenant support to my application, where user can have their own organizations and invite others to join. Every user should can belong to multiple organizations. I want to do this in a wat that is similar to how notion.so handles workspaces and users.

This means that when a user creates an account, they can create a new organization (workspace). Each organization will have its own set of data, and users will be able to switch between organizations easily. User can also be invited to join other organizations by email. Admin users of an organization should be able to manage members, including inviting new users, removing users, and changing user roles (admin or member).

For now, the roles will be simple: Admin and Member. Admins can manage the organization and its members, while Members can only access the organization's data.

For existing users, we will need to run a migration to create a default organization for each user and assign them as the admin of that organization.

All the data in the application should be scoped to the organization. This means that when a user is viewing or interacting with data, they should only see data that belongs to the currently selected organization so we will need to add an organization_id field to all relevant tables in the database.

There should be a way to switch between organizations easily, perhaps through the sidebar under the user menu. Utilize the existing dashboard shell component to maintain a consistent layout.

what else that can be considered:

- **Data Isolation**: Ensure that data is properly isolated between organizations. Implement checks in the backend to prevent data leakage between organizations.

- **Invitation System**: Implement a robust invitation system that allows admins to invite users via email. Consider adding expiration dates for invitations and the ability to resend invitations.

- **User Experience**: Design the user interface to make it easy for users to switch between organizations. Consider using modals or dedicated pages for organization management tasks.

======

- [ ] Add an env variable to disable allowed emails check.
- [ ] Add an env variable to enable/disable signup feature. If signup is disabled, only existing users can login. If user tries to access the signup page, redirect them to the login page with a message indicating that signup is disabled. If a non-existing user tries to login, show a message indicating that their account does not exist and they cannot sign up because signup is disabled.
- [ ] Only admin of the organization can see the /o/[orgSlug]/settings/members and /app/o/[orgSlug]/settings/organization pages. We need to control the API routes as well to make sure only admin can perform those actions.
- [ ] We need to add the superadmin role that can access all organizations and manage them.
  - [ ] Only superadmin can create new organizations.
  - [ ] Superadmin can assign other users as admin of an organization.
- [ ] Add an env variable to enable/disable organization creation by users.
  - [ ] We also need a env variable to limit the number of organizations a user can create. By default, only one is allowed.
  - [ ] If organization creation is disabled, users can only be invited to existing organizations. Therefore, we need to hide the "Create Organization" button in the UI. Also, block user from accessing the organization creation page and API route.

- [ ] We need to create a specific page for superadmin to manage all organizations and their members.
  - [ ] The page should list all organizations with pagination.
  - [ ] Superadmin can click on an organization to view its details, including members.
  - [ ] Superadmin can remove users from an organization or change their roles.
  - [ ] Superadmin can delete an organization if needed.
  - [ ] Put the page at /admin/organizations. Protect the route so that only superadmin can access it.
  - [ ] Put a link to the page in the sidebar under the user menu, visible only to superadmin users.
