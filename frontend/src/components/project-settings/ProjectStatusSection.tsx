// ProjectStatusSection.tsx
//
// Displays project lifecycle management actions inside the Project Settings page.
//
// This section is responsible for actions that change the current state of a
// project without deleting it.
//
// Current actions:
// - Mark as finished
//   => updates the project status to COMPLETED.
//   => uses the existing PATCH /api/projects/:id endpoint.
//
// - Archive
//   => hides the project from active project views while keeping the data.
//   => uses the existing PATCH /api/projects/:id endpoint with isArchived: true.
//
// API interactions are handled through projectsApi.ts:
//
// PATCH /api/projects/:id
//      => updates project fields provided in the request body.
//      => only ADMIN project members are allowed to perform updates.
//
// Permissions:
// - All project members can view the Settings page.
// - Only ADMIN users should see and use lifecycle controls.
// - Frontend checks are only for user experience.
// - Backend authorization remains the source of truth.
//
// State updates:
// - After a successful mutation, the UI should refresh the project data so the
//   displayed status reflects the backend state.
// - The component should not directly modify project state locally without
//   confirmation from the API response.
//
// Notes:
// - "Mark as finished" currently maps to Project.status = COMPLETED.
// - The meaning of other statuses (for example REVIEW) is handled elsewhere
//   and is not part of this component.
//
// This component only manages project lifecycle actions.
// Member management and destructive actions are handled by:
// - MembersSection.tsx
// - DangerZoneSection.tsx
