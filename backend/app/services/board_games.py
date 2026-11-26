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


def _chess_attacked(board, r, c, by_side):
    for ar in range(8):
        for ac in range(8):
            p = board[ar][ac]
            if p is None or _piece_side(p) != by_side:
                continue
            pt = p.lower()
            dr, dc = r - ar, c - ac
            if pt == "p":
                direction = -1 if by_side == "white" else 1
                if dr == direction and abs(dc) == 1:
                    return True
            elif pt == "n" and (abs(dr), abs(dc)) in ((1, 2), (2, 1)):
                return True
            elif pt == "k" and max(abs(dr), abs(dc)) == 1:
                return True
            elif pt in "rbq":
                orthogonal = (dr == 0 and dc != 0) or (dc == 0 and dr != 0)
                diagonal = abs(dr) == abs(dc) and dr != 0
                step_ok = (pt in "rq" and orthogonal) or (pt in "bq" and diagonal)
                if step_ok:
                    sr = 0 if dr == 0 else (1 if dr > 0 else -1)
                    sc = 0 if dc == 0 else (1 if dc > 0 else -1)
                    rr, cc = ar + sr, ac + sc
                    clear = True
                    while (rr, cc) != (r, c):
                        if board[rr][cc] is not None:
                            clear = False
                            break
                        rr += sr; cc += sc
                    if clear:
                        return True
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
    # promotions and legality
    legal=[]
    for a,b,_ in moves:
        r,c=a; tr,tc=b
        p=board[r][c]
        test=_clone(state); tb=test["board"]
        captured=tb[tr][tc]
        tb[tr][tc]=tb[r][c]; tb[r][c]=None
        if p.lower()=="p" and (tr,tc)==tuple(ep or ()) and captured is None:
            tb[r][tc]=None
        if p.lower()=="p" and tr in (0,7):
            for prom in "qrbn":
                tt=_clone(test); tt["board"][tr][tc]=prom.upper() if side=="white" else prom
                if not _chess_in_check(tt["board"],side): legal.append((a,b,prom))
        elif not _chess_in_check(tb,side):
            legal.append((a,b,None))
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
    legal=_chess_legal_moves(state)
    if check_legality:
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


def _chess_piece_value(p):
    return {"p":100,"n":320,"b":330,"r":500,"q":900,"k":20000}[p.lower()] * (1 if p.isupper() else -1)


def _chess_score(state):
    score=sum(_chess_piece_value(p) for row in state["board"] for p in row if p)
    if state["turn"]=="white": score += 10 if _chess_in_check(state["board"],"black") else 0
    else: score -= 10 if _chess_in_check(state["board"],"white") else 0
    return score


def _choose_near_best(scored_moves, tolerance, rng):
    best_score=max(score for _,score in scored_moves)
    candidates=[(move,score) for move,score in scored_moves if score>=best_score-tolerance]
    weights=[1/(1+(best_score-score)/max(tolerance,1)) for _,score in candidates]
    return rng.choices([move for move,_ in candidates],weights=weights,k=1)[0]


def _chess_ai_move(state,difficulty):
    moves=_chess_legal_moves(state)
    if not moves: raise ValueError("no legal chess moves")
    rng=random.Random()
    if difficulty=="easy":
        captures=[]
        for m in moves:
            target=state["board"][m[1][0]][m[1][1]]
            if target is not None: captures.append(m)
        candidates=captures if captures and rng.random()<0.5 else moves
        return rng.choice(candidates)
    depth={"medium":2,"hard":3}[difficulty]
    scored_moves=[]
    root_side=state["turn"]
    for m in moves:
        child=_clone(state); _chess_make_move(child,{"from":[m[0][0],m[0][1]],"to":[m[1][0],m[1][1]],"promotion":m[2] or "q"})
        score=_chess_minimax(child,depth-1,-10**9,10**9,root_side)
        scored_moves.append((m,score))
    tolerance={"medium":120,"hard":15}[difficulty]
    return _choose_near_best(scored_moves,tolerance,rng)


def _chess_minimax(state,depth,alpha,beta,root_side):
    if state["terminal"]:
        if state["winner"]==root_side: return 1000000
        if state["winner"]=="draw": return 0
        return -1000000
    if depth<=0:
        return _chess_score(state)*(1 if root_side=="white" else -1)
    moves=_chess_legal_moves(state)
    if not moves: return 0
    maximizing=state["turn"]==root_side
    if maximizing:
        val=-10**9
        for m in moves:
            child=_clone(state); _chess_make_move(child,{"from":[m[0][0],m[0][1]],"to":[m[1][0],m[1][1]],"promotion":m[2] or "q"})
            val=max(val,_chess_minimax(child,depth-1,alpha,beta,root_side)); alpha=max(alpha,val)
            if beta<=alpha: break
        return val
    val=10**9
    for m in moves:
        child=_clone(state); _chess_make_move(child,{"from":[m[0][0],m[0][1]],"to":[m[1][0],m[1][1]],"promotion":m[2] or "q"})
        val=min(val,_chess_minimax(child,depth-1,alpha,beta,root_side)); beta=min(beta,val)
        if beta<=alpha: break
    return val


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


def _x_general(board,side):
    for r in range(10):
        for c in range(9):
            if board[r][c]==("K" if side=="red" else "k"):
                return r,c
    return None


def _x_attacked(board,r,c,by_side):
    for ar in range(10):
        for ac in range(9):
            p=board[ar][ac]
            if p is None or _x_side(p)!=by_side:
                continue
            t=p.lower()
            dr=r-ar; dc=c-ac
            if t=="h" and (abs(dr),abs(dc)) in ((1,2),(2,1)):
                leg=(ar+(dr//2 if abs(dr)==2 else 0),ac+(dc//2 if abs(dc)==2 else 0))
                if board[leg[0]][leg[1]] is None:
                    return True
            elif t=="e" and abs(dr)==abs(dc)==2:
                eye=(ar+dr//2,ac+dc//2)
                if board[eye[0]][eye[1]] is None:
                    # elephants cannot cross river
                    if (r<5)==(ar<5): return True
            elif t=="a" and abs(dr)==abs(dc)==1 and _x_in_palace(r,c,by_side):
                return True
            elif t=="k" and max(abs(dr),abs(dc))==1 and _x_in_palace(r,c,by_side):
                return True
            elif t=="r" and (dr==0 or dc==0):
                sr=0 if dr==0 else (1 if dr>0 else -1); sc=0 if dc==0 else (1 if dc>0 else -1)
                rr,cc=ar+sr,ac+sc; clear=True
                while (rr,cc)!=(r,c):
                    if board[rr][cc] is not None: clear=False; break
                    rr+=sr;cc+=sc
                if clear: return True
            elif t=="c" and (dr==0 or dc==0):
                sr=0 if dr==0 else (1 if dr>0 else -1); sc=0 if dc==0 else (1 if dc>0 else -1)
                rr,cc=ar+sr,ac+sc; count=0
                while (rr,cc)!=(r,c):
                    if board[rr][cc] is not None: count+=1
                    rr+=sr;cc+=sc
                if count==1: return True
            elif t=="p":
                direction=-1 if by_side=="red" else 1
                crossed=(r>4) if by_side=="black" else (r<5)
                if dr==direction and dc==0: return True
                if crossed and dr==0 and abs(dc)==1: return True
    return False


def _x_check(board,side):
    gs=_x_general(board,side)
    if gs is None: return True
    gr,gc=gs
    enemy="black" if side=="red" else "red"
    # flying general
    eg=_x_general(board,enemy)
    if eg:
        er,ec=eg
        if ec==gc:
            rr=er+(1 if gr>er else -1)
            clear=True
            while rr!=gr:
                if board[rr][gc] is not None: clear=False; break
                rr+=1 if gr>er else -1
            if clear: return True
    return _x_attacked(board,gr,gc,enemy)


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


def _x_legal(state,fr=None):
    board=state["board"]; side=state["turn"]; out=[]
    for r in range(10):
        for c in range(9):
            if fr is not None and (r,c)!=fr: continue
            p=board[r][c]
            if p is None or _x_side(p)!=side: continue
            for b in _x_pseudo(board,r,c):
                tb=_clone(board); tb[b[0]][b[1]]=tb[r][c];tb[r][c]=None
                if not _x_check(tb,side): out.append(((r,c),b))
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


def _x_eval(state):
    values={"k":20000,"a":120,"e":180,"h":400,"r":550,"c":450,"p":100}
    score=0
    for row in state["board"]:
        for p in row:
            if p:
                v=values[p.lower()]*(1 if p.isupper() else -1)
                score+=v
    return score


def _x_minimax(state,depth,alpha,beta,root):
    if state["terminal"]:
        if state["winner"]==root: return 1000000
        if state["winner"]=="draw": return 0
        return -1000000
    if depth<=0:
        v=_x_eval(state)
        return v if root=="red" else -v
    moves=_x_legal(state)
    if not moves:return 0
    maxing=state["turn"]==root
    if maxing:
        val=-10**9
        for m in moves:
            ch=_clone(state);_x_make(ch,m[0],m[1])
            val=max(val,_x_minimax(ch,depth-1,alpha,beta,root));alpha=max(alpha,val)
            if beta<=alpha:break
        return val
    val=10**9
    for m in moves:
        ch=_clone(state);_x_make(ch,m[0],m[1])
        val=min(val,_x_minimax(ch,depth-1,alpha,beta,root));beta=min(beta,val)
        if beta<=alpha:break
    return val


def _x_ai(state,difficulty):
    moves=_x_legal(state)
    if not moves: raise ValueError("no legal xiangqi moves")
    rng=random.Random()
    if difficulty=="easy":
        captures=[m for m in moves if state["board"][m[1][0]][m[1][1]] is not None]
        candidates=captures if captures and rng.random()<0.5 else moves
        return rng.choice(candidates)
    depth={"medium":2,"hard":3}[difficulty]
    root=state["turn"];scored_moves=[]
    for m in moves:
        ch=_clone(state);_x_make(ch,m[0],m[1])
        score=_x_minimax(ch,depth-1,-10**9,10**9,root)
        scored_moves.append((m,score))
    tolerance={"medium":80,"hard":10}[difficulty]
    return _choose_near_best(scored_moves,tolerance,rng)


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


def _go_liberty_score(state):
    board=state["board"];score=0.0
    for r in range(9):
        for c in range(9):
            if board[r][c]=="B":score+=1
            elif board[r][c]=="W":score-=1
    for r in range(9):
        for c in range(9):
            if board[r][c]==".":
                touch={board[nr][nc] for nr,nc in _go_neighbors(r,c)}-{"."}
                if touch=={"B"}:score+=0.5
                elif touch=={"W"}:score-=0.5
    return score


def _go_ai(state,difficulty):
    if state["terminal"]:raise ValueError("game is already terminal")
    side=state["turn"]
    rng=random.Random()
    candidates=[]
    for r in range(9):
        for c in range(9):
            if state["board"][r][c]==".":
                ch=_clone(state)
                try:_go_place(ch,r,c,"B" if side=="black" else "W")
                except ValueError:continue
                candidates.append((r,c,ch))
    if difficulty=="easy":
        if not candidates:return {"pass":True}
        capture=[]
        enemy="W" if side=="black" else "B"
        for r,c,ch in candidates:
            before=sum(row.count(enemy) for row in state["board"])
            after=sum(row.count(enemy) for row in ch["board"])
            if after<before:capture.append((r,c))
        all_moves=[(r,c) for r,c,_ in candidates]
        choice=rng.choice(capture if capture and rng.random()<0.5 else all_moves)
        return {"at":[choice[0],choice[1]]}
    # medium and hard use 1-ply/2-ply local heuristic
    depth=1 if difficulty=="medium" else 2
    root=side;scored_moves=[]
    for r,c,ch in candidates:
        val=_go_search(ch,depth-1,root)
        scored_moves.append(({"at":[r,c]},val))
    if not scored_moves:return {"pass":True}
    tolerance={"medium":1.0,"hard":0.1}[difficulty]
    return _choose_near_best(scored_moves,tolerance,rng)


def _go_search(state,depth,root):
    if depth<=0:return _go_liberty_score(state)*(1 if root=="black" else -1)
    side=state["turn"];best=-10**9 if side==root else 10**9
    found=False
    for r in range(9):
        for c in range(9):
            if state["board"][r][c]!=".":continue
            ch=_clone(state)
            try:_go_place(ch,r,c,"B" if side=="black" else "W")
            except ValueError:continue
            found=True;v=_go_search(ch,depth-1,root)
            if side==root:best=max(best,v)
            else:best=min(best,v)
    return best if found else _go_liberty_score(state)*(1 if root=="black" else -1)


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
    if game_type not in ("chess","xiangqi","go"):
        raise ValueError("unknown game_type")


def _validate_state(game_type,state):
    if not isinstance(state, dict):
        raise ValueError("state must be an object")
    if state.get("game_type") != game_type:
        raise ValueError("state game_type mismatch")
    if state.get("terminal") is not False or state.get("result") != "ongoing":
        raise ValueError("game is already terminal")

    dimensions = {"chess": (8, 8), "xiangqi": (10, 9), "go": (9, 9)}
    pieces = {
        "chess": set(".prnbqkPRNBQK"),
        "xiangqi": set(".rheakcpRHEAKCP"),
        "go": {".", "B", "W"},
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
    else:
        m=_go_ai(out,difficulty)
        _go_play_legal(out,m)
    return _none_to_dot(out)
