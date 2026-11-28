"""Self-contained board-game engines for chess, xiangqi and 9x9 Go.

Canonical move payloads:
* chess: ``{"from": [row, col], "to": [row, col], "promotion": "q|r|b|n"}``
  (promotion is optional except when promoting).
* xiangqi: ``{"from": [row, col], "to": [row, col]}``.
* go: ``{"at": [row, col]}`` or ``{"pass": true}``.

All moves use zero-based board coordinates with row 0 at the top of the
board (chess black back rank; xiangqi black back rank).  Chess and xiangqi
use 2-D lists of strings (uppercase = human/red/white respectively;
lowercase = AI/black); empty squares are ``"."``.  Go uses ``"B"``,
2=white, and ``None`` for empty.

Returned state is JSON serializable and always contains ``game_type``,
``board``, ``turn`` (``white``/``red``/``black``), ``result``
(``ongoing``, ``white_win``, ``black_win``, ``red_win``, or ``draw``), ``winner`` (a side or
``None``), and ``terminal``.  The human is always white for chess, red for
xiangqi, and black for Go.  ``apply_player_move`` and ``apply_ai_move``
never trust any client-supplied result or winner.
"""

from copy import deepcopy
import random
import time


def _clone(state):
    return deepcopy(state)


def _coords(move, kinds=("from", "to")):
    if not isinstance(move, dict):
        raise ValueError("move must be an object")
    out = []
    for key in kinds:
        value = move.get(key)
        if isinstance(value, (list, tuple)) and len(value) == 2:
            out.append((int(value[0]), int(value[1])))
        else:
            raise ValueError("move must contain integer row/column coordinates")
    return tuple(out)


def _inside(r, c, rows, cols):
    return 0 <= r < rows and 0 <= c < cols


def _piece_side(p):
    if p is None:
        return None
    return "white" if p.isupper() else "black"


def _terminal(state, winner=None, result=None):
    state["terminal"] = result != "ongoing" if result is not None else winner is not None
    state["winner"] = winner
    state["result"] = result if result is not None else ("ongoing" if winner is None else "win")


# ------------------------------ Chess ------------------------------

_CHESS_PIECES = "prnbqkPRNBQK"


def _chess_initial():
    board = [[None] * 8 for _ in range(8)]
    order = list("rnbqkbnr")
    board[0] = [p.lower() for p in order]
    board[1] = ["p"] * 8
    board[6] = ["P"] * 8
    board[7] = list("RNBQKBNR")
    return board


def _chess_base_state():
    return {"game_type": "chess", "board": _chess_initial(), "turn": "white",
            "to_move": "white", "human": "white", "ai": "black",
            "result": "ongoing", "winner": None, "terminal": False,
            "difficulty": None, "last_move": None, "check": False,
            "castling": {"white_k": True, "white_q": True,
                         "black_k": True, "black_q": True},
            "en_passant": None, "halfmove": 0,
            "position_history": [], "history": []}


def _king_square(board, side):
    target = "K" if side == "white" else "k"
    for r in range(8):
        for c in range(8):
            if board[r][c] == target:
                return r, c
    return None


_KNIGHT_DELTAS = ((1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2))
_ORTHO_DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))
_DIAG_DIRS = ((1, 1), (1, -1), (-1, 1), (-1, -1))
_KING_DELTAS = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))


def _chess_attacked(board, r, c, by_side):
    """Fast outward attack detection from target square (r, c)."""
    by_white = by_side == "white"
    # Pawn attacks
    pr = r + 1 if by_white else r - 1
    if 0 <= pr < 8:
        pawn = "P" if by_white else "p"
        if c > 0 and board[pr][c - 1] == pawn:
            return True
        if c < 7 and board[pr][c + 1] == pawn:
            return True
    # Knight attacks
    knight = "N" if by_white else "n"
    for dr, dc in _KNIGHT_DELTAS:
        nr, nc = r + dr, c + dc
        if 0 <= nr < 8 and 0 <= nc < 8 and board[nr][nc] == knight:
            return True
    # King attacks
    king = "K" if by_white else "k"
    for dr, dc in _KING_DELTAS:
        nr, nc = r + dr, c + dc
        if 0 <= nr < 8 and 0 <= nc < 8 and board[nr][nc] == king:
            return True
    # Orthogonal sliders (Rook / Queen)
    rq = ("R", "Q") if by_white else ("r", "q")
    for dr, dc in _ORTHO_DIRS:
        nr, nc = r + dr, c + dc
        while 0 <= nr < 8 and 0 <= nc < 8:
            p = board[nr][nc]
            if p is not None:
                if p in rq:
                    return True
                break
            nr += dr
            nc += dc
    # Diagonal sliders (Bishop / Queen)
    bq = ("B", "Q") if by_white else ("b", "q")
    for dr, dc in _DIAG_DIRS:
        nr, nc = r + dr, c + dc
        while 0 <= nr < 8 and 0 <= nc < 8:
            p = board[nr][nc]
            if p is not None:
                if p in bq:
                    return True
                break
            nr += dr
            nc += dc
    return False


def _chess_in_check(board, side):
    sq = _king_square(board, side)
    if sq is None:
        return True
    return _chess_attacked(board, sq[0], sq[1], "black" if side == "white" else "white")


def _chess_pseudo(board, r, c):
    p = board[r][c]
    if p is None:
        return []
    side = _piece_side(p)
    pt = p.lower()
    moves = []
    if pt == "p":
        direction = -1 if side == "white" else 1
        start = 6 if side == "white" else 1
        nr = r + direction
        if _inside(nr, c, 8, 8) and board[nr][c] is None:
            moves.append((nr, c))
            nr2 = r + 2 * direction
            if r == start and board[nr2][c] is None:
                moves.append((nr2, c))
        for dc in (-1, 1):
            nr, nc = r + direction, c + dc
            if _inside(nr, nc, 8, 8) and board[nr][nc] is not None and _piece_side(board[nr][nc]) != side:
                moves.append((nr, nc))
    elif pt == "n":
        for dr, dc in ((1,2),(2,1),(2,-1),(1,-2),(-1,-2),(-2,-1),(-2,1),(-1,2)):
            nr, nc = r+dr, c+dc
            if _inside(nr,nc,8,8) and (board[nr][nc] is None or _piece_side(board[nr][nc]) != side):
                moves.append((nr,nc))
    elif pt == "k":
        for dr in (-1,0,1):
            for dc in (-1,0,1):
                if dr or dc:
                    nr,nc=r+dr,c+dc
                    if _inside(nr,nc,8,8) and (board[nr][nc] is None or _piece_side(board[nr][nc]) != side):
                        moves.append((nr,nc))
    else:
        dirs=[]
        if pt in "rq": dirs += ((1,0),(-1,0),(0,1),(0,-1))
        if pt in "bq": dirs += ((1,1),(1,-1),(-1,1),(-1,-1))
        for dr,dc in dirs:
            nr,nc=r+dr,c+dc
            while _inside(nr,nc,8,8):
                if board[nr][nc] is None:
                    moves.append((nr,nc))
                else:
                    if _piece_side(board[nr][nc]) != side:
                        moves.append((nr,nc))
                    break
                nr+=dr; nc+=dc
    return moves


def _chess_legal_moves(state, from_square=None):
    board=state["board"]; side=state["turn"]
    moves=[]
    for r in range(8):
        for c in range(8):
            if from_square is not None and (r,c) != from_square:
                continue
            p=board[r][c]
            if p is None or _piece_side(p) != side:
                continue
            for to in _chess_pseudo(board,r,c):
                tr,tc=to
                # en passant
                ep=state.get("en_passant")
                if p.lower()=="p" and (tr,tc)==tuple(ep or ()):
                    cap_r=r
                    cap_c=tc
                    if board[tr][tc] is None:
                        moves.append(((r,c),(tr,tc),None))
                        continue
                moves.append(((r,c),(tr,tc),None))
            # pawn capture en passant is represented through pseudo only if ep target is None
    # Add ep separately
    ep=state.get("en_passant")
    if ep:
        er,ec=ep
        for c in range(8):
            r=er+1 if side=="white" else er-1
            if not _inside(r,c,8,8): continue
            p=board[r][c]
            if p is not None and p.lower()=="p" and _piece_side(p)==side and abs(c-ec)==1:
                moves.append(((r,c),(er,ec),None))
    # castling
    rights=state.get("castling", {})
    kr, kc = (7,4) if side=="white" else (0,4)
    enemy="black" if side=="white" else "white"
    if board[kr][kc]==("K" if side=="white" else "k") and not _chess_in_check(board,side):
        if rights.get("white_k" if side=="white" else "black_k", False) and board[kr][7]==("R" if side=="white" else "r"):
            if board[kr][5] is None and board[kr][6] is None and not _chess_attacked(board,kr,5,enemy) and not _chess_attacked(board,kr,6,enemy):
                moves.append(((kr,kc),(kr,6),None))
        if rights.get("white_q" if side=="white" else "black_q", False) and board[kr][0]==("R" if side=="white" else "r"):
            if board[kr][1] is None and board[kr][2] is None and board[kr][3] is None and not _chess_attacked(board,kr,3,enemy) and not _chess_attacked(board,kr,2,enemy):
                moves.append(((kr,kc),(kr,2),None))
    # promotions and legality (in-place make/unmake, zero deepcopy)
    legal=[]
    ep_tuple=tuple(ep) if ep else None
    for a,b,_ in moves:
        r,c=a; tr,tc=b
        p=board[r][c]
        captured=board[tr][tc]
        is_ep=p.lower()=="p" and ep_tuple is not None and (tr,tc)==ep_tuple and captured is None
        ep_captured=board[r][tc] if is_ep else None
        board[tr][tc]=p; board[r][c]=None
        if is_ep:
            board[r][tc]=None
        if p.lower()=="p" and tr in (0,7):
            for prom in "qrbn":
                board[tr][tc]=prom.upper() if side=="white" else prom
                if not _chess_in_check(board,side):
                    legal.append((a,b,prom))
        elif not _chess_in_check(board,side):
            legal.append((a,b,None))
        # restore
        board[r][c]=p; board[tr][tc]=captured
        if is_ep:
            board[r][tc]=ep_captured
    # deduplicate
    seen=set(); out=[]
    for m in legal:
        if m not in seen: seen.add(m); out.append(m)
    return out


def _chess_make_move(state, move, check_legality=True):
    if isinstance(move, dict):
        sr,sc=move.get("from", [None,None])
        tr,tc=move.get("to", [None,None])
        try:
            a=(int(sr),int(sc)); b=(int(tr),int(tc))
            promotion=str(move.get("promotion","q")).lower() if str(move.get("promotion","q")).lower() in "qrbn" else "q"
        except (TypeError,ValueError): raise ValueError("invalid move coordinates")
    else:
        a,b,promotion=move
    side=state["turn"]
    if check_legality:
        legal=_chess_legal_moves(state)
        matches=[m for m in legal if m[0]==a and m[1]==b]
        if not matches:
            raise ValueError("illegal chess move")
        if promotion:
            matches=[m for m in matches if m[2] is None or m[2]==promotion]
            if not matches:
                raise ValueError("invalid or missing promotion")
        chosen=matches[0]
        promotion=chosen[2] or promotion
    board=state["board"]
    p=board[a[0]][a[1]]
    captured=board[b[0]][b[1]]
    ep=state.get("en_passant")
    if p.lower()=="p" and tuple(b)==tuple(ep or ()) and captured is None:
        captured=board[a[0]][b[1]]
        board[a[0]][b[1]]=None
    board[b[0]][b[1]]=p; board[a[0]][a[1]]=None
    if p.lower()=="p" and b[0] in (0,7):
        board[b[0]][b[1]]=promotion.upper() if side=="white" else promotion
    if p.lower()=="k" and abs(b[1]-a[1])==2:
        if b[1]==6:
            rook=(b[0],7); target=(b[0],5)
        else:
            rook=(b[0],0); target=(b[0],3)
        board[target[0]][target[1]]=board[rook[0]][rook[1]]; board[rook[0]][rook[1]]=None
    rights=state.setdefault("castling", {})
    if p=="K": rights.update({"white_k":False,"white_q":False})
    if p=="k": rights.update({"black_k":False,"black_q":False})
    if p in ("R","r"):
        if a==(7,0): rights["white_q"]=False
        if a==(7,7): rights["white_k"]=False
        if a==(0,0): rights["black_q"]=False
        if a==(0,7): rights["black_k"]=False
    if captured in ("R","r"):
        if b==(7,0): rights["white_q"]=False
        if b==(7,7): rights["white_k"]=False
        if b==(0,0): rights["black_q"]=False
        if b==(0,7): rights["black_k"]=False
    state["en_passant"]=[(a[0]+b[0])//2,b[1]] if p.lower()=="p" and abs(b[0]-a[0])==2 else None
    state["halfmove"]=0 if p.lower()=="p" or captured is not None else state.get("halfmove",0)+1
    lm={"from":[a[0],a[1]],"to":[b[0],b[1]]}
    if p.lower()=="p" and b[0] in (0,7): lm["promotion"]=promotion
    state["history"].append(lm); state["last_move"]=_clone(lm)
    state["turn"]="black" if side=="white" else "white"; state["to_move"]=state["turn"]
    _chess_finish(state)
    return state


def _chess_position_key(board, turn, rights, ep):
    return repr(board)+"|"+turn+"|"+repr(rights)+"|"+repr(ep)


def _chess_finish(state):
    board=state["board"]; side=state["turn"]
    if not _chess_king_square(board,side):
        state["check"] = True
        winner="black" if side=="white" else "white"
        state.update(result=(winner+"_win"),winner=winner,terminal=True); return
    state["check"] = _chess_in_check(board, side)
    moves=_chess_legal_moves(state)
    if not moves:
        if _chess_in_check(board,side):
            winner="black" if side=="white" else "white"
            state.update(result=(winner+"_win"),winner=winner,terminal=True)
            state["checkmate"]=True
        else:
            state.update(result="draw",winner="draw",terminal=True)
            state["stalemate"]=True
        return
    # insufficient material
    pieces=[(p,r,c) for r,row in enumerate(board) for c,p in enumerate(row) if p]
    minors=[p.lower() for p,r,c in pieces if p.lower() in "rbq"]
    if len(pieces)==2 or (len(pieces)==3 and all(p.lower()=="k" or p.lower() in "bn" for p,r,c in pieces)):
        state.update(result="draw",winner="draw",terminal=True); return
    if state.get("halfmove",0)>=100:
        state.update(result="draw",winner="draw",terminal=True); return
    key=_chess_position_key(board,side,state.get("castling",{}),state.get("en_passant"))
    hist=state.setdefault("position_history",[]); hist.append(key)
    if hist.count(key)>=3:
        state.update(result="draw",winner="draw",terminal=True)


def _chess_king_square(board,side):
    return _king_square(board,side)


_CHESS_MG_VALUE = {"p": 82, "n": 337, "b": 365, "r": 477, "q": 1025, "k": 20000}
_CHESS_EG_VALUE = {"p": 94, "n": 281, "b": 297, "r": 512, "q": 936, "k": 20000}
_CHESS_PHASE_WEIGHT = {"p": 0, "n": 1, "b": 1, "r": 2, "q": 4, "k": 0}
_CHESS_MVV_VAL = {"p": 100, "n": 320, "b": 330, "r": 500, "q": 900, "k": 10000}

# PeSTO Piece-Square Tables (from White's perspective: row 0 = rank 8, row 7 = rank 1)
_PST_MG = {
    "p": (
        (0, 0, 0, 0, 0, 0, 0, 0),
        (98, 134, 61, 95, 68, 126, 34, -11),
        (-6, 7, 26, 31, 65, 56, 25, -20),
        (-14, 13, 6, 21, 23, 12, 17, -23),
        (-27, -2, -5, 12, 17, 6, 10, -25),
        (-26, -4, -4, -10, 3, 3, 33, -12),
        (-35, -1, -20, -23, -15, 24, 38, -22),
        (0, 0, 0, 0, 0, 0, 0, 0),
    ),
    "n": (
        (-167, -89, -34, -49, 61, -97, -15, -107),
        (-73, -41, 72, 36, 23, 62, 7, -17),
        (-47, 60, 37, 65, 84, 129, 73, 44),
        (-9, 17, 19, 53, 37, 69, 18, 22),
        (-13, 4, 16, 13, 28, 19, 21, -8),
        (-23, -9, 12, 10, 19, 17, 25, -16),
        (-29, -53, -12, -3, -1, 18, -14, -19),
        (-105, -21, -58, -33, -17, -28, -19, -23),
    ),
    "b": (
        (-29, 4, -82, -37, -25, -42, 7, -8),
        (-26, 16, -18, -13, 30, 59, 18, -47),
        (-16, 37, 43, 40, 35, 50, 37, -2),
        (-4, 5, 19, 50, 37, 37, 7, -2),
        (-6, 13, 13, 26, 34, 12, 10, 4),
        (0, 15, 15, 15, 14, 27, 18, 10),
        (4, 15, 16, 0, 7, 21, 33, 1),
        (-33, -3, -14, -21, -13, -12, -39, -21),
    ),
    "r": (
        (32, 42, 32, 51, 63, 9, 31, 43),
        (27, 32, 58, 62, 80, 67, 26, 44),
        (-5, 19, 26, 36, 17, 45, 61, 16),
        (-24, -11, 7, 26, 24, 35, -8, -20),
        (-36, -26, -12, -1, 9, -7, 6, -23),
        (-45, -25, -16, -17, 3, 0, -5, -33),
        (-44, -16, -20, -9, -1, 11, -6, -71),
        (-19, -13, 1, 17, 16, 7, -37, -26),
    ),
    "q": (
        (-28, 0, 29, 12, 59, 44, 43, 45),
        (-24, -39, -5, 1, -16, 57, 28, 54),
        (-13, -17, 7, 8, 29, 56, 47, 57),
        (-27, -27, -16, -16, -1, 17, -2, 1),
        (-9, -26, -9, -10, -2, -4, 3, -3),
        (-14, 2, -11, -2, -5, 2, 14, 5),
        (-35, -8, 11, 2, 8, 15, -3, 1),
        (-1, -18, -9, 10, -15, -25, -31, -50),
    ),
    "k": (
        (-65, 23, 16, -15, -56, -34, 2, 13),
        (29, -1, -20, -7, -8, -4, -38, -29),
        (-9, 24, 2, -16, -20, 6, 22, -22),
        (-17, -20, -12, -27, -30, -25, -14, -36),
        (-49, -1, -27, -39, -46, -44, -33, -51),
        (-14, -14, -22, -46, -44, -30, -15, -27),
        (1, 7, -8, -64, -43, -16, 9, 8),
        (-15, 36, 12, -54, 8, -28, 24, 14),
    ),
}

_PST_EG = {
    "p": (
        (0, 0, 0, 0, 0, 0, 0, 0),
        (178, 173, 158, 134, 147, 132, 165, 187),
        (94, 100, 85, 67, 56, 53, 82, 84),
        (32, 24, 13, 5, -2, 4, 17, 17),
        (13, 9, -3, -7, -7, -8, 3, -1),
        (4, 7, -6, 1, 0, -5, -1, -8),
        (13, 8, 8, 10, 13, 0, 2, -7),
        (0, 0, 0, 0, 0, 0, 0, 0),
    ),
    "n": (
        (-58, -38, -13, -28, -31, -27, -63, -99),
        (-25, -8, -25, -2, -9, -25, -24, -52),
        (-24, -20, 10, 9, -1, -9, -19, -41),
        (-17, 3, 22, 22, 22, 11, 8, -18),
        (-18, -6, 16, 25, 16, 17, 4, -18),
        (-23, -3, -1, 15, 10, -3, -20, -22),
        (-42, -20, -10, -5, -2, -20, -23, -44),
        (-29, -51, -23, -15, -22, -18, -50, -64),
    ),
    "b": (
        (-14, -21, -11, -8, -7, -9, -17, -24),
        (-8, -4, 7, -12, -3, -13, -4, -14),
        (2, -8, 0, -1, -2, 6, 0, 4),
        (-3, 9, 12, 9, 14, 10, 3, 2),
        (-6, 3, 13, 19, 7, 10, -3, -9),
        (-12, -3, 8, 10, 13, 3, -7, -15),
        (-14, -18, -7, -1, 4, -9, -15, -27),
        (-23, -9, -23, -5, -9, -16, -5, -17),
    ),
    "r": (
        (13, 10, 18, 15, 12, 12, 8, 5),
        (11, 13, 13, 11, -3, 3, 8, 3),
        (7, 7, 7, 5, 4, -3, -5, -3),
        (4, 3, 13, 1, 2, 1, -1, 2),
        (3, 5, 8, 4, -5, -6, -8, -11),
        (-4, 0, -5, -1, -7, -12, -8, -16),
        (-6, -6, 0, 2, -9, -9, -11, -3),
        (-9, 2, 3, -1, -5, -13, 4, -20),
    ),
    "q": (
        (-9, 22, 22, 27, 27, 19, 10, 20),
        (-17, 20, 32, 41, 58, 25, 30, 0),
        (-20, 6, 9, 49, 47, 35, 19, 9),
        (3, 22, 24, 45, 57, 40, 57, 36),
        (-18, 28, 19, 47, 31, 34, 39, 23),
        (-16, -27, 15, 6, 9, 17, 10, 5),
        (-22, -23, -30, -16, -16, -23, -36, -32),
        (-33, -28, -22, -43, -5, -32, -20, -41),
    ),
    "k": (
        (-74, -35, -18, -18, -11, 15, 4, -17),
        (-12, 17, 14, 17, 17, 38, 23, 11),
        (10, 17, 23, 15, 20, 45, 44, 13),
        (-8, 22, 24, 27, 26, 33, 26, 3),
        (-18, -4, 21, 24, 27, 23, 9, -11),
        (-19, -3, 11, 21, 23, 16, 7, -9),
        (-27, -11, 4, 13, 14, 4, -5, -17),
        (-53, -34, -21, -11, -28, -14, -24, -43),
    ),
}

# Classical opening book for Black responses keyed by tuple of ((fr,fc),(tr,tc)) history
_CHESS_OPENING_BOOK = {
    # 1.e4 -> Sicilian (c5), Open (e5), French (e6), Caro-Kann (c6)
    (((6, 4), (4, 4)),): [((1, 2), (3, 2), None), ((1, 4), (3, 4), None), ((1, 4), (2, 4), None), ((1, 2), (2, 2), None)],
    # 1.d4 -> d5, Nf6
    (((6, 3), (4, 3)),): [((1, 3), (3, 3), None), ((0, 6), (2, 5), None)],
    # 1.c4 -> e5, Nf6, c5
    (((6, 2), (4, 2)),): [((1, 4), (3, 4), None), ((0, 6), (2, 5), None), ((1, 2), (3, 2), None)],
    # 1.Nf3 -> d5, Nf6
    (((7, 6), (5, 5)),): [((1, 3), (3, 3), None), ((0, 6), (2, 5), None)],
    # 1.e4 e5 2.Nf3 -> Nc6
    (((6, 4), (4, 4)), ((1, 4), (3, 4)), ((7, 6), (5, 5))): [((0, 1), (2, 2), None)],
    # 1.e4 e5 2.Bc4 -> Nf6
    (((6, 4), (4, 4)), ((1, 4), (3, 4)), ((7, 5), (4, 2))): [((0, 6), (2, 5), None)],
    # 1.e4 c5 2.Nf3 -> d6, Nc6, e6
    (((6, 4), (4, 4)), ((1, 2), (3, 2)), ((7, 6), (5, 5))): [((1, 3), (2, 3), None), ((0, 1), (2, 2), None), ((1, 4), (2, 4), None)],
    # 1.e4 e6 2.d4 -> d5
    (((6, 4), (4, 4)), ((1, 4), (2, 4)), ((6, 3), (4, 3))): [((1, 3), (3, 3), None)],
    # 1.e4 c6 2.d4 -> d5
    (((6, 4), (4, 4)), ((1, 2), (2, 2)), ((6, 3), (4, 3))): [((1, 3), (3, 3), None)],
    # 1.d4 d5 2.c4 -> e6, c6
    (((6, 3), (4, 3)), ((1, 3), (3, 3)), ((6, 2), (4, 2))): [((1, 4), (2, 4), None), ((1, 2), (2, 2), None)],
    # 1.d4 Nf6 2.c4 -> e6, g6
    (((6, 3), (4, 3)), ((0, 6), (2, 5)), ((6, 2), (4, 2))): [((1, 4), (2, 4), None), ((1, 6), (2, 6), None)],
    # 1.e4 e5 2.Nf3 Nc6 3.Bb5 -> a6, Nf6
    (((6, 4), (4, 4)), ((1, 4), (3, 4)), ((7, 6), (5, 5)), ((0, 1), (2, 2)), ((7, 5), (3, 1))): [((1, 0), (2, 0), None), ((0, 6), (2, 5), None)],
    # 1.e4 e5 2.Nf3 Nc6 3.Bc4 -> Bc5, Nf6
    (((6, 4), (4, 4)), ((1, 4), (3, 4)), ((7, 6), (5, 5)), ((0, 1), (2, 2)), ((7, 5), (4, 2))): [((0, 5), (3, 2), None), ((0, 6), (2, 5), None)],
}

_MATE_SCORE = 100000
_INF_SCORE = 1000000
_TT_EXACT = 0
_TT_LOWER = 1
_TT_UPPER = 2


def _chess_piece_value(p):
    return {"p": 100, "n": 320, "b": 330, "r": 500, "q": 900, "k": 20000}[p.lower()] * (1 if p.isupper() else -1)


def _chess_eval_board(board, turn_is_white):
    """Tapered PeSTO evaluation from the perspective of the side to move."""
    mg_w = mg_b = eg_w = eg_b = 0
    phase = 0
    wb = bb = 0
    for r in range(8):
        row = board[r]
        mr = 7 - r
        for c in range(8):
            p = row[c]
            if p is None:
                continue
            if p.isupper():
                pt = p.lower()
                mg_w += _CHESS_MG_VALUE[pt] + _PST_MG[pt][r][c]
                eg_w += _CHESS_EG_VALUE[pt] + _PST_EG[pt][r][c]
                phase += _CHESS_PHASE_WEIGHT[pt]
                if pt == "b":
                    wb += 1
            else:
                mg_b += _CHESS_MG_VALUE[p] + _PST_MG[p][mr][c]
                eg_b += _CHESS_EG_VALUE[p] + _PST_EG[p][mr][c]
                phase += _CHESS_PHASE_WEIGHT[p]
                if p == "b":
                    bb += 1
    # Bishop pair bonus
    if wb >= 2:
        mg_w += 30
        eg_w += 45
    if bb >= 2:
        mg_b += 30
        eg_b += 45
    mg_phase = 24 if phase > 24 else phase
    eg_phase = 24 - mg_phase
    score = ((mg_w - mg_b) * mg_phase + (eg_w - eg_b) * eg_phase) // 24
    return score if turn_is_white else -score


def _chess_score(state):
    return _chess_eval_board(state["board"], True)


def _choose_near_best(scored_moves, tolerance, rng):
    best_score = max(score for _, score in scored_moves)
    candidates = [(move, score) for move, score in scored_moves if score >= best_score - tolerance]
    weights = [1 / (1 + (best_score - score) / max(tolerance, 1)) for _, score in candidates]
    return rng.choices([move for move, _ in candidates], weights=weights, k=1)[0]


class _ChessSearch:
    """Fast in-place alpha-beta Negamax with quiescence, TT, killers and iterative deepening."""

    def __init__(self, state, deadline):
        self.board = [row[:] for row in state["board"]]
        self.turn_white = state["turn"] == "white"
        rights = state.get("castling", {})
        self.castling = (
            (1 if rights.get("white_k") else 0)
            | (2 if rights.get("white_q") else 0)
            | (4 if rights.get("black_k") else 0)
            | (8 if rights.get("black_q") else 0)
        )
        ep = state.get("en_passant")
        self.ep = (ep[0], ep[1]) if ep else None
        self.wk = _king_square(self.board, "white")
        self.bk = _king_square(self.board, "black")
        self.deadline = deadline
        self.aborted = False
        self.nodes = 0
        self.tt = {}
        self.killers = [[None, None] for _ in range(32)]

    def _in_check(self, white):
        sq = self.wk if white else self.bk
        if sq is None:
            return True
        return _chess_attacked(self.board, sq[0], sq[1], "black" if white else "white")

    def _board_key(self):
        return (
            tuple(tuple(row) for row in self.board),
            self.turn_white,
            self.castling,
            self.ep,
        )

    def _gen_moves(self, captures_only=False):
        board = self.board
        white = self.turn_white
        ep = self.ep
        moves = []
        for r in range(8):
            row = board[r]
            for c in range(8):
                p = row[c]
                if p is None or (p.isupper() != white):
                    continue
                pt = p.lower()
                if pt == "p":
                    d = -1 if white else 1
                    start = 6 if white else 1
                    prom_row = 0 if white else 7
                    nr = r + d
                    if 0 <= nr < 8:
                        if not captures_only and board[nr][c] is None:
                            if nr == prom_row:
                                moves.append(((r, c), (nr, c), "q"))
                                moves.append(((r, c), (nr, c), "n"))
                            else:
                                moves.append(((r, c), (nr, c), None))
                                if r == start and board[r + 2 * d][c] is None:
                                    moves.append(((r, c), (r + 2 * d, c), None))
                        elif captures_only and nr == prom_row and board[nr][c] is None:
                            moves.append(((r, c), (nr, c), "q"))
                        for dc in (-1, 1):
                            nc = c + dc
                            if 0 <= nc < 8:
                                target = board[nr][nc]
                                if target is not None and (target.isupper() != white):
                                    if nr == prom_row:
                                        moves.append(((r, c), (nr, nc), "q"))
                                        if not captures_only:
                                            moves.append(((r, c), (nr, nc), "n"))
                                    else:
                                        moves.append(((r, c), (nr, nc), None))
                                elif ep is not None and nr == ep[0] and nc == ep[1]:
                                    moves.append(((r, c), (nr, nc), None))
                elif pt == "n":
                    for dr, dc in _KNIGHT_DELTAS:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < 8 and 0 <= nc < 8:
                            target = board[nr][nc]
                            if target is None:
                                if not captures_only:
                                    moves.append(((r, c), (nr, nc), None))
                            elif target.isupper() != white:
                                moves.append(((r, c), (nr, nc), None))
                elif pt == "k":
                    for dr, dc in _KING_DELTAS:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < 8 and 0 <= nc < 8:
                            target = board[nr][nc]
                            if target is None:
                                if not captures_only:
                                    moves.append(((r, c), (nr, nc), None))
                            elif target.isupper() != white:
                                moves.append(((r, c), (nr, nc), None))
                else:
                    dirs = _ORTHO_DIRS if pt == "r" else (_DIAG_DIRS if pt == "b" else _ORTHO_DIRS + _DIAG_DIRS)
                    for dr, dc in dirs:
                        nr, nc = r + dr, c + dc
                        while 0 <= nr < 8 and 0 <= nc < 8:
                            target = board[nr][nc]
                            if target is None:
                                if not captures_only:
                                    moves.append(((r, c), (nr, nc), None))
                            else:
                                if target.isupper() != white:
                                    moves.append(((r, c), (nr, nc), None))
                                break
                            nr += dr
                            nc += dc
        # Castling (only when generating full moves)
        if not captures_only:
            kr = 7 if white else 0
            king_char = "K" if white else "k"
            rook_char = "R" if white else "r"
            enemy = "black" if white else "white"
            if board[kr][4] == king_char and not _chess_attacked(board, kr, 4, enemy):
                ks_mask = 1 if white else 4
                qs_mask = 2 if white else 8
                if (self.castling & ks_mask) and board[kr][7] == rook_char:
                    if (
                        board[kr][5] is None
                        and board[kr][6] is None
                        and not _chess_attacked(board, kr, 5, enemy)
                        and not _chess_attacked(board, kr, 6, enemy)
                    ):
                        moves.append(((kr, 4), (kr, 6), None))
                if (self.castling & qs_mask) and board[kr][0] == rook_char:
                    if (
                        board[kr][1] is None
                        and board[kr][2] is None
                        and board[kr][3] is None
                        and not _chess_attacked(board, kr, 3, enemy)
                        and not _chess_attacked(board, kr, 2, enemy)
                    ):
                        moves.append(((kr, 4), (kr, 2), None))
        return moves

    def _make(self, move):
        (r, c), (tr, tc), prom = move
        board = self.board
        p = board[r][c]
        captured = board[tr][tc]
        prev_castling = self.castling
        prev_ep = self.ep
        prev_wk = self.wk
        prev_bk = self.bk
        ep_cap = None
        rook_undo = None

        pt = p.lower()
        if pt == "p" and prev_ep is not None and (tr, tc) == prev_ep and captured is None:
            ep_cap = (r, tc, board[r][tc])
            board[r][tc] = None

        board[r][c] = None
        if prom is not None:
            board[tr][tc] = prom.upper() if self.turn_white else prom
        else:
            board[tr][tc] = p

        if pt == "k":
            if self.turn_white:
                self.wk = (tr, tc)
                self.castling &= ~3
            else:
                self.bk = (tr, tc)
                self.castling &= ~12
            if abs(tc - c) == 2:
                if tc == 6:
                    rook_undo = ((tr, 7), (tr, 5), board[tr][7])
                    board[tr][5] = board[tr][7]
                    board[tr][7] = None
                else:
                    rook_undo = ((tr, 0), (tr, 3), board[tr][0])
                    board[tr][3] = board[tr][0]
                    board[tr][0] = None

        # Update castling rights for rooks moving or being captured
        if self.castling:
            if (r, c) == (7, 7) or (tr, tc) == (7, 7):
                self.castling &= ~1
            if (r, c) == (7, 0) or (tr, tc) == (7, 0):
                self.castling &= ~2
            if (r, c) == (0, 7) or (tr, tc) == (0, 7):
                self.castling &= ~4
            if (r, c) == (0, 0) or (tr, tc) == (0, 0):
                self.castling &= ~8

        self.ep = ((r + tr) // 2, c) if pt == "p" and abs(tr - r) == 2 else None
        self.turn_white = not self.turn_white
        return (move, p, captured, prev_castling, prev_ep, prev_wk, prev_bk, ep_cap, rook_undo)

    def _unmake(self, undo):
        move, p, captured, prev_castling, prev_ep, prev_wk, prev_bk, ep_cap, rook_undo = undo
        (r, c), (tr, tc), _ = move
        board = self.board
        self.turn_white = not self.turn_white
        board[r][c] = p
        board[tr][tc] = captured
        if ep_cap is not None:
            board[ep_cap[0]][ep_cap[1]] = ep_cap[2]
        if rook_undo is not None:
            (rf, rfc), (rt, rtc), rp = rook_undo
            board[rf][rfc] = rp
            board[rt][rtc] = None
        self.castling = prev_castling
        self.ep = prev_ep
        self.wk = prev_wk
        self.bk = prev_bk

    def _order_moves(self, moves, tt_move, ply):
        board = self.board
        k1, k2 = self.killers[ply] if ply < 32 else (None, None)

        def score_move(m):
            if m == tt_move:
                return 1000000
            (r, c), (tr, tc), prom = m
            target = board[tr][tc]
            s = 0
            if target is not None:
                attacker = board[r][c]
                s = 100000 + _CHESS_MVV_VAL[target.lower()] * 10 - _CHESS_MVV_VAL[attacker.lower()]
            elif prom is not None:
                s = 90000 + _CHESS_MVV_VAL[prom]
            elif m == k1:
                s = 80000
            elif m == k2:
                s = 70000
            return s

        moves.sort(key=score_move, reverse=True)
        return moves

    def _quiesce(self, alpha, beta, qdepth):
        self.nodes += 1
        if (self.nodes & 1023) == 0 and time.perf_counter() >= self.deadline:
            self.aborted = True
            return 0
        stand_pat = _chess_eval_board(self.board, self.turn_white)
        if stand_pat >= beta:
            return beta
        if stand_pat > alpha:
            alpha = stand_pat
        if qdepth <= 0:
            return alpha

        moves = self._gen_moves(captures_only=True)
        if not moves:
            return alpha
        self._order_moves(moves, None, 31)
        for m in moves:
            target = self.board[m[1][0]][m[1][1]]
            # Delta pruning: skip hopeless captures far below alpha
            if target is not None and m[2] is None:
                if stand_pat + _CHESS_MVV_VAL[target.lower()] + 200 < alpha:
                    continue
            undo = self._make(m)
            if self._in_check(not self.turn_white):
                self._unmake(undo)
                continue
            score = -self._quiesce(-beta, -alpha, qdepth - 1)
            self._unmake(undo)
            if self.aborted:
                return 0
            if score >= beta:
                return beta
            if score > alpha:
                alpha = score
        return alpha

    def _negamax(self, depth, alpha, beta, ply, use_quiesce):
        self.nodes += 1
        if (self.nodes & 1023) == 0 and time.perf_counter() >= self.deadline:
            self.aborted = True
            return 0

        alpha_orig = alpha
        key = self._board_key()
        tt_entry = self.tt.get(key)
        tt_move = None
        if tt_entry is not None:
            tt_depth, tt_flag, tt_score, tt_move = tt_entry
            if tt_depth >= depth:
                if tt_flag == _TT_EXACT:
                    return tt_score
                if tt_flag == _TT_LOWER and tt_score > alpha:
                    alpha = tt_score
                elif tt_flag == _TT_UPPER and tt_score < beta:
                    beta = tt_score
                if alpha >= beta:
                    return tt_score

        if depth <= 0:
            if use_quiesce:
                return self._quiesce(alpha, beta, 5)
            return _chess_eval_board(self.board, self.turn_white)

        moves = self._gen_moves(captures_only=False)
        self._order_moves(moves, tt_move, ply)

        best_score = -_INF_SCORE
        best_move = None
        legal_count = 0
        for m in moves:
            is_quiet = self.board[m[1][0]][m[1][1]] is None and m[2] is None
            undo = self._make(m)
            if self._in_check(not self.turn_white):
                self._unmake(undo)
                continue
            legal_count += 1
            score = -self._negamax(depth - 1, -beta, -alpha, ply + 1, use_quiesce)
            self._unmake(undo)
            if self.aborted:
                return 0
            if score > best_score:
                best_score = score
                best_move = m
            if score > alpha:
                alpha = score
            if alpha >= beta:
                if is_quiet and ply < 32 and self.killers[ply][0] != m:
                    self.killers[ply][1] = self.killers[ply][0]
                    self.killers[ply][0] = m
                break

        if legal_count == 0:
            if self._in_check(self.turn_white):
                return -(_MATE_SCORE - ply)
            return 0

        if len(self.tt) < 60000:
            flag = _TT_EXACT
            if best_score <= alpha_orig:
                flag = _TT_UPPER
            elif best_score >= beta:
                flag = _TT_LOWER
            self.tt[key] = (depth, flag, best_score, best_move)
        return best_score

    def search_root(self, legal_moves, max_depth, use_quiesce, tolerance=0):
        """Iterative deepening from depth 1..max_depth, returning scored root moves.

        Moves within ``tolerance`` of the best score receive exact scores; moves that
        fail low outside the window are bounded strictly below ``best_score - tolerance``.
        """
        ordered = list(legal_moves)
        self._order_moves(ordered, None, 0)
        best_scored = None

        for depth in range(1, max_depth + 1):
            current_scored = []
            best_score = -_INF_SCORE
            for m in ordered:
                undo = self._make(m)
                if self._in_check(not self.turn_white):
                    self._unmake(undo)
                    continue
                # Keep window wide enough so all moves within `tolerance` get exact scores
                cutoff = (best_score - tolerance - 1) if best_score > -_INF_SCORE else -_INF_SCORE
                score = -self._negamax(depth - 1, -_INF_SCORE, -cutoff, 1, use_quiesce)
                self._unmake(undo)
                if self.aborted:
                    break
                if score <= cutoff:
                    # Failed low: strictly worse than best_score - tolerance
                    current_scored.append((m, cutoff - 1))
                else:
                    current_scored.append((m, score))
                    if score > best_score:
                        best_score = score
            if self.aborted:
                break
            if current_scored:
                current_scored.sort(key=lambda item: item[1], reverse=True)
                best_scored = current_scored
                ordered = [m for m, _ in current_scored]
                # Stop early if a forced mate is already found
                if best_scored[0][1] >= _MATE_SCORE - 32:
                    break
        return best_scored


def _chess_book_move(state, legal_moves, rng):
    history = state.get("history") or []
    if len(history) > 6:
        return None
    try:
        key = tuple((tuple(m["from"]), tuple(m["to"])) for m in history)
    except (KeyError, TypeError):
        return None
    book_choices = _CHESS_OPENING_BOOK.get(key)
    if not book_choices:
        return None
    legal_set = set(legal_moves)
    valid = [m for m in book_choices if m in legal_set]
    return rng.choice(valid) if valid else None


def _chess_ai_move(state, difficulty):
    moves = _chess_legal_moves(state)
    if not moves:
        raise ValueError("no legal chess moves")
    if len(moves) == 1:
        return moves[0]

    rng = random.Random()

    if difficulty == "easy":
        # Fast 1-ply evaluation with wide randomness so beginners can win
        engine = _ChessSearch(state, time.perf_counter() + 0.08)
        scored = engine.search_root(moves, max_depth=1, use_quiesce=False, tolerance=220)
        if not scored:
            return rng.choice(moves)
        return _choose_near_best(scored, 220, rng)

    if difficulty == "medium":
        if rng.random() < 0.55:
            book = _chess_book_move(state, moves, rng)
            if book is not None:
                return book
        engine = _ChessSearch(state, time.perf_counter() + 0.18)
        scored = engine.search_root(moves, max_depth=3, use_quiesce=True, tolerance=60)
        if not scored:
            return rng.choice(moves)
        return _choose_near_best(scored, 60, rng)

    # Hard ("Thử thách"): Opening book + deep iterative-deepening Negamax + Quiescence + TT
    book = _chess_book_move(state, moves, rng)
    if book is not None:
        return book
    engine = _ChessSearch(state, time.perf_counter() + 0.75)
    scored = engine.search_root(moves, max_depth=6, use_quiesce=True, tolerance=0)
    if not scored:
        return moves[0]
    # Pick the strictly strongest move (tie-break randomly only among exact ties)
    best_score = scored[0][1]
    best_moves = [m for m, s in scored if s == best_score]
    return rng.choice(best_moves)


# ----------------------------- Xiangqi -----------------------------


def _xiangqi_initial():
    board=[[None]*9 for _ in range(10)]
    board[0]=["r","h","e","a","k","a","e","h","r"]
    board[2][1]="c"; board[2][7]="c"
    board[3][0]=board[3][2]=board[3][4]=board[3][6]=board[3][8]="p"
    board[6][0]=board[6][2]=board[6][4]=board[6][6]=board[6][8]="P"
    board[7][1]="C"; board[7][7]="C"
    board[9]=["R","H","E","A","K","A","E","H","R"]
    return board


def _x_base_state():
    return {"game_type":"xiangqi","board":_xiangqi_initial(),"turn":"red","to_move":"red",
            "human":"red","ai":"black","result":"ongoing","winner":None,"terminal":False,
            "difficulty":None,"last_move":None,"check":False,"history":[],"position_history":[]}


def _x_side(p):
    return "red" if p and p.isupper() else ("black" if p else None)


def _x_in_palace(r,c,side):
    return c in (3,4,5) and (r in (0,1,2) if side=="black" else r in (7,8,9))


def _x_general(board, side):
    target = "K" if side == "red" else "k"
    rows = (7, 8, 9) if side == "red" else (0, 1, 2)
    for r in rows:
        row = board[r]
        for c in (3, 4, 5):
            if row[c] == target:
                return r, c
    return None


# Reverse horse offsets: (horse_dr, horse_dc, block_dr, block_dc) from target square (r, c)
_X_HORSE_REV = (
    (2, 1, 1, 1), (2, -1, 1, -1),
    (-2, 1, -1, 1), (-2, -1, -1, -1),
    (1, 2, 1, 1), (-1, 2, -1, 1),
    (1, -2, 1, -1), (-1, -2, -1, -1),
)


def _x_attacked(board, r, c, by_side):
    """Fast outward attack detection from (r, c) in Xiangqi."""
    by_red = by_side == "red"
    rook = "R" if by_red else "r"
    cannon = "C" if by_red else "c"
    king = "K" if by_red else "k"
    horse = "H" if by_red else "h"
    pawn = "P" if by_red else "p"

    # 4 orthogonal rays: Chariot (0 screens), Flying General (0 screens on same file), Cannon (1 screen)
    for dr, dc in _ORTHO_DIRS:
        rr, cc = r + dr, c + dc
        screen = False
        while 0 <= rr < 10 and 0 <= cc < 9:
            p = board[rr][cc]
            if p is not None:
                if not screen:
                    if p == rook or (dc == 0 and p == king):
                        return True
                    screen = True
                else:
                    if p == cannon:
                        return True
                    break
            rr += dr
            cc += dc

    # Horse attacks (checking enemy horse's leg)
    for dr, dc, ldr, ldc in _X_HORSE_REV:
        hr, hc = r + dr, c + dc
        if 0 <= hr < 10 and 0 <= hc < 9 and board[hr][hc] == horse:
            if board[r + ldr][c + ldc] is None:
                return True

    # Pawn attacks
    pr = r + 1 if by_red else r - 1
    if 0 <= pr < 10 and board[pr][c] == pawn:
        return True
    # Sideways pawn attacks only if target is across the attacker's river
    if (by_red and r < 5) or ((not by_red) and r > 4):
        if c > 0 and board[r][c - 1] == pawn:
            return True
        if c < 8 and board[r][c + 1] == pawn:
            return True

    return False


def _x_check(board, side):
    gs = _x_general(board, side)
    if gs is None:
        return True
    enemy = "black" if side == "red" else "red"
    return _x_attacked(board, gs[0], gs[1], enemy)


def _x_pseudo(board,r,c):
    p=board[r][c]
    if p is None: return []
    side=_x_side(p); t=p.lower(); out=[]
    if t=="k":
        for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
            rr,cc=r+dr,c+dc
            if _inside(rr,cc,10,9) and _x_in_palace(rr,cc,side) and (board[rr][cc] is None or _x_side(board[rr][cc])!=side): out.append((rr,cc))
    elif t=="a":
        for dr,dc in ((1,1),(1,-1),(-1,1),(-1,-1)):
            rr,cc=r+dr,c+dc
            if _inside(rr,cc,10,9) and _x_in_palace(rr,cc,side) and (board[rr][cc] is None or _x_side(board[rr][cc])!=side): out.append((rr,cc))
    elif t=="e":
        for dr,dc in ((2,2),(2,-2),(-2,2),(-2,-2)):
            rr,cc=r+dr,c+dc
            if _inside(rr,cc,10,9) and (rr<5)==(r<5) and board[r+dr//2][c+dc//2] is None and (board[rr][cc] is None or _x_side(board[rr][cc])!=side): out.append((rr,cc))
    elif t=="h":
        for dr,dc,lr,lc in ((2,1,1,0),(2,-1,1,0),(1,2,0,1),(1,-2,0,-1),(-1,2,0,1),(-1,-2,0,-1),(-2,1,-1,0),(-2,-1,-1,0)):
            rr,cc=r+dr,c+dc
            if _inside(rr,cc,10,9) and board[r+lr][c+lc] is None and (board[rr][cc] is None or _x_side(board[rr][cc])!=side): out.append((rr,cc))
    elif t=="r" or t=="c":
        for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
            rr,cc=r+dr,c+dc
            screen=False
            while _inside(rr,cc,10,9):
                if t=="r":
                    if board[rr][cc] is None: out.append((rr,cc))
                    else:
                        if _x_side(board[rr][cc])!=side: out.append((rr,cc))
                        break
                else:
                    if board[rr][cc] is None:
                        if not screen: out.append((rr,cc))
                    elif not screen:
                        screen=True
                    else:
                        if _x_side(board[rr][cc])!=side: out.append((rr,cc))
                        break
                rr+=dr;cc+=dc
    elif t=="p":
        dr=-1 if side=="red" else 1
        rr=r+dr
        if _inside(rr,c,10,9) and (board[rr][c] is None or _x_side(board[rr][c])!=side): out.append((rr,c))
        crossed=(r<5) if side=="red" else (r>4)
        if crossed:
            for dc in (-1,1):
                rr,cc=r,c+dc
                if _inside(rr,cc,10,9) and (board[rr][cc] is None or _x_side(board[rr][cc])!=side): out.append((rr,cc))
    return out


def _x_legal(state, fr=None):
    board = state["board"]
    side = state["turn"]
    out = []
    for r in range(10):
        for c in range(9):
            if fr is not None and (r, c) != fr:
                continue
            p = board[r][c]
            if p is None or _x_side(p) != side:
                continue
            for br, bc in _x_pseudo(board, r, c):
                cap = board[br][bc]
                board[br][bc] = p
                board[r][c] = None
                if not _x_check(board, side):
                    out.append(((r, c), (br, bc)))
                board[r][c] = p
                board[br][bc] = cap
    return out


def _x_make(state,a,b):
    board=state["board"]; p=board[a[0]][a[1]]
    board[b[0]][b[1]]=p;board[a[0]][a[1]]=None
    lm={"from":[a[0],a[1]],"to":[b[0],b[1]]};state["last_move"]=lm
    state["history"].append(lm)
    state["turn"]="black" if state["turn"]=="red" else "red";state["to_move"]=state["turn"]
    side=state["turn"]
    state["check"] = _x_check(board, side)
    moves=_x_legal(state)
    key=repr(board)+"|"+side
    hist=state.setdefault("position_history",[]);hist.append(key)
    if not moves:
        if _x_check(board,side):
            winner="black" if side=="red" else "red"
            state.update(result=winner+"_win",winner=winner,terminal=True)
        else:
            state.update(result="draw",winner="draw",terminal=True)
    elif hist.count(key)>=6: # coarse repetition safeguard
        state.update(result="draw",winner="draw",terminal=True)


_X_VALUES = {"k": 20000, "r": 900, "c": 450, "h": 400, "e": 200, "a": 200, "p": 100}

# Positional bonuses from Red's perspective (row 0 = black back rank, row 9 = red back rank)
_X_PST = {
    "p": (
        (9, 9, 9, 11, 13, 11, 9, 9, 9),
        (19, 24, 34, 42, 44, 42, 34, 24, 19),
        (19, 24, 32, 37, 37, 37, 32, 24, 19),
        (19, 23, 27, 29, 30, 29, 27, 23, 19),
        (14, 18, 20, 27, 29, 27, 20, 18, 14),
        (7, 0, 13, 0, 16, 0, 13, 0, 7),
        (7, 0, 7, 0, 15, 0, 7, 0, 7),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
    ),
    "h": (
        (4, 8, 16, 12, 4, 12, 16, 8, 4),
        (4, 10, 28, 16, 8, 16, 28, 10, 4),
        (12, 14, 16, 20, 18, 20, 16, 14, 12),
        (8, 24, 18, 24, 20, 24, 18, 24, 8),
        (6, 16, 14, 18, 16, 18, 14, 16, 6),
        (4, 12, 16, 14, 12, 14, 16, 12, 4),
        (2, 6, 8, 6, 10, 6, 8, 6, 2),
        (4, 2, 8, 8, 4, 8, 8, 2, 4),
        (0, 2, 4, 4, -2, 4, 4, 2, 0),
        (0, -4, 0, 0, 0, 0, 0, -4, 0),
    ),
    "c": (
        (6, 4, 0, -10, -12, -10, 0, 4, 6),
        (2, 2, 0, -4, -14, -4, 0, 2, 2),
        (2, 2, 0, -10, -8, -10, 0, 2, 2),
        (0, 0, -2, 4, 10, 4, -2, 0, 0),
        (0, 0, 0, 2, 8, 2, 0, 0, 0),
        (-2, 0, 4, 2, 6, 2, 4, 0, -2),
        (0, 0, 0, 2, 4, 2, 0, 0, 0),
        (4, 0, 8, 6, 14, 6, 8, 0, 4),
        (0, 2, 4, 6, 6, 6, 4, 2, 0),
        (0, 0, 2, 6, 6, 6, 2, 0, 0),
    ),
    "r": (
        (14, 14, 12, 18, 16, 18, 12, 14, 14),
        (16, 20, 18, 24, 26, 24, 18, 20, 16),
        (12, 12, 12, 18, 18, 18, 12, 12, 12),
        (12, 18, 16, 22, 22, 22, 16, 18, 12),
        (12, 14, 12, 18, 18, 18, 12, 14, 12),
        (12, 16, 14, 20, 20, 20, 14, 16, 12),
        (6, 10, 8, 14, 14, 14, 8, 10, 6),
        (4, 8, 6, 14, 12, 14, 6, 8, 4),
        (8, 4, 8, 16, 8, 16, 8, 4, 8),
        (-2, 10, 6, 14, 12, 14, 6, 10, -2),
    ),
    "e": (
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 8, 0, 0, 0, 8, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (4, 0, 0, 0, 14, 0, 0, 0, 4),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 6, 0, 0, 0, 6, 0, 0),
    ),
    "a": (
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 6, 0, 6, 0, 0, 0),
        (0, 0, 0, 0, 12, 0, 0, 0, 0),
        (0, 0, 0, 6, 0, 6, 0, 0, 0),
    ),
    "k": (
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, 0, 0, 0, 0, 0, 0),
        (0, 0, 0, -4, -6, -4, 0, 0, 0),
        (0, 0, 0, -2, 0, -2, 0, 0, 0),
        (0, 0, 0, 4, 10, 4, 0, 0, 0),
    ),
}

# Classical Xiangqi opening responses for Black
_X_OPENING_BOOK = {
    # Red 1.Phao dau (7,1->7,4 or 7,7->7,4) -> Binh phong ma (0,7->2,6 / 0,1->2,2) or Thuan phao (2,7->2,4 / 2,1->2,4)
    (((7, 1), (7, 4)),): [((0, 7), (2, 6)), ((0, 1), (2, 2)), ((2, 7), (2, 4))],
    (((7, 7), (7, 4)),): [((0, 1), (2, 2)), ((0, 7), (2, 6)), ((2, 1), (2, 4))],
    # Red 1.Tien tot (6,2->5,2 or 6,6->5,6) -> Doi tot or Phao
    (((6, 2), (5, 2)),): [((3, 2), (4, 2)), ((0, 1), (2, 2)), ((2, 1), (2, 4))],
    (((6, 6), (5, 6)),): [((3, 6), (4, 6)), ((0, 7), (2, 6)), ((2, 7), (2, 4))],
    # Red 1.Phi tuong (9,2->7,4 or 9,6->7,4) -> Qua cung phao / Ma
    (((9, 2), (7, 4)),): [((2, 7), (2, 4)), ((0, 7), (2, 6)), ((3, 6), (4, 6))],
    (((9, 6), (7, 4)),): [((2, 1), (2, 4)), ((0, 1), (2, 2)), ((3, 2), (4, 2))],
    # Red 1.Khoi ma (9,1->7,2 or 9,7->7,6) -> Tien tot / Ma
    (((9, 1), (7, 2)),): [((3, 6), (4, 6)), ((0, 7), (2, 6))],
    (((9, 7), (7, 6)),): [((3, 2), (4, 2)), ((0, 1), (2, 2))],
}


def _x_eval_board(board, turn_red):
    """Positional + material Xiangqi evaluation from side-to-move's perspective."""
    score = 0
    for r in range(10):
        row = board[r]
        mr = 9 - r
        for c in range(9):
            p = row[c]
            if p is None:
                continue
            if p.isupper():
                pt = p.lower()
                score += _X_VALUES[pt] + _X_PST[pt][r][c] * 2
            else:
                score -= _X_VALUES[p] + _X_PST[p][mr][c] * 2
    return score if turn_red else -score


def _x_eval(state):
    return _x_eval_board(state["board"], True)


class _XiangqiSearch:
    """Fast in-place alpha-beta Negamax for Xiangqi with quiescence, TT and killers."""

    def __init__(self, state, deadline):
        self.board = [row[:] for row in state["board"]]
        self.turn_red = state["turn"] == "red"
        self.deadline = deadline
        self.aborted = False
        self.nodes = 0
        self.tt = {}
        self.killers = [[None, None] for _ in range(32)]

    def _board_key(self):
        return (tuple(tuple(row) for row in self.board), self.turn_red)

    def _gen_moves(self, captures_only=False):
        board = self.board
        red = self.turn_red
        moves = []
        for r in range(10):
            row = board[r]
            for c in range(9):
                p = row[c]
                if p is None or (p.isupper() != red):
                    continue
                for tr, tc in _x_pseudo(board, r, c):
                    if captures_only and board[tr][tc] is None:
                        continue
                    moves.append(((r, c), (tr, tc)))
        return moves

    def _order_moves(self, moves, tt_move, ply):
        board = self.board
        k1, k2 = self.killers[ply] if ply < 32 else (None, None)

        def score_move(m):
            if m == tt_move:
                return 1000000
            (r, c), (tr, tc) = m
            target = board[tr][tc]
            if target is not None:
                attacker = board[r][c]
                return 100000 + _X_VALUES[target.lower()] * 10 - _X_VALUES[attacker.lower()]
            if m == k1:
                return 80000
            if m == k2:
                return 70000
            return 0

        moves.sort(key=score_move, reverse=True)
        return moves

    def _quiesce(self, alpha, beta, qdepth):
        self.nodes += 1
        if (self.nodes & 511) == 0 and time.perf_counter() >= self.deadline:
            self.aborted = True
            return 0
        stand_pat = _x_eval_board(self.board, self.turn_red)
        if stand_pat >= beta:
            return beta
        if stand_pat > alpha:
            alpha = stand_pat
        if qdepth <= 0:
            return alpha

        board = self.board
        side = "red" if self.turn_red else "black"
        moves = self._gen_moves(captures_only=True)
        if not moves:
            return alpha
        self._order_moves(moves, None, 31)
        for m in moves:
            (r, c), (tr, tc) = m
            target = board[tr][tc]
            if target is not None and stand_pat + _X_VALUES[target.lower()] + 220 < alpha:
                continue
            p = board[r][c]
            board[tr][tc] = p
            board[r][c] = None
            if _x_check(board, side):
                board[r][c] = p
                board[tr][tc] = target
                continue
            self.turn_red = not self.turn_red
            score = -self._quiesce(-beta, -alpha, qdepth - 1)
            self.turn_red = not self.turn_red
            board[r][c] = p
            board[tr][tc] = target
            if self.aborted:
                return 0
            if score >= beta:
                return beta
            if score > alpha:
                alpha = score
        return alpha

    def _negamax(self, depth, alpha, beta, ply, use_quiesce):
        self.nodes += 1
        if (self.nodes & 511) == 0 and time.perf_counter() >= self.deadline:
            self.aborted = True
            return 0

        alpha_orig = alpha
        key = self._board_key()
        tt_entry = self.tt.get(key)
        tt_move = None
        if tt_entry is not None:
            tt_depth, tt_flag, tt_score, tt_move = tt_entry
            if tt_depth >= depth:
                if tt_flag == _TT_EXACT:
                    return tt_score
                if tt_flag == _TT_LOWER and tt_score > alpha:
                    alpha = tt_score
                elif tt_flag == _TT_UPPER and tt_score < beta:
                    beta = tt_score
                if alpha >= beta:
                    return tt_score

        if depth <= 0:
            if use_quiesce:
                return self._quiesce(alpha, beta, 4)
            return _x_eval_board(self.board, self.turn_red)

        board = self.board
        side = "red" if self.turn_red else "black"
        moves = self._gen_moves(captures_only=False)
        self._order_moves(moves, tt_move, ply)

        best_score = -_INF_SCORE
        best_move = None
        legal_count = 0
        for m in moves:
            (r, c), (tr, tc) = m
            p = board[r][c]
            cap = board[tr][tc]
            board[tr][tc] = p
            board[r][c] = None
            if _x_check(board, side):
                board[r][c] = p
                board[tr][tc] = cap
                continue
            legal_count += 1
            self.turn_red = not self.turn_red
            score = -self._negamax(depth - 1, -beta, -alpha, ply + 1, use_quiesce)
            self.turn_red = not self.turn_red
            board[r][c] = p
            board[tr][tc] = cap
            if self.aborted:
                return 0
            if score > best_score:
                best_score = score
                best_move = m
            if score > alpha:
                alpha = score
            if alpha >= beta:
                if cap is None and ply < 32 and self.killers[ply][0] != m:
                    self.killers[ply][1] = self.killers[ply][0]
                    self.killers[ply][0] = m
                break

        if legal_count == 0:
            # In Xiangqi, both checkmate and stalemate are a loss for the side with no legal moves
            return -(_MATE_SCORE - ply)

        if len(self.tt) < 50000:
            flag = _TT_EXACT
            if best_score <= alpha_orig:
                flag = _TT_UPPER
            elif best_score >= beta:
                flag = _TT_LOWER
            self.tt[key] = (depth, flag, best_score, best_move)
        return best_score

    def search_root(self, legal_moves, max_depth, use_quiesce, tolerance=0):
        board = self.board
        ordered = list(legal_moves)
        self._order_moves(ordered, None, 0)
        best_scored = None

        for depth in range(1, max_depth + 1):
            current_scored = []
            best_score = -_INF_SCORE
            for m in ordered:
                (r, c), (tr, tc) = m
                p = board[r][c]
                cap = board[tr][tc]
                board[tr][tc] = p
                board[r][c] = None
                self.turn_red = not self.turn_red
                cutoff = (best_score - tolerance - 1) if best_score > -_INF_SCORE else -_INF_SCORE
                score = -self._negamax(depth - 1, -_INF_SCORE, -cutoff, 1, use_quiesce)
                self.turn_red = not self.turn_red
                board[r][c] = p
                board[tr][tc] = cap
                if self.aborted:
                    break
                if score <= cutoff:
                    current_scored.append((m, cutoff - 1))
                else:
                    current_scored.append((m, score))
                    if score > best_score:
                        best_score = score
            if self.aborted:
                break
            if current_scored:
                current_scored.sort(key=lambda item: item[1], reverse=True)
                best_scored = current_scored
                ordered = [m for m, _ in current_scored]
                if best_scored[0][1] >= _MATE_SCORE - 32:
                    break
        return best_scored


def _x_book_move(state, legal_moves, rng):
    history = state.get("history") or []
    if len(history) > 2:
        return None
    try:
        key = tuple((tuple(m["from"]), tuple(m["to"])) for m in history)
    except (KeyError, TypeError):
        return None
    book_choices = _X_OPENING_BOOK.get(key)
    if not book_choices:
        return None
    legal_set = set(legal_moves)
    valid = [m for m in book_choices if m in legal_set]
    return rng.choice(valid) if valid else None


def _x_ai(state, difficulty):
    moves = _x_legal(state)
    if not moves:
        raise ValueError("no legal xiangqi moves")
    if len(moves) == 1:
        return moves[0]

    rng = random.Random()

    if difficulty == "easy":
        engine = _XiangqiSearch(state, time.perf_counter() + 0.08)
        scored = engine.search_root(moves, max_depth=1, use_quiesce=False, tolerance=220)
        if not scored:
            return rng.choice(moves)
        return _choose_near_best(scored, 220, rng)

    if difficulty == "medium":
        if rng.random() < 0.55:
            book = _x_book_move(state, moves, rng)
            if book is not None:
                return book
        engine = _XiangqiSearch(state, time.perf_counter() + 0.20)
        scored = engine.search_root(moves, max_depth=3, use_quiesce=True, tolerance=70)
        if not scored:
            return rng.choice(moves)
        return _choose_near_best(scored, 70, rng)

    # Hard ("Thử thách"): Opening book + deep Iterative Deepening + Quiescence + TT
    book = _x_book_move(state, moves, rng)
    if book is not None:
        return book
    engine = _XiangqiSearch(state, time.perf_counter() + 0.75)
    scored = engine.search_root(moves, max_depth=5, use_quiesce=True, tolerance=0)
    if not scored:
        return moves[0]
    best_score = scored[0][1]
    best_moves = [m for m, s in scored if s == best_score]
    return rng.choice(best_moves)


# ------------------------------- Go -------------------------------


def _go_initial():
    return [["."]*9 for _ in range(9)]


def _go_base_state():
    board=_go_initial()
    state={"game_type":"go","board":board,"turn":"black","to_move":"black",
           "human":"black","ai":"white","result":"ongoing","winner":None,"terminal":False,
           "difficulty":None,"last_move":None,"passes":0,"history":[],"position_history":[_go_key(board,"black")],
           "komi":7.5}
    return state


def _go_key(board,turn):
    return repr(board)+"|"+turn


def _go_neighbors(r,c):
    for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
        rr,cc=r+dr,c+dc
        if 0<=rr<9 and 0<=cc<9:
            yield rr,cc


def _go_group(board,r,c):
    color=board[r][c]
    if color==".": return set(),set()
    group=set(); liberties=set(); stack=[(r,c)]
    while stack:
        rr,cc=stack.pop()
        if (rr,cc) in group: continue
        group.add((rr,cc))
        for nr,nc in _go_neighbors(rr,cc):
            if board[nr][nc]==".": liberties.add((nr,nc))
            elif board[nr][nc]==color and (nr,nc) not in group:
                stack.append((nr,nc))
    return group,liberties


def _go_place(state,r,c,color):
    board=state["board"]
    if not (0<=r<9 and 0<=c<9): raise ValueError("Go coordinate out of bounds")
    if board[r][c]!=".": raise ValueError("illegal Go move: occupied point")
    board[r][c]=color
    enemy="W" if color=="B" else "B"
    captured=0
    for nr,nc in list(_go_neighbors(r,c)):
        if board[nr][nc]==enemy:
            group,libs=_go_group(board,nr,nc)
            if not libs:
                captured+=len(group)
                for gr,gc in group: board[gr][gc]="."
    own,_libs=_go_group(board,r,c)
    if not _libs:
        board[r][c]="."
        raise ValueError("illegal Go move: suicide")
    key=_go_key(board,"W" if color=="B" else "B")
    if key in state.setdefault("position_history",[]):
        board[r][c]="."
        # Restore captured stones because a ko/superko attempt is illegal.
        raise ValueError("illegal Go move: ko/superko")
    state["position_history"].append(key)
    state["passes"]=0
    lm={"at":[r,c]};state["last_move"]=lm;state["history"].append(lm)
    state["turn"]="white" if color=="B" else "black";state["to_move"]=state["turn"]


def _go_pass(state,side):
    state["passes"]+=1
    lm={"pass":True};state["last_move"]=lm;state["history"].append(lm)
    state["turn"]="white" if side=="black" else "black";state["to_move"]=state["turn"]
    state.setdefault("position_history",[]).append(_go_key(state["board"],state["turn"]))
    if state["passes"]>=2:
        _go_finish(state)


def _go_area_score(board):
    seen=set();black=0.0;white=0.0
    for r in range(9):
        for c in range(9):
            if (r,c) in seen: continue
            if board[r][c]!=".":
                if board[r][c]=="B":black+=1
                else:white+=1
                continue
            region=set();stack=[(r,c)];touch=set();seen.add((r,c))
            while stack:
                rr,cc=stack.pop();region.add((rr,cc))
                for nr,nc in _go_neighbors(rr,cc):
                    if board[nr][nc]==".":
                        if (nr,nc) not in seen:seen.add((nr,nc));stack.append((nr,nc))
                    else:touch.add(board[nr][nc])
            if touch=={"B"}:black+=len(region)
            elif touch=={"W"}:white+=len(region)
    white+=7.5
    return black,white


def _go_finish(state):
    black,white=_go_area_score(state["board"])
    if black>white:
        state.update(result="black_win",winner="black",terminal=True)
    elif white>black:
        state.update(result="white_win",winner="white",terminal=True)
    else:
        state.update(result="draw",winner="draw",terminal=True)
    state["score"]={"black":black,"white":white}


def _go_legal_moves(state):
    if state["terminal"]:return []
    moves=[{"at":[r,c]} for r in range(9) for c in range(9) if state["board"][r][c]=="."]
    moves.append({"pass":True})
    return moves


def _go_play_legal(state,move):
    if state["terminal"]:raise ValueError("game is already terminal")
    ch="B" if state["turn"]=="black" else "W"
    if move.get("pass") is True:
        _go_pass(state,state["turn"])
        return
    if "at" not in move:raise ValueError("invalid Go move")
    at=move["at"]
    if not isinstance(at,(list,tuple)) or len(at)!=2:
        raise ValueError("invalid Go coordinates")
    try:r,c=int(at[0]),int(at[1])
    except (TypeError,ValueError):raise ValueError("invalid Go coordinates")
    if isinstance(at[0],bool) or isinstance(at[1],bool):raise ValueError("invalid Go coordinates")
    _go_place(state,r,c,ch)


_GO_POS_WEIGHT = (
    (0.0, 0.2, 0.4, 0.5, 0.5, 0.5, 0.4, 0.2, 0.0),
    (0.2, 0.4, 0.8, 0.9, 0.9, 0.9, 0.8, 0.4, 0.2),
    (0.4, 0.8, 1.4, 1.2, 1.3, 1.2, 1.4, 0.8, 0.4),
    (0.5, 0.9, 1.2, 1.3, 1.4, 1.3, 1.2, 0.9, 0.5),
    (0.5, 0.9, 1.3, 1.4, 1.6, 1.4, 1.3, 0.9, 0.5),
    (0.5, 0.9, 1.2, 1.3, 1.4, 1.3, 1.2, 0.9, 0.5),
    (0.4, 0.8, 1.4, 1.2, 1.3, 1.2, 1.4, 0.8, 0.4),
    (0.2, 0.4, 0.8, 0.9, 0.9, 0.9, 0.8, 0.4, 0.2),
    (0.0, 0.2, 0.4, 0.5, 0.5, 0.5, 0.4, 0.2, 0.0),
)
_GO_STAR_POINTS = ((4, 4), (2, 2), (2, 6), (6, 2), (6, 6), (2, 4), (4, 2), (4, 6), (6, 4))


def _go_is_own_eye(board, r, c, color):
    """True if (r, c) is a simple true eye for `color` that should not be filled."""
    for nr, nc in _go_neighbors(r, c):
        if board[nr][nc] != color:
            return False
    enemy = "W" if color == "B" else "B"
    diag_enemy = 0
    diag_total = 0
    for dr, dc in _DIAG_DIRS:
        nr, nc = r + dr, c + dc
        if 0 <= nr < 9 and 0 <= nc < 9:
            diag_total += 1
            if board[nr][nc] == enemy:
                diag_enemy += 1
    if diag_total < 4:
        return diag_enemy == 0
    return diag_enemy <= 1


def _go_try_play(board, r, c, color, history_keys):
    """Return (new_board, captured_count, next_key) or None if illegal."""
    if board[r][c] != ".":
        return None
    nb = [row[:] for row in board]
    nb[r][c] = color
    enemy = "W" if color == "B" else "B"
    captured = 0
    for nr, nc in _go_neighbors(r, c):
        if nb[nr][nc] == enemy:
            group, libs = _go_group(nb, nr, nc)
            if not libs:
                captured += len(group)
                for gr, gc in group:
                    nb[gr][gc] = "."
    _, own_libs = _go_group(nb, r, c)
    if not own_libs:
        return None
    key = _go_key(nb, enemy)
    if key in history_keys:
        return None
    return nb, captured, key


def _go_eval_board(board, turn_color):
    """Rich 9x9 Go evaluation: area/territory, liberties, Atari threats, and positional influence."""
    black_area, white_area = _go_area_score(board)
    score = black_area - white_area  # includes 7.5 komi for white

    seen = set()
    stone_count = 0
    for r in range(9):
        row = board[r]
        for c in range(9):
            p = row[c]
            if p == ".":
                continue
            stone_count += 1
            if (r, c) not in seen:
                group, libs = _go_group(board, r, c)
                seen.update(group)
                n_libs = len(libs)
                g_size = len(group)
                sign = 1.0 if p == "B" else -1.0
                if n_libs == 1:
                    # Group in Atari! Severe danger if opponent is to move, moderate danger if own turn
                    penalty = (2.6 if p != turn_color else 1.2) * g_size
                    score -= sign * penalty
                elif n_libs == 2:
                    score -= sign * 0.35 * g_size
                else:
                    score += sign * min(n_libs, 6) * 0.18
            # Positional weight matters most in opening/early middlegame
            if stone_count < 45:
                sign = 1.0 if p == "B" else -1.0
                score += sign * _GO_POS_WEIGHT[r][c] * 0.35

    return score if turn_color == "B" else -score


def _go_liberty_score(state):
    return _go_eval_board(state["board"], "B")


def _go_candidate_moves(board, color, history_keys, max_candidates):
    """Generate and rank high-value tactical/positional moves for 9x9 Go."""
    enemy = "W" if color == "B" else "B"
    # Collect stones and urgent Atari liberties
    has_stones = False
    near_mask = [[False] * 9 for _ in range(9)]
    urgent_points = set()
    seen = set()
    for r in range(9):
        for c in range(9):
            p = board[r][c]
            if p == ".":
                continue
            has_stones = True
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    if abs(dr) + abs(dc) <= 2:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < 9 and 0 <= nc < 9:
                            near_mask[nr][nc] = True
            if (r, c) not in seen:
                group, libs = _go_group(board, r, c)
                seen.update(group)
                if len(libs) == 1:
                    urgent_points.update(libs)
                elif len(libs) == 2 and len(group) >= 2:
                    urgent_points.update(libs)

    candidates = []
    for r in range(9):
        for c in range(9):
            if board[r][c] != ".":
                continue
            if _go_is_own_eye(board, r, c, color):
                continue
            if has_stones and not near_mask[r][c] and (r, c) not in _GO_STAR_POINTS and (r, c) not in urgent_points:
                continue
            played = _go_try_play(board, r, c, color, history_keys)
            if played is None:
                continue
            nb, captured, key = played
            _, new_libs = _go_group(nb, r, c)
            # Heuristic move priority
            prio = _GO_POS_WEIGHT[r][c] * 2.0
            if captured > 0:
                prio += 20.0 + captured * 6.0
            if (r, c) in urgent_points:
                prio += 12.0
            if len(new_libs) == 1 and captured == 0:
                # Self-atari penalty
                prio -= 14.0
            elif len(new_libs) >= 3:
                prio += 1.5
            # Check if move puts an adjacent enemy group in Atari
            for nr, nc in _go_neighbors(r, c):
                if nb[nr][nc] == enemy:
                    eg, elibs = _go_group(nb, nr, nc)
                    if len(elibs) == 1:
                        prio += 8.0 + len(eg) * 2.0
            candidates.append((prio, r, c, nb, key))

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[:max_candidates]


def _go_negamax(board, color, history_keys, depth, alpha, beta, deadline, state_box):
    state_box[0] += 1
    if (state_box[0] & 63) == 0 and time.perf_counter() >= deadline:
        state_box[1] = True
        return 0.0
    if depth <= 0:
        return _go_eval_board(board, color)

    enemy = "W" if color == "B" else "B"
    width = 12 if depth >= 2 else 10
    candidates = _go_candidate_moves(board, color, history_keys, width)
    if not candidates:
        return _go_eval_board(board, color)

    best = -1e9
    for _, r, c, nb, key in candidates:
        history_keys.add(key)
        val = -_go_negamax(nb, enemy, history_keys, depth - 1, -beta, -alpha, deadline, state_box)
        history_keys.remove(key)
        if state_box[1]:
            return 0.0
        if val > best:
            best = val
        if val > alpha:
            alpha = val
        if alpha >= beta:
            break
    return best


def _go_ai(state, difficulty):
    if state["terminal"]:
        raise ValueError("game is already terminal")
    side = state["turn"]
    color = "B" if side == "black" else "W"
    enemy = "W" if color == "B" else "B"
    board = state["board"]
    history_keys = set(state.get("position_history") or [])
    rng = random.Random()

    if difficulty == "easy":
        # Fast legal play avoiding own-eye fills, occasional captures
        cands = _go_candidate_moves(board, color, history_keys, 81)
        if not cands:
            return {"pass": True}
        captures = [item for item in cands if item[0] >= 18.0]
        if captures and rng.random() < 0.45:
            pick = rng.choice(captures)
        else:
            pick = rng.choice(cands[: min(len(cands), 24)])
        return {"at": [pick[1], pick[2]]}

    max_depth = 2 if difficulty == "medium" else 4
    budget = 0.18 if difficulty == "medium" else 0.65
    max_root = 16 if difficulty == "medium" else 18
    tolerance = 2.2 if difficulty == "medium" else 0.0

    candidates = _go_candidate_moves(board, color, history_keys, max_root)
    if not candidates:
        return {"pass": True}

    # If opponent just passed and we are already clearly winning on area score, consider passing
    pass_score = _go_eval_board(board, color)
    opponent_passed = state.get("passes", 0) >= 1

    deadline = time.perf_counter() + budget
    state_box = [0, False]
    best_scored = None
    ordered = candidates

    for depth in range(1, max_depth + 1):
        current_scored = []
        best_val = -1e9
        for item in ordered:
            _, r, c, nb, key = item
            history_keys.add(key)
            cutoff = (best_val - tolerance - 0.01) if best_val > -1e8 else -1e9
            val = -_go_negamax(nb, enemy, history_keys, depth - 1, -1e9, -cutoff, deadline, state_box)
            history_keys.remove(key)
            if state_box[1]:
                break
            if val <= cutoff:
                current_scored.append((item, cutoff - 0.1))
            else:
                current_scored.append((item, val))
                if val > best_val:
                    best_val = val
        if state_box[1]:
            break
        if current_scored:
            current_scored.sort(key=lambda pair: pair[1], reverse=True)
            best_scored = current_scored
            ordered = [pair[0] for pair in current_scored]

    if not best_scored:
        top = candidates[0]
        return {"at": [top[1], top[2]]}

    best_move_score = best_scored[0][1]
    # Pass if opponent passed and we're already ahead and no move improves our position
    if opponent_passed and pass_score > 1.5 and best_move_score <= pass_score + 0.25:
        return {"pass": True}

    scored_payloads = [({"at": [item[1], item[2]]}, score) for item, score in best_scored]
    if tolerance == 0.0:
        best_moves = [m for m, s in scored_payloads if s == best_move_score]
        return rng.choice(best_moves)
    return _choose_near_best(scored_payloads, tolerance, rng)


# ------------------------------ Caro (15x15) ------------------------------

_CARO_SIZE = 15
_CARO_AXES = ((0, 1), (1, 0), (1, 1), (1, -1))


def _caro_base_state():
    return {
        "game_type": "caro",
        "board": [["."] * _CARO_SIZE for _ in range(_CARO_SIZE)],
        "turn": "x",
        "to_move": "x",
        "human": "x",
        "ai": "o",
        "result": "ongoing",
        "winner": None,
        "terminal": False,
        "difficulty": None,
        "last_move": None,
        "winning_line": None,
        "history": [],
        "position_history": [],
    }


def _caro_winning_line(board, r, c, piece):
    for dr, dc in _CARO_AXES:
        line = [(r, c)]
        nr, nc = r + dr, c + dc
        while 0 <= nr < _CARO_SIZE and 0 <= nc < _CARO_SIZE and board[nr][nc] == piece:
            line.append((nr, nc))
            nr += dr
            nc += dc
        nr, nc = r - dr, c - dc
        while 0 <= nr < _CARO_SIZE and 0 <= nc < _CARO_SIZE and board[nr][nc] == piece:
            line.append((nr, nc))
            nr -= dr
            nc -= dc
        if len(line) >= 5:
            line.sort()
            return [[lr, lc] for lr, lc in line]
    return None


def _caro_play_legal(state, move):
    if not isinstance(move, dict) or "at" not in move:
        raise ValueError("caro move must provide 'at' coordinates")
    (r, c) = _coords(move, ("at",))[0]
    if not _inside(r, c, _CARO_SIZE, _CARO_SIZE):
        raise ValueError("caro move out of bounds")
    board = state["board"]
    if board[r][c] != ".":
        raise ValueError("caro square is already occupied")

    side = state["turn"]
    piece = "X" if side == "x" else "O"
    board[r][c] = piece
    state["last_move"] = {"at": [r, c]}
    state["history"].append({"side": side, "at": [r, c]})

    win_line = _caro_winning_line(board, r, c, piece)
    if win_line is not None:
        state["winning_line"] = win_line
        _terminal(state, winner=side, result=f"{side}_win")
        return

    if all(cell != "." for row in board for cell in row):
        state["winning_line"] = None
        _terminal(state, winner=None, result="draw")
        return

    next_side = "o" if side == "x" else "x"
    state["turn"] = next_side
    state["to_move"] = next_side
    state["winning_line"] = None


def _caro_candidates(board):
    occupied = [(r, c) for r in range(_CARO_SIZE) for c in range(_CARO_SIZE) if board[r][c] != "."]
    if not occupied:
        return [(_CARO_SIZE // 2, _CARO_SIZE // 2)]
    cand = set()
    for r, c in occupied:
        r0 = max(0, r - 2)
        r1 = min(_CARO_SIZE - 1, r + 2)
        c0 = max(0, c - 2)
        c1 = min(_CARO_SIZE - 1, c + 2)
        for nr in range(r0, r1 + 1):
            for nc in range(c0, c1 + 1):
                if board[nr][nc] == ".":
                    cand.add((nr, nc))
    return list(cand)


def _caro_score_point(board, r, c, piece):
    """Evaluate tactical strength of placing `piece` at empty square (r, c)."""
    total = 14 - (abs(r - 7) + abs(c - 7))
    open_threes = 0
    closed_fours = 0

    for dr, dc in _CARO_AXES:
        # Count contiguous stones in positive and negative directions.
        pos = 0
        nr, nc = r + dr, c + dc
        while 0 <= nr < _CARO_SIZE and 0 <= nc < _CARO_SIZE and board[nr][nc] == piece:
            pos += 1
            nr += dr
            nc += dc
        pos_open = 0 <= nr < _CARO_SIZE and 0 <= nc < _CARO_SIZE and board[nr][nc] == "."
        # Check one-gap extension beyond open space (e.g. X_XX).
        pos_gap = 0
        if pos_open:
            gr, gc = nr + dr, nc + dc
            while 0 <= gr < _CARO_SIZE and 0 <= gc < _CARO_SIZE and board[gr][gc] == piece:
                pos_gap += 1
                gr += dr
                gc += dc
            pos_gap_open = 0 <= gr < _CARO_SIZE and 0 <= gc < _CARO_SIZE and board[gr][gc] == "."
        else:
            pos_gap_open = False

        neg = 0
        nr, nc = r - dr, c - dc
        while 0 <= nr < _CARO_SIZE and 0 <= nc < _CARO_SIZE and board[nr][nc] == piece:
            neg += 1
            nr -= dr
            nc -= dc
        neg_open = 0 <= nr < _CARO_SIZE and 0 <= nc < _CARO_SIZE and board[nr][nc] == "."
        neg_gap = 0
        if neg_open:
            gr, gc = nr - dr, nc - dc
            while 0 <= gr < _CARO_SIZE and 0 <= gc < _CARO_SIZE and board[gr][gc] == piece:
                neg_gap += 1
                gr -= dr
                gc -= dc
            neg_gap_open = 0 <= gr < _CARO_SIZE and 0 <= gc < _CARO_SIZE and board[gr][gc] == "."
        else:
            neg_gap_open = False

        run = 1 + pos + neg
        open_ends = int(pos_open) + int(neg_open)

        if run >= 5:
            return 1_000_000

        if run == 4:
            if open_ends == 2:
                total += 140_000
            elif open_ends == 1:
                total += 18_000
                closed_fours += 1
        elif run == 3:
            if open_ends == 2:
                total += 14_000
                open_threes += 1
            elif open_ends == 1:
                total += 1_400
        elif run == 2:
            if open_ends == 2:
                total += 450
            elif open_ends == 1:
                total += 70
        elif run == 1 and open_ends == 2:
            total += 18

        # Split-pattern bonus (broken four / broken three).
        if pos_gap > 0 and run + pos_gap >= 4:
            total += 12_000
            closed_fours += 1
        elif pos_gap > 0 and run + pos_gap == 3 and neg_open and pos_gap_open:
            total += 6_500
            open_threes += 1

        if neg_gap > 0 and run + neg_gap >= 4:
            total += 12_000
            closed_fours += 1
        elif neg_gap > 0 and run + neg_gap == 3 and pos_open and neg_gap_open:
            total += 6_500
            open_threes += 1

    # Fork bonuses (double-three, four-three, double-four).
    if closed_fours >= 2:
        total += 110_000
    elif closed_fours >= 1 and open_threes >= 1:
        total += 95_000
    elif open_threes >= 2:
        total += 65_000

    return total


def _caro_rank_candidates(board, my_piece, opp_piece):
    cands = _caro_candidates(board)
    scored = []
    for r, c in cands:
        atk = _caro_score_point(board, r, c, my_piece)
        dfd = _caro_score_point(board, r, c, opp_piece)
        if atk >= 1_000_000:
            return [(r, c, 10_000_000, atk, dfd)]
        score = int(atk * 1.12) + dfd
        scored.append((r, c, score, atk, dfd))
    scored.sort(key=lambda item: item[2], reverse=True)
    return scored


def _caro_ai(state, difficulty):
    board = state["board"]
    ai_piece = "O" if state["ai"] == "o" else "X"
    human_piece = "X" if ai_piece == "O" else "O"
    rng = random.Random()

    ranked = _caro_rank_candidates(board, ai_piece, human_piece)
    if not ranked:
        raise ValueError("no legal caro moves")

    # Immediate win for AI.
    if ranked[0][3] >= 1_000_000:
        return {"at": [ranked[0][0], ranked[0][1]]}

    # Immediate block if human has a 5-in-a-row threat.
    urgent_blocks = [item for item in ranked if item[4] >= 1_000_000]
    if urgent_blocks:
        return {"at": [urgent_blocks[0][0], urgent_blocks[0][1]]}

    if difficulty == "easy":
        pool = ranked[: min(4, len(ranked))]
        weights = [max(1, item[2]) for item in pool]
        chosen = rng.choices(pool, weights=weights, k=1)[0]
        return {"at": [chosen[0], chosen[1]]}

    if difficulty == "medium":
        top_score = ranked[0][2]
        near = [item for item in ranked[:3] if item[2] >= top_score * 0.94]
        chosen = rng.choice(near)
        return {"at": [chosen[0], chosen[1]]}

    # Hard: 2-ply tactical lookahead across top candidate moves.
    shortlist = ranked[: min(10, len(ranked))]
    best_move = (shortlist[0][0], shortlist[0][1])
    best_val = -10_000_000

    for r, c, base_score, atk, _ in shortlist:
        if atk >= 140_000:
            return {"at": [r, c]}
        board[r][c] = ai_piece
        opp_ranked = _caro_rank_candidates(board, human_piece, ai_piece)
        if not opp_ranked:
            val = base_score
        else:
            # Human's strongest reply after AI plays (r, c).
            orow, ocol, _, opp_atk, opp_dfd = opp_ranked[0]
            if opp_atk >= 1_000_000:
                val = -900_000
            else:
                board[orow][ocol] = human_piece
                ai_follow = _caro_rank_candidates(board, ai_piece, human_piece)
                follow_atk = ai_follow[0][3] if ai_follow else 0
                follow_dfd = ai_follow[0][4] if ai_follow else 0
                board[orow][ocol] = "."
                val = base_score + int(follow_atk * 0.45) - int(opp_atk * 0.72) - int(follow_dfd * 0.25) + int(opp_dfd * 0.1)
        board[r][c] = "."
        if val > best_val:
            best_val = val
            best_move = (r, c)

    return {"at": [best_move[0], best_move[1]]}


# --------------------------- Public API ---------------------------


def _dot_to_none(state):
    if state["game_type"] in ("chess","xiangqi"):
        state["board"]=[[None if x=="." else x for x in row] for row in state["board"]]
    return state


def _none_to_dot(state):
    if state["game_type"] in ("chess","xiangqi"):
        state["board"]=[["." if x is None else x for x in row] for row in state["board"]]
    return state


def _validate_game_type(game_type):
    if game_type not in ("chess","xiangqi","go","caro"):
        raise ValueError("unknown game_type")


def _validate_state(game_type,state):
    if not isinstance(state, dict):
        raise ValueError("state must be an object")
    if state.get("game_type") != game_type:
        raise ValueError("state game_type mismatch")
    if state.get("terminal") is not False or state.get("result") != "ongoing":
        raise ValueError("game is already terminal")

    dimensions = {"chess": (8, 8), "xiangqi": (10, 9), "go": (9, 9), "caro": (15, 15)}
    pieces = {
        "chess": set(".prnbqkPRNBQK"),
        "xiangqi": set(".rheakcpRHEAKCP"),
        "go": {".", "B", "W"},
        "caro": {".", "X", "O"},
    }
    rows, columns = dimensions[game_type]
    board = state.get("board")
    if (
        not isinstance(board, list)
        or len(board) != rows
        or any(
            not isinstance(row, list)
            or len(row) != columns
            or any(not isinstance(piece, str) or piece not in pieces[game_type] for piece in row)
            for row in board
        )
    ):
        raise ValueError("invalid board")

    human, ai, turns = {
        "chess": ("white", "black", {"white", "black"}),
        "xiangqi": ("red", "black", {"red", "black"}),
        "go": ("black", "white", {"black", "white"}),
        "caro": ("x", "o", {"x", "o"}),
    }[game_type]
    if (
        state.get("human") != human
        or state.get("ai") != ai
        or state.get("turn") not in turns
        or state.get("winner") is not None
        or not isinstance(state.get("history"), list)
        or not isinstance(state.get("position_history"), list)
    ):
        raise ValueError("invalid game state")

    if game_type == "chess":
        castling = state.get("castling")
        if not isinstance(castling, dict) or any(
            not isinstance(castling.get(right), bool)
            for right in ("white_k", "white_q", "black_k", "black_q")
        ):
            raise ValueError("invalid castling state")
        en_passant = state.get("en_passant")
        if en_passant is not None and (
            not isinstance(en_passant, list)
            or len(en_passant) != 2
            or any(not isinstance(coord, int) or isinstance(coord, bool) or not 0 <= coord < 8 for coord in en_passant)
        ):
            raise ValueError("invalid en passant state")
    elif game_type == "go":
        passes = state.get("passes")
        if not isinstance(passes, int) or isinstance(passes, bool) or passes < 0:
            raise ValueError("invalid pass count")


def is_current_player_in_check(game_type, state):
    """Return whether the side to move is in check in a validated active game."""
    _validate_game_type(game_type)
    _validate_state(game_type, state)
    board = _dot_to_none(_clone(state))["board"]
    if game_type == "chess":
        return _chess_in_check(board, state["turn"])
    if game_type == "xiangqi":
        return _x_check(board, state["turn"])
    return False


def create_game(game_type):
    """Create a new game. ``difficulty`` is set only when AI applies a move.

    Chess board rows: 0 is black, 7 is white. Xiangqi rows: 0 is black, 9 is red.
    Go board: row 0 is top, strings are ``B``, ``W``, ``.``.
    """
    _validate_game_type(game_type)
    if game_type=="chess":state=_chess_base_state()
    elif game_type=="xiangqi":state=_x_base_state()
    elif game_type=="caro":state=_caro_base_state()
    else:state=_go_base_state()
    return _none_to_dot(state)


def apply_player_move(game_type,state,move):
    """Apply exactly one human move and return JSON state. The human is first.

    State/terminal values are server-derived; client winner/result fields are ignored.
    Moves must be canonical as described in the module docstring.
    """
    _validate_game_type(game_type);_validate_state(game_type,state)
    out=_clone(state);out=_dot_to_none(out)
    if out.get("turn")!=out.get("human"):
        raise ValueError("not the human player's turn")
    if game_type=="chess":
        if not isinstance(move,dict):raise ValueError("move must be an object")
        _chess_make_move(out,move,True)
    elif game_type=="xiangqi":
        if not isinstance(move,dict):raise ValueError("move must be an object")
        if "from" not in move or "to" not in move:raise ValueError("invalid xiangqi move")
        a,b=_coords(move)
        legal=_x_legal(out)
        if (a,b) not in legal:raise ValueError("illegal xiangqi move")
        _x_make(out,a,b)
    elif game_type=="caro":
        _caro_play_legal(out,move)
    else:
        _go_play_legal(out,move)
    return _none_to_dot(out)


def forfeit_game(game_type, state):
    """Resolve an active game as a human loss without affecting the board rules."""
    _validate_game_type(game_type)
    _validate_state(game_type, state)
    if state.get("terminal"):
        return _none_to_dot(_clone(state))

    out = _dot_to_none(_clone(state))
    if game_type == "chess":
        out.update(result="black_win", winner="black", terminal=True)
    elif game_type == "xiangqi":
        out.update(result="black_win", winner="black", terminal=True)
    elif game_type == "caro":
        out.update(result="o_win", winner="o", terminal=True)
    else:
        out.update(result="white_win", winner="white", terminal=True)
    out["forfeit"] = True
    out.setdefault("last_move", None)
    return _none_to_dot(out)


def apply_ai_move(game_type,state,difficulty):
    """Apply one AI move at easy/medium/hard and return JSON state.

    Difficulty is recorded on the returned state. AI is never offered moves after
    terminal state or outside the AI's turn.
    """
    if difficulty not in ("easy","medium","hard"):
        raise ValueError("difficulty must be easy, medium, or hard")
    _validate_game_type(game_type);_validate_state(game_type,state)
    out=_clone(state);out=_dot_to_none(out)
    if out.get("turn")!=out.get("ai"):
        raise ValueError("not the AI player's turn")
    out["difficulty"]=difficulty
    if game_type=="chess":
        m=_chess_ai_move(out,difficulty)
        _chess_make_move(out,{"from":[m[0][0],m[0][1]],"to":[m[1][0],m[1][1]],"promotion":m[2] or "q"})
    elif game_type=="xiangqi":
        m=_x_ai(out,difficulty)
        _x_make(out,m[0],m[1])
    elif game_type=="caro":
        m=_caro_ai(out,difficulty)
        _caro_play_legal(out,m)
    else:
        m = _go_ai(out, difficulty)
        try:
            _go_play_legal(out, m)
        except ValueError:
            # Safe fallback: if a rare Ko/superko or legality mismatch occurs, pass cleanly instead of getting stuck
            out = _clone(state)
            out["difficulty"] = difficulty
            _go_play_legal(out, {"pass": True})
    return _none_to_dot(out)
