/** Prompt only when a worker is already controlling the page and another is waiting. */
export function shouldOfferSwUpdate(input: { hasController: boolean; hasWaitingWorker: boolean }) {
  return input.hasController && input.hasWaitingWorker;
}
