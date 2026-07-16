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
import { AuthRequestError, register } from "../../lib/auth";
import { validateAuthForm } from "../../lib/authForm";
import { authSessionResource } from "../../lib/authState";
import { darkAlertTheme } from "../../lib/flowbite";
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
    const usernameInput = event.currentTarget.elements.namedItem("username");
    if (usernameInput instanceof HTMLInputElement) {
      usernameInput.value = usernameInput.value.trim();
    }
    if (!validateAuthForm(event.currentTarget)) {
      return;
    }
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const session = await register(
        String(form.get("email")),
        String(form.get("username")).trim(),
        String(form.get("password"))
      );
      authSessionResource.setAuthenticated(session);
      closeModal();
      await navigate({ to: "/dashboard" });
    } catch (requestError) {
      setError(createAccountErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <AuthField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        guidance="You'll use this to sign in."
        validationMessages={{
          required: "Enter your email address.",
          invalid: "Enter a valid email address, like name@example.com.",
          typeMismatch: "Enter a valid email address, like name@example.com.",
        }}
      />
      <AuthField
        label="App username"
        name="username"
        type="text"
        autoComplete="username"
        minLength={3}
        maxLength={32}
        pattern="(?:[A-Za-z0-9_]|-){3,32}"
        guidance="3-32 letters, numbers, underscores, or hyphens. It doesn't have to match your 42 login."
        trimOnBlur
        validationMessages={{
          required: "Enter an app username.",
          invalid: "Use 3-32 letters, numbers, underscores, or hyphens.",
        }}
      />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        guidance="Use 12-128 characters. Password reset isn't available yet."
        minLength={12}
        maxLength={128}
        validationMessages={{
          required: "Enter a password.",
          invalid: "Use 12-128 characters.",
          tooShort: "Use at least 12 characters.",
          tooLong: "Use no more than 128 characters.",
        }}
      />

      {error && (
        <Alert
          color="failure"
          icon={HiOutlineExclamationCircle}
          theme={darkAlertTheme}
        >
          {error}
        </Alert>
      )}

      <Button
        className="
		  bg-brand-700
		  text-text-primary
		  hover:bg-brand-800
		  focus:ring-brand-500
		  dark:bg-brand-700
		  dark:text-text-primary
		  dark:hover:bg-brand-800
		  dark:focus:ring-brand-500
		 "
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

function createAccountErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) {
    if (error.status === 409) {
      return "An account with that email address or app username already exists. Try signing in or choose another username.";
    }
    if (error.status === 429) {
      return "Too many attempts. Wait a minute and try again.";
    }
  }
  return "We couldn't create your account. Try again.";
}
