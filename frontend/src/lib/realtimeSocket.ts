import { io, type Socket } from "socket.io-client";

// Singleton connection, same reasoning as authState.ts's AuthSessionResource:
// every caller across the app shares one live WebSocket instead of each
// component opening its own.
let socket: Socket | undefined;

// TR-74 will supply one-time admission tickets. Keep a disconnected singleton
// until then rather than retaining the removed tr_session cookie fallback.
export function getRealtimeSocket(): Socket {
  if (socket === undefined) {
    socket = io({
      path: "/ws",
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socket;
}

export function resetRealtimeSocket(): void {
  socket?.disconnect();
}

export function disconnectRealtimeSocket(): void {
  socket?.disconnect();
}
