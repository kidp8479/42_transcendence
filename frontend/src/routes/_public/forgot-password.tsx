// Forgot password page (/forgot-password). Email form to trigger a password reset.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return <div>Hello from forgot-password!</div>
}
