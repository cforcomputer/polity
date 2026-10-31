/** Background work that should run as soon as the server boots, not on first request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureTicker } = await import("./lib/sim");
  const { startPhotonPoller } = await import("./lib/photon");
  ensureTicker();
  startPhotonPoller();
}
