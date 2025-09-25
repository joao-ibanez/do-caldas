// Representação das peças usando símbolos Unicode
const PIECES = {
    'white': {
        'king': '♔',
        'queen': '♕',
        'rook': '♖',
        'bishop': '♗',
        'knight': '♘',
        'pawn': '♙'
    },
    'black': {
        'king': '♚',
        'queen': '♛',
        'rook': '♜',
        'bishop': '♝',
        'knight': '♞',
        'pawn': '♟'
    }
};

class ChessGame {
    constructor() {
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStatus = 'playing';
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.kingPositions = { white: [7, 4], black: [0, 4] };
        
        this.initializeDOM();
        this.renderBoard();
        this.updateGameInfo();
    }

    initializeBoard() {
        // Configuração inicial do tabuleiro
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Peças pretas
        board[0] = [
            { type: 'rook', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'queen', color: 'black' },
            { type: 'king', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'rook', color: 'black' }
        ];
        
        board[1] = Array(8).fill({ type: 'pawn', color: 'black' });
        
        // Peças brancas
        board[6] = Array(8).fill({ type: 'pawn', color: 'white' });
        
        board[7] = [
            { type: 'rook', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'queen', color: 'white' },
            { type: 'king', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'rook', color: 'white' }
        ];
        
        return board;
    }

    initializeDOM() {
        this.boardElement = document.getElementById('chessboard');
        this.currentPlayerElement = document.getElementById('current-player');
        this.gameStatusElement = document.getElementById('game-status');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.undoBtn = document.getElementById('undo-btn');
        this.capturedWhiteElement = document.getElementById('captured-white-pieces');
        this.capturedBlackElement = document.getElementById('captured-black-pieces');

        this.newGameBtn.addEventListener('click', () => this.newGame());
        this.undoBtn.addEventListener('click', () => this.undoMove());
    }

    renderBoard() {
        this.boardElement.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                const piece = this.board[row][col];
                if (piece) {
                    square.textContent = PIECES[piece.color][piece.type];
                }
                
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                this.boardElement.appendChild(square);
            }
        }
    }

    handleSquareClick(row, col) {
        if (this.gameStatus !== 'playing') return;

        const clickedPiece = this.board[row][col];
        
        if (this.selectedSquare) {
            const [selectedRow, selectedCol] = this.selectedSquare;
            
            if (selectedRow === row && selectedCol === col) {
                // Desselecionar a peça
                this.selectedSquare = null;
                this.clearHighlights();
                return;
            }
            
            if (this.isValidMove(selectedRow, selectedCol, row, col)) {
                this.makeMove(selectedRow, selectedCol, row, col);
                this.selectedSquare = null;
                this.clearHighlights();
                this.switchPlayer();
                this.checkGameStatus();
            } else if (clickedPiece && clickedPiece.color === this.currentPlayer) {
                // Selecionar nova peça
                this.selectedSquare = [row, col];
                this.highlightPossibleMoves(row, col);
            } else {
                this.selectedSquare = null;
                this.clearHighlights();
            }
        } else if (clickedPiece && clickedPiece.color === this.currentPlayer) {
            // Selecionar peça
            this.selectedSquare = [row, col];
            this.highlightPossibleMoves(row, col);
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        
        const targetPiece = this.board[toRow][toCol];
        if (targetPiece && targetPiece.color === piece.color) return false;
        
        // Verificar se o movimento é válido para o tipo de peça
        if (!this.isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol)) {
            return false;
        }
        
        // Simular o movimento para verificar se deixa o rei em xeque
        const originalTarget = this.board[toRow][toCol];
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Atualizar posição do rei se necessário
        let kingMoved = false;
        if (piece.type === 'king') {
            this.kingPositions[piece.color] = [toRow, toCol];
            kingMoved = true;
        }
        
        const inCheck = this.isKingInCheck(piece.color);
        
        // Reverter o movimento
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = originalTarget;
        
        if (kingMoved) {
            this.kingPositions[piece.color] = [fromRow, fromCol];
        }
        
        return !inCheck;
    }

    isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol) {
        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const absRowDiff = Math.abs(rowDiff);
        const absColDiff = Math.abs(colDiff);
        
        switch (piece.type) {
            case 'pawn':
                return this.isPawnMoveValid(piece, fromRow, fromCol, toRow, toCol);
            
            case 'rook':
                return (rowDiff === 0 || colDiff === 0) && 
                       this.isPathClear(fromRow, fromCol, toRow, toCol);
            
            case 'bishop':
                return absRowDiff === absColDiff && 
                       this.isPathClear(fromRow, fromCol, toRow, toCol);
            
            case 'queen':
                return ((rowDiff === 0 || colDiff === 0) || (absRowDiff === absColDiff)) &&
                       this.isPathClear(fromRow, fromCol, toRow, toCol);
            
            case 'knight':
                return (absRowDiff === 2 && absColDiff === 1) || 
                       (absRowDiff === 1 && absColDiff === 2);
            
            case 'king':
                return absRowDiff <= 1 && absColDiff <= 1;
            
            default:
                return false;
        }
    }

    isPawnMoveValid(piece, fromRow, fromCol, toRow, toCol) {
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);
        
        // Movimento para frente
        if (colDiff === 0) {
            if (this.board[toRow][toCol]) return false; // Não pode capturar movendo para frente
            
            if (rowDiff === direction) return true; // Movimento de uma casa
            
            if (fromRow === startRow && rowDiff === 2 * direction) {
                return !this.board[toRow][toCol]; // Movimento inicial de duas casas
            }
        }
        
        // Captura diagonal
        if (colDiff === 1 && rowDiff === direction) {
            return this.board[toRow][toCol] && 
                   this.board[toRow][toCol].color !== piece.color;
        }
        
        return false;
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
        const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.board[currentRow][currentCol]) return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        // Salvar movimento no histórico
        this.moveHistory.push({
            from: [fromRow, fromCol],
            to: [toRow, toCol],
            piece: { ...piece },
            captured: capturedPiece ? { ...capturedPiece } : null
        });
        
        // Capturar peça se houver
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            this.updateCapturedPieces();
        }
        
        // Mover a peça
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Atualizar posição do rei
        if (piece.type === 'king') {
            this.kingPositions[piece.color] = [toRow, toCol];
        }
        
        // Promoção do peão
        if (piece.type === 'pawn') {
            const promotionRow = piece.color === 'white' ? 0 : 7;
            if (toRow === promotionRow) {
                this.board[toRow][toCol] = { type: 'queen', color: piece.color };
            }
        }
        
        this.renderBoard();
        this.undoBtn.disabled = false;
    }

    isKingInCheck(color) {
        const [kingRow, kingCol] = this.kingPositions[color];
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === opponentColor) {
                    if (this.isPieceMovementValid(piece, row, col, kingRow, kingCol)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    getAllPossibleMoves(color) {
        const moves = [];
        
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (piece && piece.color === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                                moves.push({ from: [fromRow, fromCol], to: [toRow, toCol] });
                            }
                        }
                    }
                }
            }
        }
        
        return moves;
    }

    highlightPossibleMoves(row, col) {
        this.clearHighlights();
        
        const square = this.getSquareElement(row, col);
        square.classList.add('selected');
        
        for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
                if (this.isValidMove(row, col, toRow, toCol)) {
                    const targetSquare = this.getSquareElement(toRow, toCol);
                    const targetPiece = this.board[toRow][toCol];
                    
                    if (targetPiece) {
                        targetSquare.classList.add('capture-move');
                    } else {
                        targetSquare.classList.add('possible-move');
                    }
                }
            }
        }
    }

    clearHighlights() {
        const squares = this.boardElement.querySelectorAll('.square');
        squares.forEach(square => {
            square.classList.remove('selected', 'possible-move', 'capture-move', 'in-check');
        });
    }

    getSquareElement(row, col) {
        return this.boardElement.children[row * 8 + col];
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.updateGameInfo();
    }

    checkGameStatus() {
        const inCheck = this.isKingInCheck(this.currentPlayer);
        const possibleMoves = this.getAllPossibleMoves(this.currentPlayer);
        
        if (inCheck) {
            const [kingRow, kingCol] = this.kingPositions[this.currentPlayer];
            const kingSquare = this.getSquareElement(kingRow, kingCol);
            kingSquare.classList.add('in-check');
            
            if (possibleMoves.length === 0) {
                this.gameStatus = 'checkmate';
                const winner = this.currentPlayer === 'white' ? 'Pretas' : 'Brancas';
                this.gameStatusElement.textContent = `Xeque-mate! ${winner} vencem!`;
                return;
            } else {
                this.gameStatusElement.textContent = 'Xeque!';
            }
        } else if (possibleMoves.length === 0) {
            this.gameStatus = 'stalemate';
            this.gameStatusElement.textContent = 'Empate por afogamento!';
            return;
        } else {
            this.gameStatusElement.textContent = 'Jogo em andamento';
        }
    }

    updateGameInfo() {
        const playerName = this.currentPlayer === 'white' ? 'Brancas' : 'Pretas';
        this.currentPlayerElement.textContent = `Vez das ${playerName}`;
    }

    updateCapturedPieces() {
        this.capturedWhiteElement.innerHTML = '';
        this.capturedBlackElement.innerHTML = '';
        
        this.capturedPieces.white.forEach(piece => {
            const pieceElement = document.createElement('span');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = PIECES[piece.color][piece.type];
            this.capturedWhiteElement.appendChild(pieceElement);
        });
        
        this.capturedPieces.black.forEach(piece => {
            const pieceElement = document.createElement('span');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = PIECES[piece.color][piece.type];
            this.capturedBlackElement.appendChild(pieceElement);
        });
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;
        
        const lastMove = this.moveHistory.pop();
        const { from, to, piece, captured } = lastMove;
        
        // Reverter o movimento
        this.board[from[0]][from[1]] = piece;
        this.board[to[0]][to[1]] = captured;
        
        // Restaurar peça capturada
        if (captured) {
            const capturedArray = this.capturedPieces[captured.color];
            const index = capturedArray.findIndex(p => 
                p.type === captured.type && p.color === captured.color
            );
            if (index !== -1) {
                capturedArray.splice(index, 1);
            }
        }
        
        // Atualizar posição do rei
        if (piece.type === 'king') {
            this.kingPositions[piece.color] = from;
        }
        
        // Voltar ao jogador anterior
        this.switchPlayer();
        
        this.renderBoard();
        this.updateCapturedPieces();
        this.clearHighlights();
        this.checkGameStatus();
        
        if (this.moveHistory.length === 0) {
            this.undoBtn.disabled = true;
        }
    }

    newGame() {
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStatus = 'playing';
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.kingPositions = { white: [7, 4], black: [0, 4] };
        
        this.renderBoard();
        this.updateGameInfo();
        this.updateCapturedPieces();
        this.clearHighlights();
        this.undoBtn.disabled = true;
        this.gameStatusElement.textContent = 'Jogo em andamento';
    }
}

// Inicializar o jogo quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});

