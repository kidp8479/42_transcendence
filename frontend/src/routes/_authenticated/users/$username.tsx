// Public user profile page (/users/:username).
// Displays a user's public profile - avatar, display name, campus, assigned tickets.
// Accessible by clicking a member in search results or anywhere a username appears in the app.
// The username is captured from the URL via params.username and used to fetch the user's data from the API.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users/$username")({
  component: UserProfilePage,
});

function UserProfilePage() {
  return <div>Hello "/users/$username"!</div>;
}
