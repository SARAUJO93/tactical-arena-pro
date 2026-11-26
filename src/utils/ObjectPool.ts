export class ObjectPool<T> {
  private pool: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly resetFn: (item: T) => void,
    initialSize = 0
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire(): T {
    const item = this.pool.pop() ?? this.factory();
    this.resetFn(item);
    return item;
  }

  release(item: T): void {
    this.pool.push(item);
  }

  clear(): void {
    this.pool.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }
}
