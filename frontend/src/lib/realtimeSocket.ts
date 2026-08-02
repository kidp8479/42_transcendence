import { io, type Socket } from "socket.io-client";
import { bearerFetch, readErrorMessage } from "./apiClient";

const ticketPattern = /^[A-Za-z0-9_-]{43}$/;
const connectionAttemptTimeoutMs = 10_000;
const proactiveSocketRotationMs = 14 * 60_000 + 50_000;
const maximumReconnectDelayMs = 30_000;

let socket: Socket | undefined;
let connectInFlight: Promise<void> | null = null;
let reconnectTimer: number | undefined;
let lifetimeTimer: number | undefined;
let desired = false;
let generation = 0;
let reconnectAttempts = 0;

export function getRealtimeSocket(): Socket {
  socket ??= createSocket();
  desired = true;
  void ensureConnected();
  return socket;
}

export function resetRealtimeSocket(): void {
  generation += 1;
  desired = true;
  clearReconnectTimer();
  clearLifetimeTimer();
  socket?.disconnect();
  if (socket) {
    void ensureConnected();
  }
}

export function disconnectRealtimeSocket(): void {
  generation += 1;
  desired = false;
  clearReconnectTimer();
  clearLifetimeTimer();
  if (socket) {
    socket.io.opts.query = {};
    socket.disconnect();
  }
}

function createSocket(): Socket {
  const realtime = io(import.meta.env.VITE_WS_URL || undefined, {
    path: "/ws",
    autoConnect: false,
    reconnection: false,
    transports: ["websocket"],
  });

  realtime.on("connect", () => {
    reconnectAttempts = 0;
    realtime.io.opts.query = {};
    clearLifetimeTimer();
    lifetimeTimer = window.setTimeout(() => {
      if (!desired || !realtime.connected) {
        return;
      }
      generation += 1;
      realtime.disconnect();
      void ensureConnected();
    }, proactiveSocketRotationMs);
  });
  realtime.on("disconnect", () => {
    clearLifetimeTimer();
    scheduleReconnect();
  });
  realtime.on("connect_error", () => {
    scheduleReconnect();
  });
  return realtime;
}

function ensureConnected(): Promise<void> {
  if (!desired || !socket || socket.connected) {
    return Promise.resolve();
  }
  if (connectInFlight) {
    return connectInFlight;
  }
  clearReconnectTimer();

  const attemptGeneration = generation;
  const request = issueTicket()
    .then(async (ticket) => {
      if (!desired || generation !== attemptGeneration || !socket) {
        return;
      }
      socket.io.opts.query = { ticket };
      await waitForConnection(socket);
    })
    .catch(() => {
      scheduleReconnect();
    })
    .finally(() => {
      if (connectInFlight === request) {
        connectInFlight = null;
      }
      if (
        desired &&
        socket &&
        !socket.connected &&
        reconnectTimer === undefined
      ) {
        scheduleReconnect();
      }
    });

  connectInFlight = request;
  return request;
}

async function issueTicket(): Promise<string> {
  const response = await bearerFetch("/auth/ws-ticket", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const payload: unknown = await response.json();
  if (
    !isRecord(payload) ||
    typeof payload.ticket !== "string" ||
    !ticketPattern.test(payload.ticket) ||
    payload.expiresIn !== 60
  ) {
    throw new Error(
      "Authentication service returned an invalid WebSocket ticket"
    );
  }
  return payload.ticket;
}

function waitForConnection(realtime: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      realtime.disconnect();
      reject(new Error("WebSocket connection timed out"));
    }, connectionAttemptTimeoutMs);
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("WebSocket connection was rejected"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      realtime.off("connect", onConnect);
      realtime.off("connect_error", onError);
    };

    realtime.once("connect", onConnect);
    realtime.once("connect_error", onError);
    realtime.connect();
  });
}

function scheduleReconnect(): void {
  if (!desired || reconnectTimer !== undefined || socket?.connected) {
    return;
  }
  const delay = Math.min(
    maximumReconnectDelayMs,
    1000 * 2 ** Math.min(reconnectAttempts, 5)
  );
  reconnectAttempts += 1;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined;
    void ensureConnected();
  }, delay);
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== undefined) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function clearLifetimeTimer(): void {
  if (lifetimeTimer !== undefined) {
    window.clearTimeout(lifetimeTimer);
    lifetimeTimer = undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
