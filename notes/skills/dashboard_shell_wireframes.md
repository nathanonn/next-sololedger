# Dashboard Shell UX Flow and Wireframes

This document provides a reusable UX flow map and ASCII wireframes for a two-level dashboard shell (Sections → Pages) with a resizable/collapsible sidebar, mobile drawer, minimal profile menu, and top bar actions. It aligns with the implementation notes in `dashboard_shell.md`.

## Flow map

- Entry: `/dashboard` (or any protected route)
  - Middleware checks JWT; unauthenticated users redirect to `/login?next=...`
  - Protected server layout fetches `user`, `sections`, and `pages`, then renders the client shell

- Shell anatomy
  - Sidebar (left): header with app name and collapse toggle, optional search/command entry, sections with pages, footer user menu
  - Top bar: mobile menu button (md:hidden), spacer or title area, right-side actions (e.g., Quick Actions)
  - Content area: `children` for the routed page

- Navigation
  - Desktop
    - Expanded: labels visible, active item highlighted, resize via drag handle
    - Collapsed: icon-only with tooltips; click opens page; collapse toggle in header
  - Mobile
    - Left sheet/drawer with same sidebar content; closes on navigation

- Profile menu (minimal)
  - Items: Profile, Sign out
  - Sign out posts to API; on success, replace to `/login` or `/`

---

## Screens (ASCII)

### 1) Desktop: Expanded Sidebar

+-----------------------------------------------------------------------------------+
| AppName | | QA |
| Top Bar (border) |
| [ ] (md:hidden) Menu [ Spacer / Title ] [ Button ]|
|-----------------------------------------------------------------------------------|
| Sidebar (resizable) | Content Area (scrolls) |
|---------------------------------|-------------------------------------------------|
| [AppName] [ < > ] | [ Page content ] |
| | |
| [ Search / ⌘K ] | |
| | |
| Sections | |
| - [Icon] Section A | |
| - [Page 1] (active) | |
| - [Page 2] | |
| - [Icon] Section B | |
| - [Page 3] | |
| | |
| -------------------------------- ----|
| [ Avatar ] user@example.com [▼] (Profile | Sign out) |
+-----------------------------------------------------------------------------------+

Notes

- Drag the vertical handle to resize the sidebar
- Collapse button toggles icon-only mode
- Active item uses a filled background style

### 2) Desktop: Collapsed (Icon-only) Sidebar

+-----------------------------------------------------------------------------------+
| AppName | | QA |
| Top Bar (border) |
| [ ] (md:hidden) Menu [ Spacer / Title ] [ Button ]|
|-----------------------------------------------------------------------------------|
| [≡] | Content Area (scrolls) |
|-----|----------------------------------------------------------------------------|
| [<] | [ Page content ] |
| [🔎]| |
| [📌]| |
| [A ]| |
| [B ]| |
| ... |
|-----|----------------------------------------------------------------------------|
| [👤] | (Profile | Sign out) |
+-----------------------------------------------------------------------------------+

Notes

- Sidebar width ~56px; icons show tooltips on hover
- Badges can render as tiny counters on icons (optional)

### 3) Mobile: Sidebar in Left Sheet/Drawer

+--------------------------------+ +---------------------------------------------+
| [ ] Menu | AppName | | Top Bar (border) |
|--------------------------------| | [ ] Menu [ Spacer ] [ QA ] |
| [ Search / ⌘K ] | |---------------------------------------------|
| | | Content Area (scrolls) |
| Sections | | [ Page content ] |
| - [Icon] Section A | | |
| - [Page 1] (tap) | | |
| - [Page 2] | | |
| - [Icon] Section B | | |
| - [Page 3] | | |
|--------------------------------| | |
| [👤] user@example.com [▼] | | |
+--------------------------------+ +---------------------------------------------+

Behavior

- Tap a page; sheet closes and navigates
- Sheet shares the same sidebar content as desktop

### 4) Section/Pages with Active Item

Expanded

+---------------- Sidebar ----------------+
| Sections |
| - [A] Section A |
| - [•] Page 1 (active) |
| - [ ] Page 2 |
| - [B] Section B |
| - [ ] Page 3 |
+-----------------------------------------+

Collapsed

+--+
|A |
|• | (Page 1 active; show a filled state or indicator)
|B |
+--+

### 5) Minimal Profile Menu

+---------------------------+
| My Account |
|---------------------------|
| Profile |
| Sign out |
+---------------------------+

Notes

- If opening a Dialog from a Dropdown/ContextMenu, ensure pointer-events cleanup after close to avoid non-interactivity

---

## Interaction States and Notes

- Resize
  - Handle hover color on desktop; drag to adjust width (min/max enforced)
- Collapse/Expand
  - Toggle button in sidebar header; persist collapsed state
- Mobile Drawer
  - Open via top-left menu button; close on page select or on route change
- Keyboard Shortcuts
  - ⌘K / Ctrl+K: open command palette
  - ⌘⇧N / Ctrl+Shift+N: open Quick Actions
  - Ignore shortcuts when focus is in inputs or editable content
- Active Styling
  - Determine via `usePathname()` and optionally URL search params

---

## Checklist (for implementation)

- [ ] Server layout fetches `user`, `sections`, `pages`
- [ ] Client shell renders PanelGroup with sidebar + main
- [ ] Sidebar supports expanded/collapsed with persistence
- [ ] Mobile sheet mirrors sidebar content and closes on navigate
- [ ] Top bar shows menu button (mobile) and right-side actions
- [ ] Minimal profile menu with Profile + Sign out
- [ ] Pointer-events cleanup for Dialogs triggered from menus
- [ ] Keyboard shortcuts wired and guarded around inputs
