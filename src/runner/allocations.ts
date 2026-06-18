import fs from "node:fs/promises";
import path from "node:path";

/**
 * Persisted record of the ports the scheduler has handed out to projects whose
 * desired port was taken. Survives dashboard restarts so a project keeps its
 * de-conflicted port (stable bookmarks) instead of re-rolling every launch.
 *
 * Stored in its own file (not projects.json) so it stays decoupled from the
 * scan/merge pipeline and never collides with user-editable fields.
 *
 * The in-memory Map is the source of truth during a session; writes are
 * serialized through a single promise chain so concurrent start-tree launches
 * can't corrupt the file or clobber each other's entries.
 */
export class AllocationStore {
  private map = new Map<string, number>();
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(private readonly file: string) {}

  static async load(file: string): Promise<AllocationStore> {
    const store = new AllocationStore(file);
    try {
      const raw = await fs.readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [id, port] of Object.entries(parsed)) {
        if (typeof port === "number" && Number.isInteger(port) && port > 0 && port <= 65535) {
          store.map.set(id, port);
        }
      }
    } catch {
      // Missing or corrupt file → start empty. A bad allocations file must
      // never block launching projects.
    }
    return store;
  }

  get(id: string): number | undefined {
    return this.map.get(id);
  }

  /** Record (or update) a project's allocated port and persist it. */
  set(id: string, port: number): Promise<void> {
    if (this.map.get(id) === port) return this.writeChain;
    this.map.set(id, port);
    return this.flush();
  }

  /** Drop a project's allocation (e.g. user reset its port) and persist. */
  clear(id: string): Promise<void> {
    if (!this.map.has(id)) return this.writeChain;
    this.map.delete(id);
    return this.flush();
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.map);
  }

  private flush(): Promise<void> {
    const payload = JSON.stringify(this.snapshot(), null, 2);
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.writeFile(this.file, payload, "utf-8");
      });
    return this.writeChain;
  }
}
