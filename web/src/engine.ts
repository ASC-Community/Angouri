import type { Action, Response, State } from './types';

export class Kernel {
  private worker!: Worker;
  private ready!: Promise<void>;
  private sequence = 0;
  private epoch = 0;
  private pending = new Map<string, { resolve: (r: Response) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  readonly measurements = { ready: [] as number[], edits: [] as number[], restarts: 0 };

  constructor(private status: (message: string, recovering: boolean) => void) { this.start(false); }

  private start(recovering: boolean) {
    const epoch = ++this.epoch;
    this.worker?.terminate();
    if (recovering) { this.measurements.restarts++; this.status('Restarting the math engine. Your saved moves are safe.', true); }
    this.worker = new Worker(new URL('engine-worker.js', document.baseURI), { type: 'module' });
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The math engine took too long to load. Check the connection and try again.')), 30000);
      this.worker.onmessage = ({ data }) => {
        if (epoch !== this.epoch) return;
        if (data.type === 'ready') { clearTimeout(timer); this.measurements.ready.push(data.milliseconds); resolve(); }
        if (data.type === 'boot-error') { clearTimeout(timer); reject(new Error('The math engine could not start. Try reloading the page.')); }
        if (data.type === 'result') {
          const job = this.pending.get(data.id);
          if (!job) return;
          clearTimeout(job.timer); this.pending.delete(data.id);
          this.measurements.edits.push(data.milliseconds);
          job.resolve(data.response);
        }
      };
      this.worker.onerror = () => { clearTimeout(timer); reject(new Error('The math engine stopped. Try again.')); this.rejectPending(); };
    });
    // A boot failure is reported through the awaiting request, not an unhandled promise.
    this.ready.catch(() => {});
  }

  private rejectPending() {
    for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(new Error('Engine interrupted')); }
    this.pending.clear();
  }

  /** Each retry uses the same unacknowledged snapshot; the stateless kernel cannot double-commit it. */
  async run(state: State | undefined, action: Action): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.ready;
        const id = `${this.epoch}-${++this.sequence}`;
        return await new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Engine interrupted')); }, 8000);
          this.pending.set(id, {resolve, reject, timer});
          this.worker.postMessage({id, request: {state, action}});
        });
      } catch (error) {
        if (attempt) throw error;
        this.rejectPending(); this.start(true);
      }
    }
    throw new Error('Engine recovery failed');
  }

  // Used by the recovery check, and by the visible Retry control after a failure.
  restart() { this.rejectPending(); this.start(true); }
}
