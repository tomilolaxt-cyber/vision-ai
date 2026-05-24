// ============================================================
//  VISION CHESS ENGINE — Full check/checkmate/stalemate
// ============================================================

const CHESS = {
  board: [],
  selected: null,
  turn: 'w',
  history: [],
  whiteCap: [],
  blackCap: [],
  lastFrom: null,
  lastTo: null,
  gameOver: false,
  validMoves: [],

  PIECES: {
    wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
    bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
  },

  VALUES: {K:10000,Q:900,R:500,B:330,N:320,P:100},

  init() {
    this.board = [
      ['bR','bN','bB','bQ','bK','bB','bN','bR'],
      ['bP','bP','bP','bP','bP','bP','bP','bP'],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      ['wP','wP','wP','wP','wP','wP','wP','wP'],
      ['wR','wN','wB','wQ','wK','wB','wN','wR']
    ];
    this.selected=null; this.turn='w'; this.history=[];
    this.whiteCap=[]; this.blackCap=[];
    this.lastFrom=null; this.lastTo=null;
    this.gameOver=false; this.validMoves=[];
    this.render();
    this.updateStatus('Your turn — White ♔');
  },

  // ── Clone board ──────────────────────────────────────────
  cloneBoard(b) {
    return b.map(r => [...r]);
  },

  // ── Find king position ───────────────────────────────────
  findKing(board, color) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++)
      if (board[r][c] === color+'K') return [r,c];
    return null;
  },

  // ── Is square attacked by enemy? ────────────────────────
  isAttacked(board, r, c, byColor) {
    const enemy = byColor;
    // Check all enemy pieces
    for (let er=0;er<8;er++) for (let ec=0;ec<8;ec++) {
      const p = board[er][ec];
      if (!p || p[0]!==enemy) continue;
      const type = p[1];
      const dr = r-er, dc = c-ec;
      const adr = Math.abs(dr), adc = Math.abs(dc);

      if (type==='P') {
        const dir = enemy==='w' ? -1 : 1;
        if (dr===dir && adc===1) return true;
      }
      if (type==='N') {
        if ((adr===2&&adc===1)||(adr===1&&adc===2)) return true;
      }
      if (type==='K') {
        if (adr<=1&&adc<=1) return true;
      }
      if (type==='R'||type==='Q') {
        if (dr===0||dc===0) {
          const sr=Math.sign(dr), sc=Math.sign(dc);
          let blocked=false;
          for (let i=1;i<8;i++) {
            const nr=er+sr*i, nc=ec+sc*i;
            if (nr===r&&nc===c) { if(!blocked) return true; break; }
            if (board[nr]?.[nc]) { blocked=true; break; }
          }
        }
      }
      if (type==='B'||type==='Q') {
        if (adr===adc) {
          const sr=Math.sign(dr), sc=Math.sign(dc);
          let blocked=false;
          for (let i=1;i<8;i++) {
            const nr=er+sr*i, nc=ec+sc*i;
            if (nr===r&&nc===c) { if(!blocked) return true; break; }
            if (board[nr]?.[nc]) { blocked=true; break; }
          }
        }
      }
    }
    return false;
  },

  // ── Is color in check? ───────────────────────────────────
  inCheck(board, color) {
    const kpos = this.findKing(board, color);
    if (!kpos) return false;
    const enemy = color==='w'?'b':'w';
    return this.isAttacked(board, kpos[0], kpos[1], enemy);
  },

  // ── Raw moves (no check filtering) ──────────────────────
  rawMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color=piece[0], type=piece[1], enemy=color==='w'?'b':'w';
    const moves=[];

    const add=(nr,nc)=>{
      if(nr<0||nr>7||nc<0||nc>7) return false;
      const t=board[nr][nc];
      if(t&&t[0]===color) return false;
      moves.push([nr,nc]);
      return !t;
    };

    if(type==='P'){
      const dir=color==='w'?-1:1, start=color==='w'?6:1;
      if(r+dir>=0&&r+dir<=7&&!board[r+dir][c]){
        moves.push([r+dir,c]);
        if(r===start&&!board[r+2*dir][c]) moves.push([r+2*dir,c]);
      }
      [[r+dir,c-1],[r+dir,c+1]].forEach(([nr,nc])=>{
        if(nr>=0&&nr<=7&&nc>=0&&nc<=7&&board[nr][nc]&&board[nr][nc][0]===enemy)
          moves.push([nr,nc]);
      });
    }
    if(type==='R'||type==='Q') [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{for(let i=1;i<8;i++)if(!add(r+dr*i,c+dc*i))break;});
    if(type==='B'||type==='Q') [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc])=>{for(let i=1;i<8;i++)if(!add(r+dr*i,c+dc*i))break;});
    if(type==='N') [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc));
    if(type==='K') [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c+dc));

    return moves;
  },

  // ── Legal moves (filters out moves that leave king in check) ──
  legalMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = piece[0];
    const raw = this.rawMoves(board, r, c);
    return raw.filter(([tr,tc]) => {
      const b2 = this.cloneBoard(board);
      let mp = b2[r][c];
      if(mp==='wP'&&tr===0) mp='wQ';
      if(mp==='bP'&&tr===7) mp='bQ';
      b2[tr][tc]=mp; b2[r][c]=null;
      return !this.inCheck(b2, color);
    });
  },

  // ── Has any legal move? ──────────────────────────────────
  hasLegalMoves(board, color) {
    for(let r=0;r<8;r++) for(let c=0;c<8;c++)
      if(board[r][c]&&board[r][c][0]===color&&this.legalMoves(board,r,c).length>0)
        return true;
    return false;
  },

  // ── Apply move to board ──────────────────────────────────
  applyMove(board, fr, fc, tr, tc) {
    const b = this.cloneBoard(board);
    let mp = b[fr][fc];
    if(mp==='wP'&&tr===0) mp='wQ';
    if(mp==='bP'&&tr===7) mp='bQ';
    b[tr][tc]=mp; b[fr][fc]=null;
    return b;
  },

  // ── Handle click ─────────────────────────────────────────
  handleClick(r, c) {
    if(this.gameOver||this.turn!=='w') return;
    const piece=this.board[r][c];

    if(this.selected){
      const isValid=this.validMoves.some(m=>m[0]===r&&m[1]===c);
      if(isValid){
        this.doMove(r,c);
        return;
      }
      this.selected=null; this.validMoves=[];
    }

    if(piece&&piece[0]==='w'){
      const moves=this.legalMoves(this.board,r,c);
      if(moves.length>0){
        this.selected=[r,c];
        this.validMoves=moves;
      }
    }
    this.render();
  },

  doMove(tr, tc) {
    const [fr,fc]=this.selected;
    const target=this.board[tr][tc];
    if(target){
      if(target[0]==='b') this.whiteCap.push(target);
      else this.blackCap.push(target);
    }
    this.board=this.applyMove(this.board,fr,fc,tr,tc);
    this.lastFrom=[fr,fc]; this.lastTo=[tr,tc];
    this.recordMove(fr,fc,tr,tc,this.board[tr][tc],target,false);
    this.selected=null; this.validMoves=[];
    this.turn='b';
    this.render();
    this.checkGameState('b');
    if(!this.gameOver){
      this.updateStatus('Vision is thinking...');
      setTimeout(()=>this.aiMove(),400);
    }
  },

  recordMove(fr,fc,tr,tc,piece,captured,isAI){
    const cols='abcdefgh';
    const notation=(this.PIECES[piece]||'')+cols[fc]+(8-fr)+'→'+cols[tc]+(8-tr)+(captured?'✕':'');
    this.history.push({fr,fc,tr,tc,piece,captured,notation,isAI});
    const mh=document.getElementById('chessMoves');
    if(mh){
      mh.innerHTML+='<span style="color:'+(isAI?'#aa00ff':'#00eeff')+'">'+notation+'</span> ';
      mh.scrollTop=mh.scrollHeight;
    }
  },

  checkGameState(color){
    const inCk=this.inCheck(this.board,color);
    const hasMoves=this.hasLegalMoves(this.board,color);
    if(!hasMoves){
      this.gameOver=true;
      if(inCk){
        const winner=color==='w'?'Vision wins! Checkmate 🤖':'You win! Checkmate 🎉';
        this.updateStatus(winner);
      } else {
        this.updateStatus('Stalemate — Draw 🤝');
      }
    } else if(inCk){
      const who=color==='w'?'You are':'Vision is';
      this.updateStatus(who+' in CHECK! ⚠');
    }
  },

  // ── AI move with minimax (depth 2) ───────────────────────
  aiMove(){
    if(this.gameOver) return;
    const move=this.getBestMove(this.board,'b',2);
    if(!move){
      this.checkGameState('b');
      return;
    }
    const {fr,fc,tr,tc}=move;
    const target=this.board[tr][tc];
    if(target){
      if(target[0]==='b') this.whiteCap.push(target);
      else this.blackCap.push(target);
    }
    this.board=this.applyMove(this.board,fr,fc,tr,tc);
    this.lastFrom=[fr,fc]; this.lastTo=[tr,tc];
    this.recordMove(fr,fc,tr,tc,this.board[tr][tc],target,true);
    this.turn='w';
    this.render();
    this.checkGameState('w');
    if(!this.gameOver) this.updateStatus('Your turn — White ♔');
  },

  // ── Evaluate board ───────────────────────────────────────
  evaluate(board){
    let score=0;
    const centerBonus=[[0,0,0,0,0,0,0,0],[0,1,1,1,1,1,1,0],[0,1,2,2,2,2,1,0],[0,1,2,3,3,2,1,0],[0,1,2,3,3,2,1,0],[0,1,2,2,2,2,1,0],[0,1,1,1,1,1,1,0],[0,0,0,0,0,0,0,0]];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p=board[r][c];
      if(!p) continue;
      const val=(this.VALUES[p[1]]||0)+(centerBonus[r][c]*5);
      if(p[0]==='b') score+=val;
      else score-=val;
    }
    if(this.inCheck(board,'w')) score+=50;
    if(this.inCheck(board,'b')) score-=50;
    return score;
  },

  // ── Minimax ──────────────────────────────────────────────
  minimax(board,depth,isMax,alpha,beta){
    if(depth===0) return this.evaluate(board);
    const color=isMax?'b':'w';
    const moves=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++)
      if(board[r][c]&&board[r][c][0]===color)
        this.legalMoves(board,r,c).forEach(([tr,tc])=>moves.push({fr:r,fc:c,tr,tc}));

    if(!moves.length) return isMax?-99999:99999;

    if(isMax){
      let best=-Infinity;
      for(const m of moves){
        const b2=this.applyMove(board,m.fr,m.fc,m.tr,m.tc);
        best=Math.max(best,this.minimax(b2,depth-1,false,alpha,beta));
        alpha=Math.max(alpha,best);
        if(beta<=alpha) break;
      }
      return best;
    } else {
      let best=Infinity;
      for(const m of moves){
        const b2=this.applyMove(board,m.fr,m.fc,m.tr,m.tc);
        best=Math.min(best,this.minimax(b2,depth-1,true,alpha,beta));
        beta=Math.min(beta,best);
        if(beta<=alpha) break;
      }
      return best;
    }
  },

  getBestMove(board,color,depth){
    const moves=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++)
      if(board[r][c]&&board[r][c][0]===color)
        this.legalMoves(board,r,c).forEach(([tr,tc])=>moves.push({fr:r,fc:c,tr,tc}));

    if(!moves.length) return null;

    let best=null, bestScore=-Infinity;
    for(const m of moves){
      const b2=this.applyMove(board,m.fr,m.fc,m.tr,m.tc);
      const score=this.minimax(b2,depth-1,false,-Infinity,Infinity);
      if(score>bestScore){ bestScore=score; best=m; }
    }
    return best;
  },

  // ── Render ───────────────────────────────────────────────
  render(){
    const board=document.getElementById('chessBoard');
    if(!board) return;
    board.innerHTML='';

    const cols='abcdefgh';
    const topL=document.getElementById('chessLabelsTop');
    const sideL=document.getElementById('chessLabelsSide');
    if(topL){topL.innerHTML='';for(let c=0;c<8;c++){const d=document.createElement('div');d.className='chess-label-col';d.textContent=cols[c];topL.appendChild(d);}}
    if(sideL){sideL.innerHTML='';for(let r=0;r<8;r++){const d=document.createElement('div');d.className='chess-label-row';d.textContent=8-r;sideL.appendChild(d);}}

    const inCheckW=this.inCheck(this.board,'w');
    const inCheckB=this.inCheck(this.board,'b');
    const wKing=this.findKing(this.board,'w');
    const bKing=this.findKing(this.board,'b');

    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const cell=document.createElement('div');
      cell.className='chess-cell '+((r+c)%2===0?'light':'dark');
      cell.dataset.r=r; cell.dataset.c=c;

      if(this.lastFrom&&this.lastFrom[0]===r&&this.lastFrom[1]===c) cell.classList.add('last-from');
      if(this.lastTo&&this.lastTo[0]===r&&this.lastTo[1]===c) cell.classList.add('last-to');
      if(this.selected&&this.selected[0]===r&&this.selected[1]===c) cell.classList.add('selected');

      // Highlight king in check
      if(inCheckW&&wKing&&wKing[0]===r&&wKing[1]===c) cell.classList.add('check');
      if(inCheckB&&bKing&&bKing[0]===r&&bKing[1]===c) cell.classList.add('check');

      const isValid=this.validMoves.some(m=>m[0]===r&&m[1]===c);
      if(isValid){
        if(this.board[r][c]) cell.classList.add('valid-capture');
        else cell.classList.add('valid-move');
      }

      const piece=this.board[r][c];
      if(piece) cell.textContent=this.PIECES[piece]||'';
      cell.onclick=()=>this.handleClick(r,c);
      board.appendChild(cell);
    }

    const wc=document.getElementById('wCap');
    const bc=document.getElementById('bCap');
    if(wc) wc.textContent=this.whiteCap.map(p=>this.PIECES[p]||'').join('');
    if(bc) bc.textContent=this.blackCap.map(p=>this.PIECES[p]||'').join('');
  },

  updateStatus(msg){
    const el=document.getElementById('chessStatus');
    if(el) el.textContent=msg;
  },

  undo(){
    if(this.history.length<2) return;
    for(let i=0;i<2&&this.history.length>0;i++){
      const m=this.history.pop();
      // Reverse the move
      let origPiece=m.piece;
      // If it was a promotion, restore pawn
      if(origPiece==='wQ'&&m.fr===1) origPiece='wP';
      if(origPiece==='bQ'&&m.fr===6) origPiece='bP';
      this.board[m.fr][m.fc]=origPiece;
      this.board[m.tr][m.tc]=m.captured||null;
      if(m.captured){
        if(m.captured[0]==='b') this.whiteCap.pop();
        else this.blackCap.pop();
      }
    }
    this.turn='w'; this.selected=null; this.validMoves=[];
    this.lastFrom=this.history.length?[this.history[this.history.length-1].fr,this.history[this.history.length-1].fc]:null;
    this.lastTo=this.history.length?[this.history[this.history.length-1].tr,this.history[this.history.length-1].tc]:null;
    this.gameOver=false;
    const mh=document.getElementById('chessMoves');
    if(mh) mh.innerHTML=this.history.map(h=>'<span style="color:'+(h.isAI?'#aa00ff':'#00eeff')+'">'+h.notation+'</span> ').join('');
    this.render();
    this.updateStatus('Your turn — White ♔');
  }
};

function resetChess(){ CHESS.init(); }
function undoChess(){ CHESS.undo(); }

async function askVisionChessTip(){
  const prompt='Give me 3 quick practical chess tips to improve my game. Keep each tip to one sentence.';
  if(typeof sendToVision==='function'){
    if(typeof showTab==='function') showTab('chat',document.querySelector('.ntab'));
    sendToVision(prompt);
  }
}
