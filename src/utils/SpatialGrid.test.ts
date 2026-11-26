import { describe, expect, it } from 'vitest';
import { SpatialGrid, SpatialItem } from './SpatialGrid';

interface TestEntity extends SpatialItem {
  id: string;
}

describe('SpatialGrid', () => {
  it('inserta entidades y recupera solo las celdas dentro del radio', () => {
    const grid = new SpatialGrid<TestEntity>(64, 390, 693);
    const a: TestEntity = { id: 'a', x: 20, y: 20 };
    const b: TestEntity = { id: 'b', x: 50, y: 40 };
    const far: TestEntity = { id: 'far', x: 350, y: 650 };

    grid.insert(a);
    grid.insert(b);
    grid.insert(far);

    expect(grid.itemCount).toBe(3);

    const nearby = grid.query(30, 30, 30);
    expect(nearby).toContain(a);
    expect(nearby).toContain(b);
    expect(nearby).not.toContain(far);
  });

  it('reutiliza el buffer de salida sin duplicar resultados previos', () => {
    const grid = new SpatialGrid<TestEntity>(64, 390, 693);
    const a: TestEntity = { id: 'a', x: 10, y: 10 };
    const b: TestEntity = { id: 'b', x: 300, y: 300 };

    grid.insert(a);
    grid.insert(b);

    const out: TestEntity[] = [];
    grid.query(10, 10, 20, out);
    expect(out.map((e) => e.id)).toEqual(['a']);

    grid.query(300, 300, 20, out);
    expect(out.map((e) => e.id)).toEqual(['b']);
  });

  it('acota coordenadas fuera de los límites y limpia correctamente con clear y resize', () => {
    const grid = new SpatialGrid<TestEntity>(64, 200, 200);
    const negative: TestEntity = { id: 'neg', x: -100, y: -50 };
    const overflow: TestEntity = { id: 'over', x: 999, y: 999 };

    grid.insert(negative);
    grid.insert(overflow);

    expect(grid.query(0, 0, 10)).toContain(negative);
    expect(grid.query(199, 199, 10)).toContain(overflow);

    grid.clear();
    expect(grid.itemCount).toBe(0);
    expect(grid.query(0, 0, 500)).toEqual([]);

    grid.resize(500, 900);
    expect(grid.cellCount).toBe(Math.ceil(500 / 64) * Math.ceil(900 / 64));
  });

  it('maneja radios negativos o no finitos sin lanzar errores', () => {
    const grid = new SpatialGrid<TestEntity>(64, 390, 693);
    const a: TestEntity = { id: 'a', x: 100, y: 100 };
    grid.insert(a);

    expect(grid.query(100, 100, -50)).toContain(a);
    expect(grid.query(100, 100, Number.NaN)).toContain(a);
  });
});