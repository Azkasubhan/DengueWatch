// Chainable stand-in for a Supabase query builder in unit tests: every method call is
// recorded in `calls` and returns the builder; awaiting it resolves to `result`.
export type QueryCall = [string, unknown[]];
export type QueryResult = { data?: unknown; error?: unknown };
export type QueryMock = Record<string, unknown> & { calls: QueryCall[] };

export function query(result: QueryResult = {}): QueryMock {
  const calls: QueryCall[] = [];
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then")
          return (resolve: (value: QueryResult) => unknown) =>
            Promise.resolve({ data: null, error: null, ...result }).then(
              resolve,
            );
        if (prop === "calls") return calls;
        return (...args: unknown[]) => {
          calls.push([String(prop), args]);
          return builder;
        };
      },
    },
  );
  return builder as QueryMock;
}

// Admin client whose `from(table)` hands out the queued queries for that table in order.
export function queuedTables(tables: Record<string, QueryMock[]>) {
  return (table: string) => {
    const next = tables[table]?.shift();
    if (!next) throw new Error(`unexpected query on ${table}`);
    return next;
  };
}
