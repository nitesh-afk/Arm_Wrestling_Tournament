let ioInstance = null;

/**
 * Initialize the socket service with the active Socket.io server instance.
 * @param {Object} io - Socket.io server instance
 */
export const initSocket = (io) => {
  ioInstance = io;
};

/**
 * Retrieve the active Socket.io instance.
 * @returns {Object|null}
 */
export const getSocketIO = () => {
  return ioInstance;
};

/**
 * Broadcast an event to all connected clients in a specific tournament room.
 * Room naming format: `tournament:{tournamentId}`
 * 
 * @param {string} tournamentId - Tournament ID
 * @param {string} event - Event name
 * @param {Object} payload - Data payload to broadcast
 */
export const emitToTournament = (tournamentId, event, payload) => {
  if (!ioInstance) {
    console.warn('Socket.io instance not initialized. Broadcast skipped:', event);
    return;
  }
  ioInstance.to(`tournament:${tournamentId}`).emit(event, payload);
};

/**
 * Broadcast when a match is called to a table (starts 60s countdown clock).
 */
export const emitMatchCalled = (tournamentId, payload) => {
  emitToTournament(tournamentId, 'match:called', payload);
};

/**
 * Broadcast match staging state transitions (WAITING, ON_TABLE, COMPLETED, etc.).
 */
export const emitMatchStateChange = (tournamentId, payload) => {
  emitToTournament(tournamentId, 'match:state_change', payload);
};

/**
 * Broadcast live referee scoring actions (warnings, fouls, straps, ref grip).
 */
export const emitScoringUpdate = (tournamentId, payload) => {
  emitToTournament(tournamentId, 'match:scoring_update', payload);
};

/**
 * Broadcast match completion and bracket advancement.
 */
export const emitMatchCompleted = (tournamentId, payload) => {
  emitToTournament(tournamentId, 'match:completed', payload);
};

/**
 * Broadcast updated staged queue order for a table (ON_TABLE, ON_DECK, IN_THE_HOLE).
 */
export const emitTableQueueUpdated = (tournamentId, payload) => {
  emitToTournament(tournamentId, 'table:queue_updated', payload);
};

/**
 * Broadcast when an athlete is officially weighed in at the scale desk.
 */
export const emitAthleteWeighedIn = (tournamentId, payload) => {
  emitToTournament(tournamentId, 'athlete:weighed_in', payload);
};
