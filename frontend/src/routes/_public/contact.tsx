// Contact page (/contact). Mandatory for 42 subject.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/contact")({
  component: ContactPage,
});

function ContactPage() {
  return <div>Hello from Contact</div>;
}
