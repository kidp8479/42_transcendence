/**
 * Create account form component.
 * Handles local user registration.
 *
 * Includes:
 * - Username field
 * - Email field
 * - Password field
 * - Create account submit button
 * - Sign in link (switches to login view/modal)
 *
 * It is typically rendered inside AuthModal.
 *
 * Handles:
 * - Form validation and submission state
 * - Registration errors
 * - Navigation to the dashboard after registration
 *
 * It does not handle modal visibility, which belongs to ModalProvider.
 */
import { Alert, Button } from "flowbite-react";
import { useState, type FormEvent } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import { useNavigate } from "@tanstack/react-router";
import { register } from "../../lib/auth";
import { useModal } from "../../hooks/useModal";
import { AuthField } from "./SigninForm";

interface CreateAccountFormProps {
  onSignIn: () => void;
}

export function CreateAccountForm({ onSignIn }: CreateAccountFormProps) {
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      await register(
        String(form.get("email")),
        String(form.get("username")).trim(),
        String(form.get("password"))
      );
      closeModal();
      await navigate({ to: "/dashboard" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create account"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthField
        label="Username"
        name="username"
        type="text"
        autoComplete="username"
        minLength={3}
        maxLength={32}
        pattern="(?:[A-Za-z0-9_]|-){3,32}"
        guidance="3-32 characters. Use A-Z, a-z, 0-9, underscore (_), or hyphen (-)."
        trimOnBlur
        validationMessages={{
          required: "Enter a username.",
          invalid:
            "Enter 3-32 characters using only A-Z, a-z, 0-9, underscore (_), or hyphen (-).",
        }}
      />
      <AuthField label="Email" name="email" type="email" autoComplete="email" />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
      />

      <p className="text-xs leading-5 text-text-secondary">
        Use at least 12 characters. Email verification and password recovery are
        planned for the next authentication milestone.
      </p>

      {error && (
        <Alert color="failure" icon={HiOutlineExclamationCircle}>
          {error}
        </Alert>
      )}

      <Button
        className="bg-brand-600 hover:bg-brand-700 focus:ring-brand-500"
        disabled={submitting}
        fullSized
        type="submit"
      >
        {submitting ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        Already registered?{" "}
        <button
          type="button"
          onClick={onSignIn}
          className="font-semibold text-brand-500 hover:text-brand-600 hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
