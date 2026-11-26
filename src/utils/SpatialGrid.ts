export interface SpatialItem {
  x: number;
  y: number;
}

export class SpatialGrid<T extends SpatialItem> {
  private cols = 1;
  private rows = 1;
  private cells: T[][] = [];
  private count = 0;

  constructor(
    private readonly cellSize = 64,
    width = 400,
    height = 800
  ) {
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    const safeW = Number.isFinite(width) && width > 0 ? width : this.cellSize;
    const safeH = Number.isFinite(height) && height > 0 ? height : this.cellSize;
    const nextCols = Math.max(1, Math.ceil(safeW / this.cellSize));
    const nextRows = Math.max(1, Math.ceil(safeH / this.cellSize));
    const total = nextCols * nextRows;

    this.cols = nextCols;
    this.rows = nextRows;

    if (this.cells.length < total) {
      for (let i = this.cells.length; i < total; i++) {
        this.cells.push([]);
      }
    } else if (this.cells.length > total) {
      this.cells.length = total;
    }
    this.clear();
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0;
    }
    this.count = 0;
  }

  insert(item: T): void {
    const col = this.clampCol(Math.floor(item.x / this.cellSize));
    const row = this.clampRow(Math.floor(item.y / this.cellSize));
    this.cells[row * this.cols + col].push(item);
    this.count++;
  }

  query(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    if (this.count === 0) return out;
    const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;

    const minCol = this.clampCol(Math.floor((x - r) / this.cellSize));
    const maxCol = this.clampCol(Math.floor((x + r) / this.cellSize));
    const minRow = this.clampRow(Math.floor((y - r) / this.cellSize));
    const maxRow = this.clampRow(Math.floor((y + r) / this.cellSize));

    for (let row = minRow; row <= maxRow; row++) {
      const rowOffset = row * this.cols;
      for (let col = minCol; col <= maxCol; col++) {
        const cell = this.cells[rowOffset + col];
        for (let i = 0; i < cell.length; i++) {
          out.push(cell[i]);
        }
      }
    }
    return out;
  }

  get itemCount(): number {
    return this.count;
  }

  get cellCount(): number {
    return this.cells.length;
  }

  private clampCol(col: number): number {
    if (col < 0) return 0;
    if (col >= this.cols) return this.cols - 1;
    return col;
  }

  private clampRow(row: number): number {
    if (row < 0) return 0;
    if (row >= this.rows) return this.rows - 1;
    return row;
  }
}