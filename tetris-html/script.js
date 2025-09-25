// Configurações do jogo
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;

// Cores das peças
const COLORS = {
    0: '#000000', // Vazio
    1: '#FF0D72', // I - Rosa
    2: '#0DC2FF', // O - Azul claro
    3: '#0DFF72', // T - Verde
    4: '#F538FF', // S - Magenta
    5: '#FF8E0D', // Z - Laranja
    6: '#FFE138', // J - Amarelo
    7: '#3877FF'  // L - Azul
};

// Formas das peças Tetris
const PIECES = {
    I: {
        shape: [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        color: 1
    },
    O: {
        shape: [
            [2, 2],
            [2, 2]
        ],
        color: 2
    },
    T: {
        shape: [
            [0, 3, 0],
            [3, 3, 3],
            [0, 0, 0]
        ],
        color: 3
    },
    S: {
        shape: [
            [0, 4, 4],
            [4, 4, 0],
            [0, 0, 0]
        ],
        color: 4
    },
    Z: {
        shape: [
            [5, 5, 0],
            [0, 5, 5],
            [0, 0, 0]
        ],
        color: 5
    },
    J: {
        shape: [
            [6, 0, 0],
            [6, 6, 6],
            [0, 0, 0]
        ],
        color: 6
    },
    L: {
        shape: [
            [0, 0, 7],
            [7, 7, 7],
            [0, 0, 0]
        ],
        color: 7
    }
};

// Variáveis do jogo
let canvas, ctx, nextCanvas, nextCtx;
let board = [];
let currentPiece = null;
let nextPiece = null;
let gameRunning = false;
let gamePaused = false;
let score = 0;
let level = 1;
let lines = 0;
let dropTime = 0;
let lastTime = 0;

// Elementos DOM
let scoreElement, levelElement, linesElement;
let startBtn, pauseBtn, restartBtn;
let gameOverDiv, finalScoreElement;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('tetris-canvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('next-canvas');
    nextCtx = nextCanvas.getContext('2d');
    
    scoreElement = document.getElementById('score');
    levelElement = document.getElementById('level');
    linesElement = document.getElementById('lines');
    startBtn = document.getElementById('start-btn');
    pauseBtn = document.getElementById('pause-btn');
    restartBtn = document.getElementById('restart-btn');
    gameOverDiv = document.getElementById('game-over');
    finalScoreElement = document.getElementById('final-score');
    
    // Event listeners
    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    restartBtn.addEventListener('click', restartGame);
    
    // Controles do teclado
    document.addEventListener('keydown', handleKeyPress);
    
    // Inicializar o tabuleiro
    initBoard();
    draw();
});

// Inicializar o tabuleiro vazio
function initBoard() {
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
}

// Criar uma nova peça aleatória
function createPiece() {
    const pieces = Object.keys(PIECES);
    const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
    const piece = JSON.parse(JSON.stringify(PIECES[randomPiece]));
    
    return {
        shape: piece.shape,
        color: piece.color,
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(piece.shape[0].length / 2),
        y: 0
    };
}

// Verificar se a peça pode ser colocada na posição
function isValidMove(piece, dx = 0, dy = 0, newShape = null) {
    const shape = newShape || piece.shape;
    const newX = piece.x + dx;
    const newY = piece.y + dy;
    
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x] !== 0) {
                const boardX = newX + x;
                const boardY = newY + y;
                
                // Verificar limites
                if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
                    return false;
                }
                
                // Verificar colisão com peças existentes
                if (boardY >= 0 && board[boardY][boardX] !== 0) {
                    return false;
                }
            }
        }
    }
    return true;
}

// Rotacionar a peça
function rotatePiece(piece) {
    const rotated = [];
    const size = piece.shape.length;
    
    for (let i = 0; i < size; i++) {
        rotated[i] = [];
        for (let j = 0; j < size; j++) {
            rotated[i][j] = piece.shape[size - 1 - j][i];
        }
    }
    
    return rotated;
}

// Colocar a peça no tabuleiro
function placePiece(piece) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x] !== 0) {
                const boardY = piece.y + y;
                const boardX = piece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = piece.color;
                }
            }
        }
    }
}

// Limpar linhas completas
function clearLines() {
    let linesCleared = 0;
    
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            y++; // Verificar a mesma linha novamente
        }
    }
    
    if (linesCleared > 0) {
        // Calcular pontuação
        const points = [0, 40, 100, 300, 1200];
        score += points[linesCleared] * level;
        lines += linesCleared;
        
        // Aumentar nível a cada 10 linhas
        level = Math.floor(lines / 10) + 1;
        
        updateUI();
    }
}

// Verificar game over
function isGameOver() {
    return !isValidMove(currentPiece);
}

// Mover peça
function movePiece(dx, dy) {
    if (isValidMove(currentPiece, dx, dy)) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        return true;
    }
    return false;
}

// Rotacionar peça atual
function rotatePieceIfPossible() {
    const rotated = rotatePiece(currentPiece);
    if (isValidMove(currentPiece, 0, 0, rotated)) {
        currentPiece.shape = rotated;
    }
}

// Fazer a peça cair instantaneamente
function hardDrop() {
    while (movePiece(0, 1)) {
        score += 2; // Pontos extras por hard drop
    }
    updateUI();
}

// Controles do teclado
function handleKeyPress(event) {
    if (!gameRunning || gamePaused) return;
    
    switch (event.code) {
        case 'ArrowLeft':
            movePiece(-1, 0);
            break;
        case 'ArrowRight':
            movePiece(1, 0);
            break;
        case 'ArrowDown':
            if (movePiece(0, 1)) {
                score += 1; // Ponto extra por soft drop
                updateUI();
            }
            break;
        case 'ArrowUp':
            rotatePieceIfPossible();
            break;
        case 'Space':
            event.preventDefault();
            togglePause();
            break;
    }
}

// Atualizar interface
function updateUI() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
}

// Desenhar um bloco
function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = COLORS[color];
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    // Borda do bloco
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// Desenhar o tabuleiro
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (board[y][x] !== 0) {
                drawBlock(ctx, x, y, board[y][x]);
            }
        }
    }
}

// Desenhar a peça atual
function drawCurrentPiece() {
    if (!currentPiece) return;
    
    for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
            if (currentPiece.shape[y][x] !== 0) {
                drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, currentPiece.color);
            }
        }
    }
}

// Desenhar a próxima peça
function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (!nextPiece) return;
    
    const blockSize = 20;
    const offsetX = (nextCanvas.width - nextPiece.shape[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - nextPiece.shape.length * blockSize) / 2;
    
    for (let y = 0; y < nextPiece.shape.length; y++) {
        for (let x = 0; x < nextPiece.shape[y].length; x++) {
            if (nextPiece.shape[y][x] !== 0) {
                nextCtx.fillStyle = COLORS[nextPiece.color];
                nextCtx.fillRect(
                    offsetX + x * blockSize,
                    offsetY + y * blockSize,
                    blockSize,
                    blockSize
                );
                
                nextCtx.strokeStyle = '#333';
                nextCtx.lineWidth = 1;
                nextCtx.strokeRect(
                    offsetX + x * blockSize,
                    offsetY + y * blockSize,
                    blockSize,
                    blockSize
                );
            }
        }
    }
}

// Desenhar tudo
function draw() {
    drawBoard();
    drawCurrentPiece();
    drawNextPiece();
}

// Loop principal do jogo
function gameLoop(time = 0) {
    if (!gameRunning || gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const deltaTime = time - lastTime;
    lastTime = time;
    dropTime += deltaTime;
    
    // Velocidade baseada no nível
    const dropInterval = Math.max(50, 1000 - (level - 1) * 50);
    
    if (dropTime > dropInterval) {
        if (!movePiece(0, 1)) {
            // Peça não pode mais descer
            placePiece(currentPiece);
            clearLines();
            
            // Próxima peça
            currentPiece = nextPiece;
            nextPiece = createPiece();
            
            if (isGameOver()) {
                endGame();
                return;
            }
        }
        dropTime = 0;
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// Iniciar o jogo
function startGame() {
    if (gameRunning) return;
    
    initBoard();
    currentPiece = createPiece();
    nextPiece = createPiece();
    score = 0;
    level = 1;
    lines = 0;
    dropTime = 0;
    lastTime = 0;
    gameRunning = true;
    gamePaused = false;
    
    gameOverDiv.classList.add('hidden');
    startBtn.textContent = 'Reiniciar';
    
    updateUI();
    requestAnimationFrame(gameLoop);
}

// Pausar/despausar o jogo
function togglePause() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    pauseBtn.textContent = gamePaused ? 'Continuar' : 'Pausar';
    
    if (!gamePaused) {
        requestAnimationFrame(gameLoop);
    }
}

// Terminar o jogo
function endGame() {
    gameRunning = false;
    finalScoreElement.textContent = score;
    gameOverDiv.classList.remove('hidden');
    startBtn.textContent = 'Iniciar';
    pauseBtn.textContent = 'Pausar';
}

// Reiniciar o jogo
function restartGame() {
    gameOverDiv.classList.add('hidden');
    startGame();
}

