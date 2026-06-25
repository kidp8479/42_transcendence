// Easter egg page (/dont-panic).
// Triggered by clicking the logo on the landing page when not logged in.
// Hitchhiker's Guide to the Galaxy theme - "DON'T PANIC", HHGTTG OS boot sequence, "the answer is 42".
// Has two buttons: "Back to safety" (→ /) and "Reboot" (reloads the page).
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/dont-panic')({
  component: DontPanicPage,
})

function DontPanicPage() {
  return <div>Hello "/_public/dont-panic"!</div>
}
