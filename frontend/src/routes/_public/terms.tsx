// Terms of service page (/terms). Mandatory for 42 subject.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/terms')({
  component: TermsPage,
})

function TermsPage() {
  return (
	<main>
		<h1>Terms of Service</h1>
		<p>Last Updated : June 2026</p>
		<section>
			<h2>1. Acceptance of Terms</h2>
			<p>By using this service...</p>
		</section>
	</main>
  )
}
