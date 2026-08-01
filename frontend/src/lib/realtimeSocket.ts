import { io, type Socket } from "socket.io-client";

// Singleton connection, same reasoning as authState.ts's AuthSessionResource:
// every caller across the app shares one live WebSocket instead of each
// component opening its own.
let socket: Socket | undefined;

// nginx.conf only routes "/ws" to the backend (matches the gateway's own
// path: "/ws" - see backend/src/realtime/realtime.gateway.ts).
// withCredentials sends the session cookie on the handshake, since the
// gateway currently authenticates connections the same way as apiClient.ts.
export function getRealtimeSocket(): Socket {
  if (socket === undefined) {
    // transports: ["websocket"] skips socket.io's default long-polling
    // bootstrap (connect via polling, then probe/upgrade to a real
    // WebSocket) and opens a real WebSocket connection immediately. The
    // polling phase holds an HTTP connection open to localhost:8080 for as
    // long as the handshake+upgrade takes - on top of everything Vite's dev
    // server is already fetching (many small unbundled module files), that
    // can exhaust the browser's ~6-connections-per-origin limit and queue
    // unrelated fetches (notifications, projects...) behind it for
    // multiple seconds right after login. A real WebSocket connection
    // doesn't count against that same pool once it upgrades.
    socket = io({
      path: "/ws",
      withCredentials: true,
      transports: ["websocket"],
    });
  }
  return socket;
}

export function resetRealtimeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.connect();
  }
}

// Logout has no session left to reconnect with - reconnecting anyway just
// has socket.io-client's default reconnection:true retry the handshake
// forever against a gateway that will keep rejecting it (no session
// cookie), hammering /auth/internal/introspect on every attempt.
export function disconnectRealtimeSocket(): void {
  socket?.disconnect();
}
