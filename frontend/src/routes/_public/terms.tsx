// Terms of service page (/terms). Mandatory for 42 subject.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/terms')({
  component: TermsComponent,
})

function TermsComponent() {
  return <div>Hello from Terms!</div>
}
