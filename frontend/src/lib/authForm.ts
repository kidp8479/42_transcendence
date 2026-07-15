export function validateAuthForm(form: HTMLFormElement): boolean {
  const inputs = Array.from(form.elements).filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement
  );

  for (const input of inputs) {
    if (!input.checkValidity()) {
      input.focus();
      return false;
    }
  }
  return true;
}
