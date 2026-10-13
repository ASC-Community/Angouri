import type { Action, Response, State } from './types';

type Pending = { resolve: (response: Response) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
type Epoch = {
  id: number;
  worker?: Worker;
  ready: Promise<void>;
  resolveReady: () => void;
  rejectReady: (error: Error) => void;
  bootTimer?: ReturnType<typeof setTimeout>;
  booted: boolean;
  failure?: Error;
  replacement?: Epoch;
  pending: Map<string, Pending>;
};

export class Kernel {
  private current!: Epoch;
  private sequence = 0;
  private epoch = 0;
  readonly measurements = { ready: [] as number[], edits: [] as number[], restarts: 0 };

  constructor(private status: (message: string, recovering: boolean) => void) { this.start(false); }

  private start(recovering: boolean): Epoch {
    let resolveReady!: () => void, rejectReady!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const epoch: Epoch = { id: ++this.epoch, ready, resolveReady, rejectReady, booted: false, pending: new Map() };
    this.current = epoch;
    // A boot failure is reported through the awaiting request, not an unhandled promise.
    ready.catch(() => {});
    if (recovering) { this.measurements.restarts++; this.status('Restarting the math engine. Your saved moves are safe.', true); }
    try {
      const worker = epoch.worker = new Worker(new URL('engine-worker.js', document.baseURI), { type: 'module' });
      epoch.bootTimer = setTimeout(() => this.retire(epoch, new Error('The math engine took too long to load. Check the connection and try again.')), 30000);
      worker.onmessage = ({ data }) => {
        if (epoch.failure || epoch !== this.current) return;
        if (data.type === 'ready' && !epoch.booted) {
          clearTimeout(epoch.bootTimer); epoch.bootTimer = undefined; epoch.booted = true;
          this.measurements.ready.push(data.milliseconds); epoch.resolveReady();
        }
        if (data.type === 'boot-error') this.retire(epoch, new Error('The math engine could not start. Try reloading the page.'));
        if (data.type === 'result') {
          const job = epoch.pending.get(data.id);
          if (!job) return;
          clearTimeout(job.timer); epoch.pending.delete(data.id);
          this.measurements.edits.push(data.milliseconds);
          job.resolve(data.response);
        }
      };
      worker.onerror = worker.onmessageerror = () => this.retire(epoch, new Error('The math engine stopped. Try again.'));
    } catch (error) { this.retire(epoch, error instanceof Error ? error : new Error(String(error))); }
    return epoch;
  }

  /** Retiring owns every waiter and deadline, including an unfinished boot. */
  private retire(epoch: Epoch, error: Error) {
    if (epoch.failure) return;
    epoch.failure = error;
    clearTimeout(epoch.bootTimer); epoch.bootTimer = undefined;
    if (epoch.worker) {
      epoch.worker.onmessage = epoch.worker.onerror = epoch.worker.onmessageerror = null;
      epoch.worker.terminate();
    }
    epoch.rejectReady(error);
    for (const job of epoch.pending.values()) { clearTimeout(job.timer); job.reject(error); }
    epoch.pending.clear();
  }

  /** All callers retrying this failed generation share the same replacement. */
  private recover(epoch: Epoch): Epoch {
    return epoch.replacement ??= this.start(true);
  }

  private request(epoch: Epoch, state: State | undefined, action: Action): Promise<Response> {
    const id = `${epoch.id}-${++this.sequence}`;
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (epoch.pending.has(id)) this.retire(epoch, new Error('Engine interrupted'));
      }, 8000);
      epoch.pending.set(id, {resolve, reject, timer});
      try { epoch.worker!.postMessage({id, request: {state, action}}); }
      catch (error) { this.retire(epoch, error instanceof Error ? error : new Error(String(error))); }
    });
  }

  /** Each retry uses the same unacknowledged snapshot; the stateless kernel cannot double-commit it. */
  async run(state: State | undefined, action: Action): Promise<Response> {
    let epoch = this.current.failure ? this.recover(this.current) : this.current;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await epoch.ready;
        // A ready promise may have resolved just before an explicit restart.
        if (epoch.failure) throw epoch.failure;
        return await this.request(epoch, state, action);
      } catch (error) {
        this.retire(epoch, error instanceof Error ? error : new Error(String(error)));
        if (attempt) throw error;
        epoch = this.recover(epoch);
      }
    }
    throw new Error('Engine recovery failed');
  }

  // Used by the recovery check, and by the visible Retry control after a failure.
  restart() { this.retire(this.current, new Error('Engine interrupted')); this.recover(this.current); }
}
