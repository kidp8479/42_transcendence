const services = [
  {
    element: document.querySelector('[data-service="website"]'),
    endpoint: "/status/frontend",
  },
  {
    element: document.querySelector('[data-service="workspace"]'),
    endpoint: "/api/health",
  },
  {
    element: document.querySelector('[data-service="auth"]'),
    endpoint: "/auth/health",
  },
  {
    element: document.querySelector('[data-service="attachments"]'),
    endpoint: "/api/health/storage",
  },
];
const overallStatus = document.querySelector("#overall-status");
const lastChecked = document.querySelector("#last-checked");
const refreshButton = document.querySelector("#refresh-status");
const statusSummary = document.querySelector("#status-summary");
const probeTimeoutMs = 3_500;
const refreshIntervalMs = 15_000;
let refreshInFlight = false;

function setServiceState(service, state, label) {
  service.element.className = `service service--${state}`;
  service.element.querySelector("strong").textContent = label;
}

function hasExpectedStatus(body, status) {
  return (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    body.status === status
  );
}

async function probe(service) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), probeTimeoutMs);

  try {
    const response = await fetch(service.endpoint, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json();
    if (response.status === 200 && hasExpectedStatus(body, "ok")) {
      setServiceState(service, "operational", "Operational");
      return "operational";
    }
    if (response.status === 200 && hasExpectedStatus(body, "limited")) {
      setServiceState(service, "limited", "Limited");
      return "limited";
    }
    if (response.status === 503 && hasExpectedStatus(body, "unavailable")) {
      setServiceState(service, "unavailable", "Unavailable");
      return "unavailable";
    }
  } catch {
    // Do not expose upstream implementation details to the public status page.
  } finally {
    window.clearTimeout(timeout);
  }

  setServiceState(service, "unknown", "Unable to verify");
  return "unknown";
}

function setOverallStatus(results) {
  if (results.every((result) => result === "operational")) {
    overallStatus.textContent = "All core services are available";
    return;
  }
  if (results.includes("unknown")) {
    overallStatus.textContent = "Unable to verify service availability";
    return;
  }
  if (results.every((result) => result === "unavailable")) {
    overallStatus.textContent = "Core services are unavailable";
    return;
  }
  overallStatus.textContent = "Some services are limited";
}

async function refresh() {
  if (refreshInFlight) {
    return;
  }
  refreshInFlight = true;
  refreshButton.disabled = true;
  refreshButton.textContent = "Checking...";
  statusSummary.setAttribute("aria-busy", "true");
  overallStatus.textContent = "Checking availability";
  for (const service of services) {
    setServiceState(service, "checking", "Checking");
  }
  try {
    const results = await Promise.all(services.map(probe));
    setOverallStatus(results);
    lastChecked.textContent = `Last checked ${new Intl.DateTimeFormat(
      undefined,
      { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    ).format(new Date())}`;
  } finally {
    statusSummary.setAttribute("aria-busy", "false");
    refreshButton.disabled = false;
    refreshButton.textContent = "Check again";
    refreshInFlight = false;
  }
}

refreshButton.addEventListener("click", refresh);
void refresh();
window.setInterval(refresh, refreshIntervalMs);
