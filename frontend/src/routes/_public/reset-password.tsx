// Reset password page (/reset-password).
// Reached via the link sent by email after the user submits their email in the forgot password modal.
// Reads ?token= from the URL to identify the reset request, then shows a form for the new password.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return <div>Hello "/_public/reset-password"!</div>;
}
