export function getStraightPath(start: number, end: number, size: number): number[] | null {
  if (start === end) return null;
  const startRow = Math.floor(start / size);
  const startColumn = start % size;
  const endRow = Math.floor(end / size);
  const endColumn = end % size;
  const rowDistance = endRow - startRow;
  const columnDistance = endColumn - startColumn;
  if (rowDistance !== 0 && columnDistance !== 0 && Math.abs(rowDistance) !== Math.abs(columnDistance)) return null;
  const length = Math.max(Math.abs(rowDistance), Math.abs(columnDistance));
  const rowStep = Math.sign(rowDistance);
  const columnStep = Math.sign(columnDistance);
  const path = Array.from({ length: length + 1 }, (_, index) =>
    (startRow + index * rowStep) * size + startColumn + index * columnStep,
  );
  const firstPosition = { row: Math.floor(path[0] / size), column: path[0] % size };
  const lastPosition = { row: Math.floor(path[path.length - 1] / size), column: path[path.length - 1] % size };
  const isReverseOrder = firstPosition.row > lastPosition.row
    || (firstPosition.row === lastPosition.row && firstPosition.column > lastPosition.column);
  return isReverseOrder ? path.reverse() : path;
}

export function extendStraightPath(path: number[], cell: number, size: number): number[] | null {
  if (path.length < 2) return null;
  const firstRow = Math.floor(path[0] / size);
  const firstColumn = path[0] % size;
  const secondRow = Math.floor(path[1] / size);
  const secondColumn = path[1] % size;
  const rowStep = Math.sign(secondRow - firstRow);
  const columnStep = Math.sign(secondColumn - firstColumn);
  const last = path[path.length - 1];
  const lastRow = Math.floor(last / size);
  const lastColumn = last % size;
  const nextRow = lastRow + rowStep;
  const nextColumn = lastColumn + columnStep;
  if (nextRow >= 0 && nextRow < size && nextColumn >= 0 && nextColumn < size
    && nextRow * size + nextColumn === cell) {
    return [...path, cell];
  }
  const previousRow = firstRow - rowStep;
  const previousColumn = firstColumn - columnStep;
  if (previousRow >= 0 && previousRow < size && previousColumn >= 0 && previousColumn < size
    && previousRow * size + previousColumn === cell) {
    return [cell, ...path];
  }
  return null;
}

export function updateWordSearchSelection(
  path: number[],
  cell: number,
  size: number,
): { path: number[]; isValid: boolean } {
  if (path.length === 0 || path.includes(cell)) {
    return { path: [cell], isValid: true };
  }
  if (path.length === 1) {
    const straightPath = getStraightPath(path[0], cell, size);
    return straightPath
      ? { path: straightPath, isValid: true }
      : { path, isValid: false };
  }
  return {
    path: extendStraightPath(path, cell, size) ?? [cell],
    isValid: true,
  };
}
