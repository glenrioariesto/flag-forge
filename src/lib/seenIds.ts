/**
 * Bounded set of recently seen ids, used to drop duplicate chat messages.
 *
 * The YouTube Data API can hand back the same page more than once (notably once
 * it stops returning a nextPageToken at stream end, where the service keeps
 * polling from the last known token). Re-emitting those messages made the game
 * engine spawn duplicate flags on every poll, so ids are remembered for a
 * bounded window instead.
 *
 * Insertion order is preserved so eviction can discard the oldest entries,
 * which is the correct end to forget: recent ids are the ones most likely to
 * be re-read.
 */
export class SeenIdSet {
    private ids = new Set<string>();
    private readonly cap: number;

    constructor(cap: number) {
        this.cap = Math.max(1, cap);
    }

    /** True the first time an id is offered, false on every repeat. */
    add(id: string): boolean {
        if (this.ids.has(id)) return false;
        this.ids.add(id);
        if (this.ids.size > this.cap) {
            const ordered = Array.from(this.ids);
            this.ids = new Set(ordered.slice(Math.ceil(ordered.length / 2)));
        }
        return true;
    }

    has(id: string): boolean {
        return this.ids.has(id);
    }

    clear(): void {
        this.ids.clear();
    }

    get size(): number {
        return this.ids.size;
    }
}
