# UX Flow Map and Wireframes

## Flow Map (High-level)

```
[Dashboard]
   |
   |-- User Menu (dropdown)
   |     |-- Profile
   |     |-- Organization (only if role: admin|superadmin)
   |           |
   |           `-> /o/{orgSlug}/settings/organization
   |                 |-- Tabs
   |                 |    |-- General
   |                 |    `-- Members
   |                 |
   |                 |-- General (org-level)
   |                 |     |-- Organization Details card
   |                 |     `-- (No Danger Zone)
   |                 |
   |                 `-- Members (org-level)
   |                       |-- Invite Member (button)
   |                       |-- Members List (table)
   |                       `-- Pending Invitations
   |
   `-- Admin -> /admin/organizations
	   |
	   `-- /admin/organizations/{orgSlug}
		   |-- Tabs
		   |    |-- General
		   |    `-- Members
		   |
		   |-- General (admin)
		   |     |-- Organization Details card
		   |     `-- Danger Zone (delete organization)
		   |
		   `-- Members (admin)
			   |-- Invite Member (button)
			   |-- Members List (table)
			   `-- Pending Invitations
```

Notes:

- “Organization” entry is hidden in user menu for member-only users.
- Org-level Members excludes superadmins from the list.
- After actions (invite/edit/remove/resend/revoke), lists refetch to stay fresh.

---

## Screens & ASCII Wireframes

### 1) Admin: Organization Settings – General

Route: `/admin/organizations/{orgSlug}/general`

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back to Organizations                                              │
├──────────────────────────────────────────────────────────────────────┤
│ {Organization Name}                                                  │
│ {organization-slug}                                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Tabs: [ General ]  [ Members ]                                       │
├──────────────────────────────────────────────────────────────────────┤
│ Card: Organization Details                                           │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Name:  Acme Inc                                                 │ │
│ │ Slug:  acme                                                     │ │
│ │ Created:  2025-01-01                                            │ │
│ │                                                                │ │
│ │ [ Edit Organization ]  (superadmin can edit slug; admin name)  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Card: Danger Zone                                                    │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Delete Organization                                              │ │
│ │ - Irreversible. Removes memberships and invitations.            │ │
│ │ [ Delete Organization ] (confirmation dialog)                    │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Key Behaviors:

- Edit dialog validates slug (superadmin only). Redirect on slug change.
- Danger Zone visible only here (admin-general).

---

### 2) Admin: Organization Settings – Members

Route: `/admin/organizations/{orgSlug}/members`

```
┌──────────────────────────────────────────────────────────────────────┐
│ {Organization Name}                                                  │
│ {organization-slug}                                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Tabs: [ Members ]  [ General ]                                       │
├──────────────────────────────────────────────────────────────────────┤
│                 [ Invite Member ]                                    │
│                                                                      │
│ Card: Members (Total: N)                                            │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Showing X–Y of Z                                                │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ Name | Email | Role | Joined | Actions                      │ │ │
│ │ │─────┼───────┼──────┼────────┼──────────────────────────────│ │ │
│ │ │ John | j@.. | admin| 2025…  | [Edit] [Remove]              │ │ │
│ │ │ ...                                                      … │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ │ Pagination: [Prev]  Page P of T  [Next]  Page size: (10/20/50) │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Card: Pending Invitations (M)                                        │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ email@example.com  [role]  Invited by admin@..  Expires in 5d   │ │
│ │   [Resend] [Revoke] (both with confirm dialogs)                 │ │
│ │ ...                                                            │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Key Behaviors:

- Invite/Edit/Remove -> refetch members.
- Resend/Revoke -> confirm then refetch invitations.
- Prevent last-admin demote/remove; admin cannot demote/remove self.

---

### 3) Org-level: Organization Settings – General

Route: `/o/{orgSlug}/settings/organization/general`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Organization Settings                                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Tabs: [ General ]  [ Members ]                                        │
├──────────────────────────────────────────────────────────────────────┤
│ Card: Organization Details                                            │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Name:  Acme Inc                                                 │ │
│ │ Slug:  acme                                                     │ │
│ │ Created:  2025-01-01                                            │ │
│ │                                                                │ │
│ │ [ Edit Organization ]  (slug input hidden/disabled for admin)  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ (No Danger Zone here)                                                │
└──────────────────────────────────────────────────────────────────────┘
```

Key Behaviors:

- Admin can edit name only; superadmin can edit slug if accessing org-level (but we keep Danger Zone in admin area only).

---

### 4) Org-level: Organization Settings – Members

Route: `/o/{orgSlug}/settings/organization/members`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Organization Settings                                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Tabs: [ Members ]  [ General ]                                        │
├──────────────────────────────────────────────────────────────────────┤
│                 [ Invite Member ]                                    │
│                                                                      │
│ Card: Members (Total: N)                                            │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Showing X–Y of Z (excluding superadmins)                        │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ Name | Email | Role | Joined | Actions                      │ │ │
│ │ │─────┼───────┼──────┼────────┼──────────────────────────────│ │ │
│ │ │ Jane | j@.. | admin| 2025…  | [Edit] [Remove]              │ │ │
│ │ │ ...                                                      … │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ │ Pagination: [Prev]  Page P of T  [Next]  Page size: (10/20/50) │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Card: Pending Invitations (M)                                        │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ email@example.com  [role]  Invited by admin@..  Expires in 5d   │ │
│ │   [Resend] [Revoke] (with confirmation)                         │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Key Behaviors:

- Exclude superadmins from list.
- Same refresh/guard logic as admin members page.

---

## Dialogs (shared patterns)

### Edit Organization Dialog

```
┌───────────────────────────────────────┐
│ Edit Organization                     │
├───────────────────────────────────────┤
│ Name: [               ]               │
│ Slug: [               ]  (hidden/ro if !canEditSlug)
│ URL Preview: https://app/o/{slug}     │
├───────────────────────────────────────┤
│ [ Cancel ]      [ Save Changes ]      │
└───────────────────────────────────────┘
```

### Invite Member Dialog

```
┌───────────────────────────────────────┐
│ Invite Member                         │
├───────────────────────────────────────┤
│ Name (optional)                       |
│ Email *                               |
│ Role *   (admin | member)             |
│ [ ] Send email invitation             |
├───────────────────────────────────────┤
│ [ Cancel ]      [ Send Invite ]       │
└───────────────────────────────────────┘
```

### Edit Member Dialog

```
┌───────────────────────────────────────┐
│ Edit Member                           │
├───────────────────────────────────────┤
│ Email: (read-only)                    │
│ Name: [               ]               │
│ Role: [admin|member] (blocked if last admin or self-demote) |
├───────────────────────────────────────┤
│ [ Cancel ]      [ Save Changes ]      │
└───────────────────────────────────────┘
```

### Remove Member Confirm

```
┌──────────────────────────────────────────────┐
│ Remove Member                                │
├──────────────────────────────────────────────┤
│ Are you sure you want to remove {email}?     │
│ This cannot be undone.                       │
├──────────────────────────────────────────────┤
│ [ Cancel ]         [ Remove ] (destructive)  │
└──────────────────────────────────────────────┘
```

### Invitation Resend/Revoke Confirm

```
┌──────────────────────────────────────────────┐
│ Confirm Action                               │
├──────────────────────────────────────────────┤
│ Resend/Revoke invitation for {email}?        │
├──────────────────────────────────────────────┤
│ [ Cancel ]         [ Continue ]              │
└──────────────────────────────────────────────┘
```

---

## Empty/Loading States

Members Loading:

```
┌──────────────────────────┐
│ Loading members...       │
└──────────────────────────┘
```

No Members:

```
┌──────────────────────────┐
│ No members yet           │
│ Invite users to start    │
└──────────────────────────┘
```

No Pending Invitations:

```
┌──────────────────────────┐
│ No pending invitations   │
└──────────────────────────┘
```
