export type EventScope = "board" | "members";

/**
 * Listens to one workspace over SSE.
 *
 * Uses fetch instead of EventSource because EventSource cannot set an Authorization
 * header, which would force the token into the URL where logs pick it up.
 * Reconnects on drop with a growing backoff.
 */
export function subscribeWorkspace(opts: {
  base: string;
  token: string;
  workspaceId: number;
  onEvent: (scope: EventScope) => void;
  onConnected?: (connected: boolean) => void;
}): () => void {
  const { base, token, workspaceId, onEvent, onConnected } = opts;
  let stopped = false;
  let controller: AbortController | null = null;
  let retryMs = 1000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function connect(): Promise<void> {
    controller = new AbortController();
    try {
      const res = await fetch(`${base}/workspaces/${workspaceId}/events`, {
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

      onConnected?.(true);
      retryMs = 1000;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Frames end with a blank line; a ": ..." line is a comment or heartbeat.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .find((line) => line.startsWith("data:"));
          if (!data) continue;
          try {
            const parsed = JSON.parse(data.slice(5).trim()) as { scope?: EventScope };
            if (parsed.scope) onEvent(parsed.scope);
          } catch {
            /* ignore a malformed frame */
          }
        }
      }
    } catch {
      /* connection dropped or aborted */
    } finally {
      onConnected?.(false);
    }

    if (stopped) return;
    timer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, 15_000);
  }

  void connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}
