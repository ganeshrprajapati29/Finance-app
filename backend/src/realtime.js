let io = null;

export function setRealtime(server) {
  io = server;
}

export function getRealtime() {
  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}
