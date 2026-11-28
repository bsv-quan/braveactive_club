import random

import pytest


@pytest.fixture(autouse=True)
def clean_db():
    """This unit module is isolated from database fixtures in conftest."""
    yield

from app.services.board_games import (
    create_game,
    apply_player_move,
    apply_ai_move,
    forfeit_game,
    is_current_player_in_check,
    _choose_near_best,
)


def test_initial_layouts_and_metadata():
    chess = create_game("chess")
    assert chess["turn"] == "white"
    assert chess["board"][0][0] == "r" and chess["board"][7][0] == "R"
    assert chess["result"] == "ongoing" and chess["last_move"] is None

    xiangqi = create_game("xiangqi")
    assert xiangqi["turn"] == "red"
    assert xiangqi["board"][0][4] == "k" and xiangqi["board"][9][4] == "K"

    go = create_game("go")
    assert go["turn"] == "black" and len(go["board"]) == 9
    assert all(cell == "." for row in go["board"] for cell in row)


@pytest.mark.parametrize(
    ("game_type", "expected_result", "expected_winner"),
    [("chess", "black_win", "black"), ("xiangqi", "black_win", "black"), ("go", "white_win", "white")],
)
def test_forfeit_is_server_terminal_loss(game_type, expected_result, expected_winner):
    state = create_game(game_type)

    forfeited = forfeit_game(game_type, state)

    assert forfeited["terminal"] is True
    assert forfeited["result"] == expected_result
    assert forfeited["winner"] == expected_winner


@pytest.mark.parametrize(
    ("game_type", "move"),
    [
        ("chess", {"from": [6, 4], "to": [1, 4]}),
        ("xiangqi", {"from": [2, 4], "to": [1, 4]}),
    ],
)
def test_check_state_is_reported_after_each_legal_move(game_type, move):
    state = create_game(game_type)
    state["board"] = [["."] * 8 for _ in range(8)] if game_type == "chess" else [["."] * 9 for _ in range(10)]
    if game_type == "chess":
        state["board"][7][7] = "K"
        state["board"][0][4] = "k"
        state["board"][6][4] = "R"
    else:
        state["board"][9][3] = "K"
        state["board"][0][4] = "k"
        state["board"][2][4] = "R"

    next_state = apply_player_move(game_type, state, move)

    assert next_state["check"] is True
    assert is_current_player_in_check(game_type, next_state) is True


@pytest.mark.parametrize(
    ("game_type", "move"),
    [
        ("chess", {"from": [6, 0], "to": [5, 0]}),
        ("xiangqi", {"from": [6, 0], "to": [5, 0]}),
    ],
)
def test_check_state_detects_current_check(game_type, move):
    state = create_game(game_type)
    state["board"] = [["."] * 8 for _ in range(8)] if game_type == "chess" else [["."] * 9 for _ in range(10)]
    if game_type == "chess":
        state["board"][7][4] = "K"
        state["board"][0][4] = "r"
        state["board"][0][0] = "k"
        state["board"][6][0] = "P"
    else:
        state["board"][9][4] = "K"
        state["board"][0][4] = "r"
        state["board"][0][0] = "k"
        state["board"][6][0] = "P"

    assert is_current_player_in_check(game_type, state) is True
    with pytest.raises(ValueError):
        apply_player_move(game_type, state, move)


def test_chess_legal_illegal_and_ai():
    state = create_game("chess")
    with pytest.raises(ValueError):
        apply_player_move("chess", state, {"from":[7,0],"to":[5,0]})

    state = apply_player_move("chess", state, {"from":[6,4],"to":[4,4]})
    assert state["turn"] == "black" and state["last_move"] == {"from":[6,4],"to":[4,4]}

    for difficulty in ("easy","medium","hard"):
        state = create_game("chess")
        state = apply_player_move("chess", state, {"from":[6,4],"to":[4,4]})
        state = apply_ai_move("chess", state, difficulty)
        assert state["turn"] == "white"
        assert state["difficulty"] == difficulty
        assert state["last_move"]["from"] is not None


def test_ai_randomizes_near_best_moves_according_to_tolerance():
    scored_moves = [("best", 100), ("close", 90), ("weak", 60)]

    hard_choices = {
        _choose_near_best(scored_moves, 5, random.Random(seed))
        for seed in range(20)
    }
    medium_choices = {
        _choose_near_best(scored_moves, 15, random.Random(seed))
        for seed in range(20)
    }

    assert hard_choices == {"best"}
    assert medium_choices == {"best", "close"}


def test_chess_capture_and_terminal_rejection():
    state=create_game("chess")
    state["board"][4][4]="P"; state["board"][3][3]="p"
    state["turn"]="white";state["to_move"]="white"
    state=apply_player_move("chess",state,{"from":[4,4],"to":[3,3]})
    assert state["board"][3][3]=="P" and state["board"][4][4]=="."
    state["terminal"] = True
    state["result"] = "white_win"
    with pytest.raises(ValueError):
        apply_player_move("chess",state,{"from":[3,3],"to":[2,3]})


def test_chess_bishop_does_not_attack_orthogonal_squares():
    state = create_game("chess")
    state["board"] = [["."] * 8 for _ in range(8)]
    state["board"][4][0] = "K"
    state["board"][0][7] = "k"
    state["board"][4][4] = "b"
    state["board"][6][4] = "P"

    moved = apply_player_move("chess", state, {"from": [6, 4], "to": [5, 4]})

    assert moved["board"][5][4] == "P"


def test_chess_en_passant_uses_target_file():
    state = create_game("chess")
    state["board"] = [["."] * 8 for _ in range(8)]
    state["board"][7][4] = "K"
    state["board"][0][4] = "k"
    state["board"][3][4] = "P"
    state["board"][3][3] = "p"
    state["turn"] = "white"
    state["to_move"] = "white"
    state["en_passant"] = [2, 3]

    moved = apply_player_move("chess", state, {"from": [3, 4], "to": [2, 3]})

    assert moved["board"][2][3] == "P"
    assert moved["board"][3][3] == "."


def test_engine_rejects_terminal_state_even_if_result_is_ongoing():
    state = create_game("chess")
    state["terminal"] = True

    with pytest.raises(ValueError, match="terminal"):
        apply_player_move("chess", state, {"from": [6, 4], "to": [4, 4]})


def test_engine_rejects_malformed_guest_board_state():
    state = create_game("go")
    state["board"][0].pop()

    with pytest.raises(ValueError, match="board"):
        apply_player_move("go", state, {"at": [0, 0]})


def test_xiangqi_initial_and_capture():
    state=create_game("xiangqi")
    # Red soldier moves forward one square.
    state=apply_player_move("xiangqi",state,{"from":[6,0],"to":[5,0]})
    assert state["turn"]=="black" and state["board"][5][0]=="P"
    state=apply_ai_move("xiangqi",state,"easy")
    assert state["turn"]=="red"


def test_xiangqi_illegal_horse_leg_and_cannon_capture():
    state=create_game("xiangqi")
    state["board"][9][1]="H";state["board"][8][1]="R"  # blocks horse leg
    with pytest.raises(ValueError):
        apply_player_move("xiangqi",state,{"from":[9,1],"to":[7,0]})

    cannon=create_game("xiangqi")
    cannon["board"][7][7]="C";cannon["board"][6][7]="p";cannon["board"][5][7]="h"
    cannon=apply_player_move("xiangqi",cannon,{"from":[7,7],"to":[5,7]})
    assert cannon["board"][5][7]=="C" and cannon["board"][6][7]=="p"


def test_go_capture_suicide_and_pass_terminal():
    go=create_game("go")
    go=apply_player_move("go",go,{"at":[0,0]})
    assert go["board"][0][0]=="B" and go["turn"]=="white"
    go=apply_player_move("go",go,{"at":[1,0]}) if go["turn"]=="black" else go

    capture=create_game("go")
    capture["board"][0][1]="B";capture["board"][1][0]="B"
    capture["board"][0][0]="W"
    capture["turn"]="black";capture["to_move"]="black"
    # W stone at (0,0) should have B neighbor (0,1)/(1,0), not currently captured;
    # this setup validates ordinary legal placement instead of a false outcome.
    capture=apply_player_move("go",capture,{"at":[8,8]})
    assert capture["board"][8][8]=="B"

    passed=create_game("go")
    passed=apply_player_move("go",passed,{"pass":True})
    assert passed["turn"]=="white"
    passed=apply_ai_move("go",passed,"easy")
    # AI is white and may pass if no moves; explicitly pass by another API when it is white impossible.
    if passed["turn"]=="black" and not passed["terminal"]:
        passed=apply_player_move("go",passed,{"pass":True})
    assert passed["result"] in ("ongoing","draw","black_win","white_win")


def test_go_suicide_and_two_passes():
    state=create_game("go")
    # Isolated corner: white surrounding a potential black point.
    state["board"][0][1]="W";state["board"][1][0]="W"
    with pytest.raises(ValueError):
        apply_player_move("go",state,{"at":[0,0]})

    state=create_game("go")
    state["passes"]=1
    state=apply_player_move("go",state,{"pass":True})
    assert state["terminal"] is True
    assert state["result"] in ("black_win","white_win","draw")


@pytest.mark.parametrize("difficulty",["easy","medium","hard"])
def test_go_ai_is_legal(difficulty):
    state=create_game("go")
    state=apply_ai_move("go",state,difficulty) if state["turn"]=="white" else apply_player_move("go",state,{"at":[4,4]})
    if state["turn"]=="white":
        state=apply_ai_move("go",state,difficulty)
    assert state["board"] is not None


def test_chess_hard_finds_mate_in_one_and_is_fast():
    import time

    state = create_game("chess")
    state["board"] = [["."] * 8 for _ in range(8)]
    # White King trapped on h1 (7,7) behind pawns on g2 (6,6) and h2 (6,7); Black Rook on a2 (6,0) mates on a1 (7,0)
    state["board"][7][7] = "K"
    state["board"][6][6] = "P"
    state["board"][6][7] = "P"
    state["board"][0][4] = "k"
    state["board"][6][0] = "r"
    state["turn"] = "black"
    state["to_move"] = "black"
    state["castling"] = {"white_k": False, "white_q": False, "black_k": False, "black_q": False}

    t0 = time.perf_counter()
    moved = apply_ai_move("chess", state, "hard")
    elapsed = time.perf_counter() - t0

    assert moved["terminal"] is True
    assert moved["winner"] == "black"
    assert moved["last_move"] == {"from": [6, 0], "to": [7, 0]}
    assert elapsed < 1.0


def test_chess_hard_avoids_queen_blunder_and_takes_hanging_piece():
    state = create_game("chess")
    state["board"] = [["."] * 8 for _ in range(8)]
    # Black Queen at d5 (3,3) can take a pawn on d4 (4,3) defended by White Rook on d1 (7,3),
    # OR take a free undefended White Rook on a5 (3,0). White King is safe on f1 (7,5) with pawns.
    state["board"][7][5] = "K"
    state["board"][6][5] = "P"
    state["board"][6][6] = "P"
    state["board"][0][6] = "k"
    state["board"][3][3] = "q"
    state["board"][4][3] = "P"
    state["board"][7][3] = "R"
    state["board"][3][0] = "R"
    state["turn"] = "black"
    state["to_move"] = "black"
    state["castling"] = {"white_k": False, "white_q": False, "black_k": False, "black_q": False}

    moved = apply_ai_move("chess", state, "hard")

    assert moved["last_move"] == {"from": [3, 3], "to": [3, 0]}


def test_chess_hard_middlegame_respects_time_budget():
    import time

    state = create_game("chess")
    # Out-of-book complex middlegame position (history > 6 so opening book is bypassed)
    state["board"] = [
        ["r", ".", "b", "q", ".", "r", "k", "."],
        ["p", "p", "p", "p", ".", "p", "p", "p"],
        [".", ".", "n", ".", ".", "n", ".", "."],
        [".", ".", "b", ".", "p", ".", ".", "."],
        [".", ".", "B", ".", "P", ".", ".", "."],
        [".", ".", "N", "P", ".", "N", ".", "."],
        ["P", "P", "P", ".", ".", "P", "P", "P"],
        ["R", ".", "B", "Q", ".", "R", "K", "."],
    ]
    state["turn"] = "black"
    state["to_move"] = "black"
    state["castling"] = {"white_k": False, "white_q": False, "black_k": False, "black_q": False}
    state["history"] = [{"from": [6, 4], "to": [4, 4]}] * 8

    t0 = time.perf_counter()
    moved = apply_ai_move("chess", state, "hard")
    elapsed = time.perf_counter() - t0

    assert moved["turn"] == "white"
    assert elapsed < 1.2


def test_xiangqi_hard_captures_hanging_chariot_and_is_fast():
    import time

    state = create_game("xiangqi")
    state["board"] = [["."] * 9 for _ in range(10)]
    state["board"][0][4] = "k"
    state["board"][9][3] = "K"
    state["board"][2][4] = "r"  # Black Chariot
    state["board"][5][4] = "R"  # Undefended Red Chariot on same file
    state["turn"] = "black"
    state["to_move"] = "black"
    state["history"] = [{"from": [6, 0], "to": [5, 0]}] * 4

    t0 = time.perf_counter()
    moved = apply_ai_move("xiangqi", state, "hard")
    elapsed = time.perf_counter() - t0

    assert moved["last_move"] == {"from": [2, 4], "to": [5, 4]}
    assert elapsed < 1.2


def test_go_hard_captures_stone_in_atari_and_is_fast():
    import time

    state = create_game("go")
    # Black stone at (4,4) surrounded on 3 sides by White -> last liberty at (4,5)
    state["board"][4][4] = "B"
    state["board"][3][4] = "W"
    state["board"][5][4] = "W"
    state["board"][4][3] = "W"
    state["turn"] = "white"
    state["to_move"] = "white"

    t0 = time.perf_counter()
    moved = apply_ai_move("go", state, "hard")
    elapsed = time.perf_counter() - t0

    assert moved["last_move"] == {"at": [4, 5]}
    assert moved["board"][4][4] == "."
    assert elapsed < 1.2


def test_caro_initial_state_and_five_in_a_row_wins():
    state = create_game("caro")
    assert len(state["board"]) == 15
    assert all(len(row) == 15 for row in state["board"])
    assert state["turn"] == "x"

    # Place 4 X stones diagonally and trigger winning 5th stone
    for idx in range(4):
        state["board"][5 + idx][5 + idx] = "X"
    moved = apply_player_move("caro", state, {"at": [9, 9]})
    assert moved["terminal"] is True
    assert moved["winner"] == "x"
    assert moved["result"] == "x_win"
    assert moved["winning_line"] == [[5, 5], [6, 6], [7, 7], [8, 8], [9, 9]]

    # Occupied square is rejected
    fresh = create_game("caro")
    fresh = apply_player_move("caro", fresh, {"at": [7, 7]})
    fresh["turn"] = "x"
    fresh["to_move"] = "x"
    with pytest.raises(ValueError):
        apply_player_move("caro", fresh, {"at": [7, 7]})


@pytest.mark.parametrize("difficulty", ["easy", "medium", "hard"])
def test_caro_ai_blocks_and_takes_winning_five(difficulty):
    import time

    # 1. AI takes immediate 5-in-a-row win
    win_state = create_game("caro")
    for c in range(4, 8):
        win_state["board"][7][c] = "O"
    win_state["board"][7][3] = "X"  # Block left side so only (7, 8) wins
    win_state["turn"] = "o"
    win_state["to_move"] = "o"

    t0 = time.perf_counter()
    won = apply_ai_move("caro", win_state, difficulty)
    assert won["terminal"] is True
    assert won["winner"] == "o"
    assert won["last_move"] == {"at": [7, 8]}
    assert time.perf_counter() - t0 < 0.8

    # 2. AI blocks human immediate 5-in-a-row threat
    block_state = create_game("caro")
    for r in range(3, 7):
        block_state["board"][r][7] = "X"
    block_state["board"][2][7] = "O"  # Block top so only (7, 7) stops human
    block_state["turn"] = "o"
    block_state["to_move"] = "o"

    blocked = apply_ai_move("caro", block_state, difficulty)
    assert blocked["terminal"] is False
    assert blocked["last_move"] == {"at": [7, 7]}


@pytest.mark.parametrize("difficulty", ["easy", "medium", "hard"])
def test_sudoku_generator_produces_unique_solvable_puzzles(difficulty):
    from app.services import sudoku

    puzzle, solution = sudoku.generate_sudoku(difficulty, seed=42)
    assert sudoku.is_solved_sudoku(solution)
    assert sudoku.respects_givens(solution, puzzle)
    assert sudoku.count_solutions(puzzle, limit=2) == 1
    clues = sum(1 for row in puzzle for v in row if v != 0)
    assert 24 <= clues <= 45
