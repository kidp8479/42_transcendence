// Contact page (/contact). Mandatory for 42 subject.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return <div>Hello from Contact</div>
}
