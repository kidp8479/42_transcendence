const schoolWildcardOrigin = "https://*.paris.42.school:8443";

export function allowsBrowserOrigin(
  configuredOrigin: string,
  origin: string | undefined
): boolean {
  if (!origin) {
    return false;
  }
  if (configuredOrigin !== schoolWildcardOrigin) {
    return origin === configuredOrigin;
  }

  try {
    const parsed = new URL(origin);
    const labels = parsed.hostname.toLowerCase().split(".");
    return (
      parsed.protocol === "https:" &&
      parsed.port === "8443" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      labels.length === 4 &&
      labels[0] !== "" &&
      labels[0] !== "*" &&
      labels[1] === "paris" &&
      labels[2] === "42" &&
      labels[3] === "school"
    );
  } catch {
    return false;
  }
}

export function isValidConfiguredBrowserOrigin(value: string): boolean {
  if (value === schoolWildcardOrigin) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}
