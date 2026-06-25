// Layout route for all public pages (no login required).
// This file makes _public/ a pathless layout - its name does not appear in the URL.
// Every page inside _public/ (about, contact, terms...) is automatically wrapped by PublicLayout.
import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../../components/layout/PublicLayout'

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
})
