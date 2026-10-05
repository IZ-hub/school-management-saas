/**
 * Minimal in-memory stand-in for the parts of the Firestore Admin API the
 * services use: collection/doc/add/where/get/update/delete/batch/runTransaction.
 */
type Data = Record<string, any>;
type Store = Map<string, Map<string, Data>> & { reads?: number; refuseAggregates?: boolean };

let nextId = 1;

const matches = (actual: any, op: string, v: any) =>
  op === '==' ? actual === v : op === '>=' ? actual >= v : op === '<=' ? actual <= v : op === '>' ? actual > v : op === '<' ? actual < v : false;

class FakeDocRef {
  constructor(private store: Store, private colName: string, public id: string) {}

  private get col() {
    if (!this.store.has(this.colName)) this.store.set(this.colName, new Map());
    return this.store.get(this.colName)!;
  }

  async get() {
    this.store.reads = (this.store.reads ?? 0) + 1;
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
    private filters: [string, string, any][] = [],
    private max = Infinity,
  ) {}

  where(field: string, op: '==' | '>=' | '<=' | '>' | '<', value: any) {
    return new FakeQuery(this.store, this.colName, [...this.filters, [field, op, value]], this.max);
  }

  limit(n: number) {
    return new FakeQuery(this.store, this.colName, this.filters, n);
  }

  private rows() {
    return [...(this.store.get(this.colName) ?? new Map()).entries()]
      .filter(([, d]) => this.filters.every(([f, op, v]) => matches(d[f], op, v)))
      .slice(0, this.max);
  }

  /** Aggregates (sum/count): billed like Firestore, one read per 1,000 documents. */
  aggregate(spec: Record<string, { aggregateType: string; _field?: string }>) {
    return {
      get: async () => {
        if (this.store.refuseAggregates) throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
        const rows = this.rows();
        this.store.reads = (this.store.reads ?? 0) + Math.max(1, Math.ceil(rows.length / 1000));
        const out: Record<string, number> = {};
        for (const [k, f] of Object.entries(spec)) {
          out[k] = f.aggregateType === 'count' ? rows.length : rows.reduce((a, [, d]) => a + (typeof d[f._field!] === 'number' ? d[f._field!] : 0), 0);
        }
        return { data: () => out };
      },
    };
  }

  /** Aggregate count: Firestore bills one read per 1,000 documents counted. */
  count() {
    return {
      get: async () => {
        if (this.store.refuseAggregates) throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
        const n = this.rows().length;
        this.store.reads = (this.store.reads ?? 0) + Math.max(1, Math.ceil(n / 1000));
        return { data: () => ({ count: n }) };
      },
    };
  }

  async get() {
    const rows = this.rows();
    // Firestore bills a query that returns nothing as one read.
    this.store.reads = (this.store.reads ?? 0) + Math.max(1, rows.length);
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
