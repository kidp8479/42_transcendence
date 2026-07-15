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
import { login } from "../../lib/auth";
import { darkTextInputTheme } from "../../lib/flowbite";
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
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      closeModal();
      await navigate({ to: "/dashboard" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign in"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthField label="Email" name="email" type="email" autoComplete="email" />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />

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
        {submitting ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        New here?{" "}
        <button
          type="button"
          onClick={onCreateAccount}
          className="font-semibold text-brand-500 hover:text-brand-600 hover:underline"
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
        onInvalid={(event) => syncValidation(event.currentTarget, true)}
        pattern={pattern}
        required
        theme={darkTextInputTheme}
        title={guidance}
        type={type}
        color={validationError ? "failure" : "gray"}
        aria-describedby={
          [guidance && guidanceId, validationError && errorId]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-invalid={validationError ? true : undefined}
      />
      {guidance && (
        <p
          id={guidanceId}
          className="mt-2 text-xs leading-5 text-text-secondary"
        >
          {guidance}
        </p>
      )}
      {validationError && (
        <p
          id={errorId}
          aria-live="polite"
          className="mt-2 text-xs leading-5 text-red-400"
        >
          {validationError}
        </p>
      )}
    </div>
  );
}
