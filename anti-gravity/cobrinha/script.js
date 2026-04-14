const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const restartBtn = document.getElementById('restartBtn');

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [];
let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameLoopTimeout;
let isGameOver = false;

highScoreElement.textContent = highScore;

function initGame() {
    snake = [
        { x: 10, y: 10 },
    ];
    dx = 0;
    dy = 0;
    score = 0;
    scoreElement.textContent = score;
    isGameOver = false;
    placeFood();
    clearTimeout(gameLoopTimeout);
    gameLoop();
}

function placeFood() {
    food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
    };
    // Make sure food is not on snake
    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            placeFood();
            break;
        }
    }
}

function gameLoop() {
    if (isGameOver) return;

    gameLoopTimeout = setTimeout(() => {
        clearScreen();
        moveSnake();
        checkCollision();
        drawFood();
        drawSnake();
        gameLoop();
    }, 100);
}

function clearScreen() {
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSnake() {
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#e94560' : '#d13d56'; // Head is slightly different color
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    });
}

function drawFood() {
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
}

function moveSnake() {
    if (dx === 0 && dy === 0) {
        return;
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
        placeFood();
    } else {
        snake.pop();
    }
}

function checkCollision() {
    if (dx === 0 && dy === 0) return; // Don't check if not moving

    const head = snake[0];

    // Wall collision
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
    }

    // Self collision
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
        }
    }
}

function gameOver() {
    isGameOver = true;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Fim de Jogo!', canvas.width / 2, canvas.height / 2 - 15);

    ctx.font = '20px Inter';
    ctx.fillText(`Pontuação: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
}

document.addEventListener('keydown', (e) => {
    // Prevent default scrolling for arrow keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    const isUp = e.code === 'ArrowUp' || e.code === 'KeyW';
    const isDown = e.code === 'ArrowDown' || e.code === 'KeyS';
    const isLeft = e.code === 'ArrowLeft' || e.code === 'KeyA';
    const isRight = e.code === 'ArrowRight' || e.code === 'KeyD';

    if (isUp && dy !== 1) {
        dx = 0;
        dy = -1;
    } else if (isDown && dy !== -1) {
        dx = 0;
        dy = 1;
    } else if (isLeft && dx !== 1) {
        dx = -1;
        dy = 0;
    } else if (isRight && dx !== -1) {
        dx = 1;
        dy = 0;
    }
});

restartBtn.addEventListener('click', initGame);

// Start initially
initGame();
