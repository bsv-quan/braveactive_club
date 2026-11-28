"""Self-contained 9x9 Sudoku generator and validator with unique-solution guarantee."""

import random

SUDOKU_CLUES: dict[str, int] = {
    "easy": 42,
    "medium": 33,
    "hard": 27,
}

_ALL_DIGITS_MASK = 0x3FE  # bits 1..9


def _box_index(row: int, col: int) -> int:
    return (row // 3) * 3 + (col // 3)


def _generate_complete_board(rng: random.Random) -> list[list[int]]:
    board = [[0] * 9 for _ in range(9)]
    row_mask = [0] * 9
    col_mask = [0] * 9
    box_mask = [0] * 9

    # Seed the three independent diagonal 3x3 boxes randomly for variety and speed.
    for diag in (0, 3, 6):
        digits = list(range(1, 10))
        rng.shuffle(digits)
        idx = 0
        for r in range(diag, diag + 3):
            for c in range(diag, diag + 3):
                val = digits[idx]
                idx += 1
                board[r][c] = val
                bit = 1 << val
                row_mask[r] |= bit
                col_mask[c] |= bit
                box_mask[_box_index(r, c)] |= bit

    empties = [(r, c) for r in range(9) for c in range(9) if board[r][c] == 0]

    def fill(step: int) -> bool:
        if step == len(empties):
            return True
        # Pick the empty cell with fewest legal candidates (MRV).
        best_idx = step
        best_avail = 0
        best_count = 10
        for i in range(step, len(empties)):
            r, c = empties[i]
            avail = _ALL_DIGITS_MASK & ~(row_mask[r] | col_mask[c] | box_mask[_box_index(r, c)])
            cnt = avail.bit_count()
            if cnt == 0:
                return False
            if cnt < best_count:
                best_count = cnt
                best_avail = avail
                best_idx = i
                if cnt == 1:
                    break

        empties[step], empties[best_idx] = empties[best_idx], empties[step]
        r, c = empties[step]
        b = _box_index(r, c)

        candidates = [d for d in range(1, 10) if best_avail & (1 << d)]
        rng.shuffle(candidates)
        for val in candidates:
            bit = 1 << val
            board[r][c] = val
            row_mask[r] |= bit
            col_mask[c] |= bit
            box_mask[b] |= bit
            if fill(step + 1):
                return True
            board[r][c] = 0
            row_mask[r] ^= bit
            col_mask[c] ^= bit
            box_mask[b] ^= bit

        empties[step], empties[best_idx] = empties[best_idx], empties[step]
        return False

    if not fill(0):
        raise RuntimeError("Failed to generate complete Sudoku board")
    return board


def count_solutions(board: list[list[int]], limit: int = 2) -> int:
    """Count valid solutions up to `limit` using bitmask MRV backtracking."""
    row_mask = [0] * 9
    col_mask = [0] * 9
    box_mask = [0] * 9
    empties: list[tuple[int, int]] = []

    for r in range(9):
        for c in range(9):
            val = board[r][c]
            if val == 0:
                empties.append((r, c))
            else:
                bit = 1 << val
                b = _box_index(r, c)
                if (row_mask[r] | col_mask[c] | box_mask[b]) & bit:
                    return 0
                row_mask[r] |= bit
                col_mask[c] |= bit
                box_mask[b] |= bit

    solutions = 0

    def search(step: int) -> None:
        nonlocal solutions
        if solutions >= limit:
            return
        if step == len(empties):
            solutions += 1
            return

        best_idx = step
        best_avail = 0
        best_count = 10
        for i in range(step, len(empties)):
            r, c = empties[i]
            avail = _ALL_DIGITS_MASK & ~(row_mask[r] | col_mask[c] | box_mask[_box_index(r, c)])
            cnt = avail.bit_count()
            if cnt == 0:
                return
            if cnt < best_count:
                best_count = cnt
                best_avail = avail
                best_idx = i
                if cnt == 1:
                    break

        empties[step], empties[best_idx] = empties[best_idx], empties[step]
        r, c = empties[step]
        b = _box_index(r, c)

        avail = best_avail
        while avail and solutions < limit:
            bit = avail & -avail
            avail ^= bit
            row_mask[r] |= bit
            col_mask[c] |= bit
            box_mask[b] |= bit
            search(step + 1)
            row_mask[r] ^= bit
            col_mask[c] ^= bit
            box_mask[b] ^= bit

        empties[step], empties[best_idx] = empties[best_idx], empties[step]

    search(0)
    return solutions


def generate_sudoku(difficulty: str, seed: int | None = None) -> tuple[list[list[int]], list[list[int]]]:
    """Generate a `(puzzle, solution)` pair with a guaranteed unique solution."""
    if difficulty not in SUDOKU_CLUES:
        raise ValueError("difficulty must be easy, medium, or hard")

    rng = random.Random(seed)
    solution = _generate_complete_board(rng)
    puzzle = [row[:] for row in solution]
    target_clues = SUDOKU_CLUES[difficulty]

    positions = [(r, c) for r in range(9) for c in range(9)]
    rng.shuffle(positions)
    clues_left = 81

    for r, c in positions:
        if clues_left <= target_clues:
            break
        saved = puzzle[r][c]
        puzzle[r][c] = 0
        if count_solutions(puzzle, limit=2) == 1:
            clues_left -= 1
        else:
            puzzle[r][c] = saved

    return puzzle, solution


def validate_board_shape(board: list[list[int]]) -> bool:
    return (
        isinstance(board, list)
        and len(board) == 9
        and all(
            isinstance(row, list)
            and len(row) == 9
            and all(isinstance(val, int) and not isinstance(val, bool) and 0 <= val <= 9 for val in row)
            for row in board
        )
    )


def respects_givens(board: list[list[int]], puzzle: list[list[int]]) -> bool:
    for r in range(9):
        for c in range(9):
            if puzzle[r][c] != 0 and board[r][c] != puzzle[r][c]:
                return False
    return True


def is_solved_sudoku(board: list[list[int]]) -> bool:
    if not validate_board_shape(board):
        return False
    expected = set(range(1, 10))
    for r in range(9):
        if set(board[r]) != expected:
            return False
    for c in range(9):
        if {board[r][c] for r in range(9)} != expected:
            return False
    for br in (0, 3, 6):
        for bc in (0, 3, 6):
            if {board[r][c] for r in range(br, br + 3) for c in range(bc, bc + 3)} != expected:
                return False
    return True
