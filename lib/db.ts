// In-memory storage for tests. In production, use actual database.
let memoryStore: Map<string, any> = new Map();

export function getDb(): any {
  return {
    exec: () => {},
    prepare: (sql: string) => ({
      run: (...args: any[]) => {
        // Store operations
        if (sql.includes("INSERT")) {
          const [phone, name, orderAt] = args;
          memoryStore.set(phone, { phone, name, orderAt });
        }
        return { changes: 1 };
      },
      get: (...args: any[]) => {
        const [phone] = args;
        return memoryStore.get(phone);
      },
    }),
  };
}

export function closeDb(): void {
  memoryStore.clear();
}
