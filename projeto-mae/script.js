// Add floating hearts
function createHearts() {
    const container = document.body;
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.classList.add('heart');
            heart.innerHTML = '❤️';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.animationDuration = (Math.random() * 3 + 3) + 's';
            heart.style.fontSize = (Math.random() * 1.5 + 0.5) + 'rem';
            container.appendChild(heart);
            
            // Remove and recreate to loop continuously without cluttering DOM
            setTimeout(() => {
                heart.remove();
                createSingleHeart();
            }, 6000);
        }, i * 300);
    }
}

function createSingleHeart() {
    const container = document.body;
    const heart = document.createElement('div');
    heart.classList.add('heart');
    heart.innerHTML = '❤️';
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.animationDuration = (Math.random() * 3 + 3) + 's';
    heart.style.fontSize = (Math.random() * 1.5 + 0.5) + 'rem';
    container.appendChild(heart);
    
    setTimeout(() => {
        heart.remove();
        createSingleHeart();
    }, parseFloat(heart.style.animationDuration) * 1000);
}

// Remove placeholder text when user clicks to type
document.querySelectorAll('.message-card').forEach(card => {
    const p = card.querySelector('p');
    const originalText = p.innerText;
    
    card.addEventListener('focus', () => {
        if (p.innerText === originalText) {
            p.innerText = '';
        }
    });
    
    card.addEventListener('blur', () => {
        if (p.innerText.trim() === '') {
            p.innerText = originalText;
        }
    });
});

document.addEventListener('DOMContentLoaded', createHearts);
