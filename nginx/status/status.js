const services = [
  {
    element: document.querySelector('[data-service="backend"]'),
    endpoint: "/api/health",
  },
  {
    element: document.querySelector('[data-service="auth"]'),
    endpoint: "/auth/health",
  },
];
const overallStatus = document.querySelector("#overall-status");
const lastChecked = document.querySelector("#last-checked");
const refreshButton = document.querySelector("#refresh-status");
const probeTimeoutMs = 3_500;
const refreshIntervalMs = 15_000;

function setServiceState(service, state, label) {
  service.element.className = `service service--${state}`;
  service.element.querySelector("strong").textContent = label;
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
    if (response.status === 200 && body.status === "ok") {
      setServiceState(service, "ready", "Ready");
      return "ready";
    }
    if (response.status === 503 && body.status === "unavailable") {
      setServiceState(service, "not-ready", "Not ready");
      return "not-ready";
    }
  } catch {
    // A generic unavailable indicator avoids exposing upstream implementation details.
  } finally {
    window.clearTimeout(timeout);
  }

  setServiceState(service, "unavailable", "Probe unavailable");
  return "unavailable";
}

async function refresh() {
  refreshButton.disabled = true;
  for (const service of services) {
    setServiceState(service, "checking", "Checking");
  }
  const results = await Promise.all(services.map(probe));
  const unavailable = results.some((result) => result !== "ready");
  overallStatus.textContent = unavailable
    ? "Attention required"
    : "All monitored services are ready";
  lastChecked.textContent = `Last checked ${new Intl.DateTimeFormat(
    undefined,
    { hour: "2-digit", minute: "2-digit", second: "2-digit" }
  ).format(new Date())}`;
  refreshButton.disabled = false;
}

refreshButton.addEventListener("click", refresh);
void refresh();
window.setInterval(refresh, refreshIntervalMs);
