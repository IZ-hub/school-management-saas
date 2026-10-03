/**
 * Minimal in-memory stand-in for the parts of the Firestore Admin API the
 * services use: collection/doc/add/where/get/update/delete/batch/runTransaction.
 */
type Data = Record<string, any>;
type Store = Map<string, Map<string, Data>>;

let nextId = 1;

class FakeDocRef {
  constructor(private store: Store, private colName: string, public id: string) {}

  private get col() {
    if (!this.store.has(this.colName)) this.store.set(this.colName, new Map());
    return this.store.get(this.colName)!;
  }

  async get() {
    const data = this.col.get(this.id);
    return {
      id: this.id,
      exists: data !== undefined,
      data: () => (data ? { ...data } : undefined),
      ref: this as FakeDocRef,
    };
  }

  async set(data: Data) {
    this.col.set(this.id, { ...data });
  }

  async update(data: Data) {
    const existing = this.col.get(this.id);
    if (!existing) throw new Error(`NOT_FOUND: ${this.colName}/${this.id}`);
    this.col.set(this.id, { ...existing, ...data });
  }

  async delete() {
    this.col.delete(this.id);
  }
}

class FakeQuery {
  constructor(
    protected store: Store,
    protected colName: string,
    private filters: [string, any][] = [],
    private max = Infinity,
  ) {}

  where(field: string, _op: '==', value: any) {
    return new FakeQuery(this.store, this.colName, [...this.filters, [field, value]], this.max);
  }

  limit(n: number) {
    return new FakeQuery(this.store, this.colName, this.filters, n);
  }

  async get() {
    const rows = [...(this.store.get(this.colName) ?? new Map()).entries()]
      .filter(([, d]) => this.filters.every(([f, v]) => d[f] === v))
      .slice(0, this.max);
    const docs = rows.map(([id, d]) => ({
      id,
      data: () => ({ ...d }),
      ref: new FakeDocRef(this.store, this.colName, id),
    }));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}

class FakeCollection extends FakeQuery {
  doc(id?: string) {
    return new FakeDocRef(this.store, this.colName, id ?? `auto-${nextId++}`);
  }

  async add(data: Data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

export class FakeFirestore {
  readonly store: Store = new Map();

  collection(name: string) {
    return new FakeCollection(this.store, name);
  }

  batch() {
    const ops: (() => Promise<void>)[] = [];
    return {
      set: (ref: FakeDocRef, data: Data) => ops.push(() => ref.set(data)),
      update: (ref: FakeDocRef, data: Data) => ops.push(() => ref.update(data)),
      delete: (ref: FakeDocRef) => ops.push(() => ref.delete()),
      commit: async () => {
        for (const op of ops) await op();
      },
    };
  }

  private txQueue: Promise<unknown> = Promise.resolve();

  /** Runs transactions one at a time, which is enough to model Firestore's isolation in tests. */
  runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const run = async () => {
      const ops: (() => Promise<void>)[] = [];
      const tx = {
        get: (ref: FakeDocRef) => ref.get(),
        set: (ref: FakeDocRef, data: Data) => ops.push(() => ref.set(data)),
        update: (ref: FakeDocRef, data: Data) => ops.push(() => ref.update(data)),
        delete: (ref: FakeDocRef) => ops.push(() => ref.delete()),
      };
      const result = await fn(tx);
      for (const op of ops) await op();
      return result;
    };
    const next = this.txQueue.then(run, run);
    this.txQueue = next.catch(() => undefined);
    return next;
  }

  /** Test helper: write a document directly. */
  seed(col: string, id: string, data: Data) {
    if (!this.store.has(col)) this.store.set(col, new Map());
    this.store.get(col)!.set(id, { ...data });
  }

  /** Test helper: read a document directly. */
  peek(col: string, id: string) {
    return this.store.get(col)?.get(id);
  }
}
