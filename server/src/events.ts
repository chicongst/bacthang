/** Trong bộ nhớ tiến trình, nên chỉ đúng khi chạy một bản API duy nhất. */
export type EventScope = "board" | "members";

export interface WorkspaceEvent {
  scope: EventScope;
  at: number;
}

type Listener = (e: WorkspaceEvent) => void;

export class EventBus {
  private readonly rooms = new Map<number, Set<Listener>>();

  subscribe(workspaceId: number, listener: Listener): () => void {
    let room = this.rooms.get(workspaceId);
    if (!room) {
      room = new Set();
      this.rooms.set(workspaceId, room);
    }
    room.add(listener);
    return () => {
      room!.delete(listener);
      if (room!.size === 0) this.rooms.delete(workspaceId);
    };
  }

  emit(workspaceId: number, scope: EventScope): void {
    const room = this.rooms.get(workspaceId);
    if (!room) return;
    const event: WorkspaceEvent = { scope, at: Date.now() };
    for (const listener of [...room]) {
      try {
        listener(event);
      } catch {
        room.delete(listener);
      }
    }
  }

  listenerCount(workspaceId: number): number {
    return this.rooms.get(workspaceId)?.size ?? 0;
  }
}
