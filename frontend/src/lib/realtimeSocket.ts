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
    socket = io({ path: "/ws", withCredentials: true });
  }
  return socket;
}

export function resetRealtimeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.connect();
  }
}
