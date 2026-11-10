function connectOverlay(port, { announceReady = true } = {}) {
  const events = new EventTarget();
  const host = location.hostname || "localhost";
  let socket;
  let retry;
  let stopped = false;

  function connect() {
    const url = location.protocol === "https:" ? `wss://${location.host}/ws/${port}`
      : `ws://${host}:${port}`;
    socket = new WebSocket(url);
    socket.addEventListener("message", event => {
      const message = new MessageEvent("message", { data: event.data });
      events.dispatchEvent(message);
      events.onmessage?.(message);
    });
    for (const type of ["open", "error"]) {
      socket.addEventListener(type, () => events.dispatchEvent(new Event(type)));
    }
    socket.addEventListener("open", () => {
      if (announceReady && window.parent !== window && location.protocol !== "file:") {
        window.parent.postMessage({ type: "ff-overlay-ready" }, location.origin);
      }
    });
    socket.addEventListener("close", () => {
      events.dispatchEvent(new Event("close"));
      if (!stopped) retry = setTimeout(connect, 1000);
    });
  }

  window.addEventListener("pagehide", () => {
    stopped = true;
    clearTimeout(retry);
    socket?.close();
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted && stopped) {
      stopped = false;
      connect();
    }
  });
  connect();
  return events;
}
