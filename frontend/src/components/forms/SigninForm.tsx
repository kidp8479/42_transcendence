/**
 * Sign in form component.
 * Handles local email/password authentication.
 *
 * Includes secondary actions:
 * - Sign up link (switches to registration view/modal)
 *
 * It is typically rendered inside AuthModal.
 *
 * Handles:
 * - Form validation and submission state
 * - Authentication errors
 * - Navigation to the dashboard after sign-in
 *
 * It does not handle modal visibility, which belongs to ModalProvider.
 */
import { Alert, Button, Label, TextInput } from "flowbite-react";
import { useState, type FocusEvent, type FormEvent } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import { useNavigate } from "@tanstack/react-router";
import { AuthRequestError, login } from "../../lib/auth";
import { validateAuthForm } from "../../lib/authForm";
import { authSessionResource } from "../../lib/authState";
import { darkAlertTheme, darkTextInputTheme } from "../../lib/flowbite";
import { useModal } from "../../hooks/useModal";

interface SigninFormProps {
  onCreateAccount: () => void;
}

export function SigninForm({ onCreateAccount }: SigninFormProps) {
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!validateAuthForm(event.currentTarget)) {
      return;
    }
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const session = await login(
        String(form.get("email")),
        String(form.get("password"))
      );
      authSessionResource.setAuthenticated(session);
      closeModal();
      await navigate({ to: "/dashboard" });
    } catch (requestError) {
      setError(signInErrorMessage(requestError));
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
        validationMessages={{
          required: "Enter your email address.",
          invalid: "Enter a valid email address, like name@example.com.",
          typeMismatch: "Enter a valid email address, like name@example.com.",
        }}
      />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        validationMessages={{
          required: "Enter your password.",
          invalid: "Enter your password.",
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
			bg-brand-500
			text-white
			hover:bg-brand-600
			focus:outline-none
			focus-visible:outline-none
			focus:ring-4
			focus:ring-green-300
			dark:bg-brand-500
			dark:text-white
			dark:hover:bg-brand-600
			dark:focus:ring-green-800
		"
        disabled={submitting}
        fullSized
        type="submit"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        New here?{" "}
        <button
          type="button"
          onClick={onCreateAccount}
          className="
			font-semibold
			text-brand-500
			hover:text-brand-600
			hover:underline
			"
        >
          Create an account
        </button>
      </p>
    </form>
  );
}

interface AuthFieldProps {
  label: string;
  name: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  guidance?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  trimOnBlur?: boolean;
  validationMessages?: {
    required: string;
    invalid: string;
    typeMismatch?: string;
    tooShort?: string;
    tooLong?: string;
  };
}

export function AuthField({
  label,
  name,
  type,
  autoComplete,
  guidance,
  minLength,
  maxLength,
  pattern,
  trimOnBlur = false,
  validationMessages,
}: AuthFieldProps) {
  const inputId = `auth-${name}`;
  const guidanceId = `${inputId}-guidance`;
  const errorId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);
  const [validationError, setValidationError] = useState("");

  function syncValidation(input: HTMLInputElement, showError: boolean): void {
    input.setCustomValidity("");

    let message = "";
    if (validationMessages) {
      if (input.validity.valueMissing) {
        message = validationMessages.required;
      } else if (input.validity.typeMismatch) {
        message = validationMessages.typeMismatch ?? validationMessages.invalid;
      } else if (input.validity.tooShort) {
        message = validationMessages.tooShort ?? validationMessages.invalid;
      } else if (input.validity.tooLong) {
        message = validationMessages.tooLong ?? validationMessages.invalid;
      } else if (!input.validity.valid) {
        message = validationMessages.invalid;
      }
      input.setCustomValidity(message);
    }

    if (showError) {
      setValidationError(message);
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    const input = event.currentTarget;
    if (trimOnBlur) {
      input.value = input.value.trim();
    }
    setTouched(true);
    syncValidation(input, true);
  }

  return (
    <div>
      <div className="mb-2 block">
        <Label htmlFor={inputId} className="text-text-primary">
          {label}
        </Label>
      </div>
      <TextInput
        autoComplete={autoComplete}
        data-auth-field
        id={inputId}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        onBlur={handleBlur}
        onInput={(event) =>
          syncValidation(
            event.currentTarget,
            touched || validationError.length > 0
          )
        }
        onInvalid={(event) => {
          event.preventDefault();
          syncValidation(event.currentTarget, true);
        }}
        pattern={pattern}
        required
        theme={darkTextInputTheme}
        title={guidance}
        type={type}
        color={validationError ? "failure" : "gray"}
        aria-describedby={
          validationError ? errorId : guidance ? guidanceId : undefined
        }
        aria-invalid={validationError ? true : undefined}
      />
      {validationError ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-control-error"
        >
          <HiOutlineExclamationCircle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{validationError}</span>
        </p>
      ) : guidance ? (
        <p
          id={guidanceId}
          className="mt-2 text-xs leading-5 text-control-helper"
        >
          {guidance}
        </p>
      ) : null}
    </div>
  );
}

function signInErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) {
    if (error.status === 401) {
      return "Email address or password is incorrect.";
    }
    if (error.status === 429) {
      return "Too many attempts. Wait a minute and try again.";
    }
  }
  return "We couldn't sign you in. Try again.";
}
