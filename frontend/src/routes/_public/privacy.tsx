// Privacy policy page (/privacy). Mandatory for 42 subject.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  return <div>Hello from Privacy!</div>
}
