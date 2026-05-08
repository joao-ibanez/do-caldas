const ROLES = {
    DUQUE: 'Duque',
    ASSASSINO: 'Assassino',
    CAPITAO: 'Capitão',
    CONDESSA: 'Condessa',
    EMBAIXADOR: 'Embaixador'
};

const ACTIONS = {
    RENDA: 'renda',
    AJUDA: 'ajuda',
    GOLPE: 'golpe',
    DUQUE: 'duque',
    ASSASSINO: 'assassino',
    CAPITAO: 'capitao',
    EMBAIXADOR: 'embaixador'
};

class CoupGame {
    constructor() {
        this.deck = [];
        this.treasury = 50;
        this.players = [];
        this.currentTurnIdx = 0;
        this.log = [];
        this.state = 'IDLE'; // IDLE, AWAITING_ACTION, AWAITING_TARGET, AWAITING_REACTION, RESOLVING
        this.pendingAction = null; 

        // Bot Names
        this.botNames = ["Ciborgue", "Nexus", "Glitch"];

        this.init();
    }

    init() {
        this.buildDeck();
        this.shuffleDeck();
        this.createPlayers();
        this.treasury = 50 - (4 * 2); // 4 players start with 2 coins
        this.updateUI();
        this.logMessage("Jogo iniciado. Boa sorte!", "log-highlight");
        this.startTurn();
    }

    buildDeck() {
        this.deck = [];
        for (let role in ROLES) {
            for (let i = 0; i < 3; i++) {
                this.deck.push(ROLES[role]);
            }
        }
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    drawCard() {
        return this.deck.pop();
    }

    createPlayers() {
        this.players = [];
        // Human
        this.players.push({
            id: 0,
            name: "Você",
            isHuman: true,
            coins: 2,
            cards: [{ role: this.drawCard(), dead: false }, { role: this.drawCard(), dead: false }]
        });

        // Bots
        for (let i = 0; i < 3; i++) {
            this.players.push({
                id: i + 1,
                name: this.botNames[i],
                isHuman: false,
                coins: 2,
                cards: [{ role: this.drawCard(), dead: false }, { role: this.drawCard(), dead: false }]
            });
        }
    }

    get activePlayers() {
        return this.players.filter(p => p.cards.some(c => !c.dead));
    }

    isGameOver() {
        return this.activePlayers.length <= 1;
    }

    getDelay() {
        // Se o humano estiver morto, os bots jogam mais rápido
        return this.players[0].cards.some(c => !c.dead) ? 1500 : 300;
    }

    startTurn() {
        if (this.isGameOver()) {
            const winner = this.activePlayers[0];
            this.showModal("Fim de Jogo!", `${winner ? winner.name : 'Ninguém'} dominou o governo!`, [{ text: "Jogar Novamente", action: () => location.reload() }]);
            return;
        }

        let player = this.players[this.currentTurnIdx];
        if (!player.cards.some(c => !c.dead)) {
            // Eliminated, skip
            this.nextTurn();
            return;
        }

        this.state = 'AWAITING_ACTION';
        this.pendingAction = null;
        this.updateUI();

        if (player.isHuman) {
            this.logMessage(`É o seu turno. Escolha uma ação.`);
        } else {
            this.logMessage(`Turno de ${player.name}...`);
            setTimeout(() => this.botChooseAction(player), this.getDelay());
        }
    }

    nextTurn() {
        this.state = 'IDLE';
        this.currentTurnIdx = (this.currentTurnIdx + 1) % this.players.length;
        this.startTurn();
    }

    // --- Action Execution ---
    logMessage(msg, className = "") {
        this.log.push({ msg, className });
        if (this.log.length > 20) this.log.shift();
        this.renderLog();
    }

    handleAction(actionId, targetId = null) {
        const player = this.players[this.currentTurnIdx];

        if (player.coins >= 10 && actionId !== ACTIONS.GOLPE) {
            if (player.isHuman) alert("Você tem 10 moedas ou mais. É OBRIGATÓRIO dar um Golpe!");
            return false;
        }

        let actionObj = { type: actionId, source: player, target: targetId ? this.players.find(p=>p.id===targetId) : null, cost: 0 };

        switch (actionId) {
            case ACTIONS.RENDA:
                this.logMessage(`${player.name} pegou Renda (1 Moeda).`);
                player.coins += 1;
                this.treasury -= 1;
                this.updateUI();
                this.nextTurn();
                return true;
            
            case ACTIONS.AJUDA:
                this.logMessage(`${player.name} pediu Ajuda Externa.`);
                this.promptReaction(actionObj, false, [ROLES.DUQUE]); // Can't challenge, can block with Duque
                return true;

            case ACTIONS.GOLPE:
                if (player.coins < 7) {
                    if (player.isHuman) alert("Moedas insuficientes (Custa 7).");
                    return false;
                }
                player.coins -= 7;
                this.treasury += 7;
                this.logMessage(`${player.name} deu um GOLPE de estado em ${actionObj.target.name}!`, "log-alert");
                this.updateUI();
                this.eliminateCardSequence(actionObj.target, () => this.nextTurn());
                return true;
            
            case ACTIONS.DUQUE:
                this.logMessage(`${player.name} declarou Duque (3 Moedas).`);
                this.promptReaction(actionObj, true, []); // Challenge Duque, no block
                return true;

            case ACTIONS.ASSASSINO:
                if (player.coins < 3) {
                    if (player.isHuman) alert("Moedas insuficientes (Custa 3).");
                    return false;
                }
                player.coins -= 3;
                this.treasury += 3;
                this.updateUI();
                this.logMessage(`${player.name} declarou Assassino contra ${actionObj.target.name}.`);
                this.promptReaction(actionObj, true, [ROLES.CONDESSA]); // Challenge Assassino, block Condessa
                return true;

            case ACTIONS.CAPITAO:
                this.logMessage(`${player.name} declarou Capitão contra ${actionObj.target.name}.`);
                this.promptReaction(actionObj, true, [ROLES.CAPITAO, ROLES.EMBAIXADOR]);
                return true;

            case ACTIONS.EMBAIXADOR:
                this.logMessage(`${player.name} declarou Embaixador.`);
                this.promptReaction(actionObj, true, []);
                return true;
        }
    }

    // Reaction Phase (Challenges and Blocks)
    promptReaction(actionObj, canChallenge, blockRoles) {
        this.state = 'AWAITING_REACTION';
        this.pendingAction = actionObj;
        
        let humansToReact = this.activePlayers.filter(p => p.isHuman && p.id !== actionObj.source.id);
        
        // Simulating sequence of reactions: Give a moment, let bots decide, or human decides.
        // For simplicity: We ask human if human is target or if human wants to challenge.
        // Bots will react instantly if they want.
        
        let botReacted = this.simulateBotsReaction(actionObj, canChallenge, blockRoles);
        
        if (botReacted) {
            // A bot reacted. Logic handled in simulate.
        } else if (humansToReact.length > 0) {
            // Ask human
            this.offerHumanReaction(actionObj, canChallenge, blockRoles);
        } else {
            // No one reacts
            this.logMessage("Ninguém contestou ou bloqueou.");
            this.resolveAction(actionObj);
        }
    }

    simulateBotsReaction(actionObj, canChallenge, blockRoles) {
        let bots = this.activePlayers.filter(p => !p.isHuman && p.id !== actionObj.source.id);
        bots = bots.sort(() => Math.random() - 0.5); // Shuffle

        for (let bot of bots) {
            // Random chance to challenge (if allowed) - 15%
            if (canChallenge && Math.random() < 0.15) {
                setTimeout(() => this.executeChallenge(bot, actionObj.source, actionObj), this.getDelay());
                return true;
            }

            // Block if target is bot and has blockRoles
            if (blockRoles.length > 0 && actionObj.target && actionObj.target.id === bot.id) {
                // If bot has the card, 100% block. If not, 20% bluff.
                let hasCard = bot.cards.some(c => !c.dead && blockRoles.includes(c.role));
                if (hasCard || Math.random() < 0.2) {
                    let claimedRole = blockRoles[Math.floor(Math.random() * blockRoles.length)];
                    setTimeout(() => {
                        this.logMessage(`${bot.name} declarou bloqueio usando ${claimedRole}!`, "log-alert");
                        this.promptBlockReaction(bot, actionObj.source, claimedRole, actionObj);
                    }, this.getDelay());
                    return true;
                }
            }
        }
        return false; // No bot reacted
    }

    offerHumanReaction(actionObj, canChallenge, blockRoles) {
        let buttons = [{
            text: "Deixar Passar",
            className: "btn-primary",
            action: () => {
                this.hideModal();
                this.logMessage("Você deixou passar.");
                this.resolveAction(actionObj);
            }
        }];

        if (canChallenge) {
            buttons.push({
                text: "Contestar!",
                className: "btn-danger",
                action: () => {
                    this.hideModal();
                    this.executeChallenge(this.players[0], actionObj.source, actionObj);
                }
            });
        }

        if (blockRoles.length > 0 && actionObj.target && actionObj.target.id === 0) {
            blockRoles.forEach(role => {
                buttons.push({
                    text: `Bloquear com ${role}`,
                    className: "btn-char",
                    action: () => {
                        this.hideModal();
                        this.logMessage(`Você declarou bloqueio com ${role}.`, "log-alert");
                        this.promptBlockReaction(this.players[0], actionObj.source, role, actionObj);
                    }
                });
            });
        }

        let desc = `${actionObj.source.name} usou ${actionObj.type.toUpperCase()}` + (actionObj.target ? ` em ${actionObj.target.name}` : "");
        this.showModal("Ação Declarada", desc, buttons);
    }

    // Reaction to a Block
    promptBlockReaction(blocker, blockTarget, claimedRole, originalAction) {
        // Can only challenge the block.
        if (blockTarget.isHuman) {
            this.showModal("Bloqueio!", `${blocker.name} bloqueou com ${claimedRole}.`, [
                {
                    text: "Aceitar Bloqueio",
                    className: "btn-primary",
                    action: () => {
                        this.hideModal();
                        this.logMessage(`Bloqueio aceito. Ação anulada.`);
                        this.nextTurn();
                    }
                },
                {
                    text: "Contestar Bloqueio!",
                    className: "btn-danger",
                    action: () => {
                        this.hideModal();
                        this.executeChallenge(blockTarget, blocker, originalAction, claimedRole, true);
                    }
                }
            ]);
        } else {
            // Bot decides to challenge block? 15%
            if (Math.random() < 0.15) {
                setTimeout(() => this.executeChallenge(blockTarget, blocker, originalAction, claimedRole, true), this.getDelay());
            } else {
                this.logMessage(`${blockTarget.name} aceitou o bloqueio. Ação anulada.`);
                setTimeout(() => this.nextTurn(), this.getDelay());
            }
        }
    }

    // Execute Challenge
    executeChallenge(challenger, challenged, actionObj, claimedRoleForBlock = null, isBlockChallenge = false) {
        this.state = 'RESOLVING';
        let requiredRoles = [];
        
        if (isBlockChallenge) {
            requiredRoles = [claimedRoleForBlock];
            this.logMessage(`${challenger.name} CONTESTOU o bloqueio de ${challenged.name}!`, "log-alert");
        } else {
            // Determine required role for action
            const map = {
                [ACTIONS.DUQUE]: [ROLES.DUQUE],
                [ACTIONS.ASSASSINO]: [ROLES.ASSASSINO],
                [ACTIONS.CAPITAO]: [ROLES.CAPITAO],
                [ACTIONS.EMBAIXADOR]: [ROLES.EMBAIXADOR]
            };
            requiredRoles = map[actionObj.type];
            this.logMessage(`${challenger.name} CONTESTOU a ação de ${challenged.name}!`, "log-alert");
        }

        // Check if challenged has the card
        let validCardIdx = challenged.cards.findIndex(c => !c.dead && requiredRoles.includes(c.role));

        if (validCardIdx !== -1) {
            // Challenged tells the truth!
            let cardRole = challenged.cards[validCardIdx].role;
            this.logMessage(`${challenged.name} mostrou a carta verdadeira: ${cardRole}! ${challenger.name} perdeu o desafio.`, "log-highlight");
            
            // Swap card
            this.deck.push(cardRole);
            this.shuffleDeck();
            challenged.cards[validCardIdx].role = this.drawCard();
            
            // Challenger loses influence
            this.eliminateCardSequence(challenger, () => {
                if (!isBlockChallenge) {
                    this.resolveAction(actionObj); // Action proceeds
                } else {
                    this.logMessage("O bloqueio é válido. Ação original anulada.");
                    this.nextTurn(); // Block holds
                }
            });

        } else {
            // Challenged lied!
            this.logMessage(`${challenged.name} estava BLEFANDO e perdeu o desafio!`, "log-highlight");
            this.eliminateCardSequence(challenged, () => {
                if (!isBlockChallenge) {
                    this.logMessage("Ação original anulada por blefe.");
                    this.nextTurn(); // Action fails
                } else {
                    this.logMessage("Bloqueio falso. Ação original prossegue.");
                    this.resolveAction(actionObj); // Block fails, action proceeds
                }
            });
        }
    }

    // Resolve successful action
    resolveAction(actionObj) {
        const { type, source, target } = actionObj;
        
        if (!source.cards.some(c => !c.dead)) {
            // Source died during challenge, action lost
            this.nextTurn();
            return;
        }

        switch (type) {
            case ACTIONS.AJUDA:
                source.coins += 2;
                this.treasury -= 2;
                this.updateUI();
                this.nextTurn();
                break;
            case ACTIONS.DUQUE:
                source.coins += 3;
                this.treasury -= 3;
                this.updateUI();
                this.nextTurn();
                break;
            case ACTIONS.ASSASSINO:
                // Target loses life
                this.eliminateCardSequence(target, () => this.nextTurn());
                break;
            case ACTIONS.CAPITAO:
                let stolen = Math.min(2, target.coins);
                target.coins -= stolen;
                source.coins += stolen;
                this.logMessage(`${source.name} roubou ${stolen} moedas de ${target.name}.`);
                this.updateUI();
                this.nextTurn();
                break;
            case ACTIONS.EMBAIXADOR:
                this.executeEmbaixadorSequence(source);
                break;
            default:
                this.nextTurn();
        }
    }

    executeEmbaixadorSequence(player) {
        if (!player.isHuman) {
            // Bot swaps cards (simulate logic: just keep random ALIVE cards)
            this.logMessage(`${player.name} trocou cartas com o baralho.`);
            this.nextTurn();
            return;
        }

        // Human sequence
        let drawn1 = this.drawCard();
        let drawn2 = this.drawCard();
        let currentAlive = player.cards.filter(c => !c.dead).map(c=>c.role);
        let pool = [...currentAlive, drawn1, drawn2];
        
        this.showModal("Embaixador", `Escolha quais ${currentAlive.length} cartas manter.`, pool.map((role, idx) => ({
            text: `Manter ${role}`,
            className: `btn-char role-${role}`,
            action: () => {
                alert(`Funcionalidade do embaixador simplificada na UI.`);
                this.deck.push(drawn1, drawn2);
                this.shuffleDeck();
                this.hideModal();
                this.nextTurn();
            }
        })));
    }

    // Elimination Flow
    eliminateCardSequence(player, callback) {
        if (!player.cards.some(c => !c.dead)) {
            callback();
            return;
        }

        let aliveCount = player.cards.filter(c => !c.dead).length;
        this.logMessage(`${player.name} deve perder uma influência!`, "log-alert");

        if (!player.isHuman) {
            // Bot logic: kill first alive
            let idx = player.cards.findIndex(c => !c.dead);
            player.cards[idx].dead = true;
            this.logMessage(`${player.name} revelou e perdeu um ${player.cards[idx].role}.`);
            this.updateUI();
            callback();
            return;
        }

        if (aliveCount === 1) {
            let idx = player.cards.findIndex(c => !c.dead);
            player.cards[idx].dead = true;
            this.logMessage(`Você revelou e perdeu um ${player.cards[idx].role}. Adeus!`);
            this.updateUI();
            callback();
            return;
        }

        // Show choice modal for Human
        this.showModal("Perdeu Influência!", "Escolha qual carta descartar:", [
            {
                text: `Descartar Carta 1 (Oculta)`,
                className: "btn-danger",
                action: () => {
                    player.cards[0].dead = true;
                    this.logMessage(`Você revelou e perdeu um ${player.cards[0].role}.`);
                    this.hideModal();
                    this.updateUI();
                    callback();
                }
            },
            {
                text: `Descartar Carta 2 (Oculta)`,
                className: "btn-danger",
                action: () => {
                    player.cards[1].dead = true;
                    this.logMessage(`Você revelou e perdeu um ${player.cards[1].role}.`);
                    this.hideModal();
                    this.updateUI();
                    callback();
                }
            }
        ]);
    }

    // Bot Logic AI
    botChooseAction(bot) {
        // Find alive targets
        let validTargets = this.activePlayers.filter(p => p.id !== bot.id);
        let randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];

        if (bot.coins >= 10) {
            this.handleAction(ACTIONS.GOLPE, randomTarget.id);
            return;
        }

        // Simple weights
        let possibleActions = [ACTIONS.RENDA, ACTIONS.AJUDA, ACTIONS.DUQUE, ACTIONS.EMBAIXADOR];
        if (bot.coins >= 3) possibleActions.push(ACTIONS.ASSASSINO);
        if (bot.coins < 10) possibleActions.push(ACTIONS.CAPITAO); // only if not near 10
        if (bot.coins >= 7) possibleActions.push(ACTIONS.GOLPE);

        // Does bot lie?
        let chosenAction = possibleActions[Math.floor(Math.random() * possibleActions.length)];
        this.handleAction(chosenAction, randomTarget ? randomTarget.id : null);
    }

    // --- UI Methods ---
    updateUI() {
        document.getElementById('deck-count').innerText = this.deck.length;
        document.getElementById('treasury-count').innerText = this.treasury;
        
        let pName = this.players[this.currentTurnIdx].name;
        document.getElementById('current-turn-name').innerText = pName;

        this.renderHumanPlayer();
        this.renderBots();
        this.updateActionButtons();
    }

    renderBots() {
        const oppContainer = document.getElementById('opponents');
        oppContainer.innerHTML = '';
        
        this.players.filter(p => !p.isHuman).forEach(bot => {
            let isDead = !bot.cards.some(c => !c.dead);
            let isActive = this.players[this.currentTurnIdx].id === bot.id && !isDead;
            
            let html = `
                <div class="glass-panel bot-panel ${isDead ? 'eliminated' : ''} ${isActive ? 'active-turn' : ''}">
                    <div class="bot-name">${bot.name}</div>
                    <div class="bot-coins">${bot.coins} <div class="coin-icon"></div></div>
                    <div class="bot-cards">
            `;
            
            bot.cards.forEach(c => {
                if (c.dead) {
                    html += `<div class="mini-card revealed role-${c.role}">${c.role.substring(0,2)}</div>`;
                } else {
                    html += `<div class="mini-card">?</div>`;
                }
            });

            html += `</div></div>`;
            oppContainer.innerHTML += html;
        });
    }

    renderHumanPlayer() {
        const human = this.players[0];
        document.getElementById('player-coins').innerText = human.coins;
        
        const cardsContainer = document.getElementById('player-cards');
        cardsContainer.innerHTML = '';
        
        human.cards.forEach((c, idx) => {
            let div = document.createElement('div');
            div.className = `player-card role-${c.role} ${c.dead ? 'dead' : ''}`;
            div.innerHTML = `<div class="card-name">${c.role}</div>`;
            cardsContainer.appendChild(div);
        });
    }

    updateActionButtons() {
        let isHumanTurn = this.players[this.currentTurnIdx].id === 0 && this.state === 'AWAITING_ACTION';
        let human = this.players[0];

        document.querySelectorAll('.btn-action').forEach(btn => {
            btn.disabled = true;
            btn.onclick = null;
        });

        if (isHumanTurn) {
            let forceCoup = human.coins >= 10;

            document.querySelectorAll('.btn-action').forEach(btn => {
                let action = btn.dataset.action;
                
                if (forceCoup && action !== ACTIONS.GOLPE) return; // Must coup
                if (action === ACTIONS.ASSASSINO && human.coins < 3) return; // No money
                if (action === ACTIONS.GOLPE && human.coins < 7) return; // No money

                btn.disabled = false;
                btn.onclick = () => {
                    let needsTarget = [ACTIONS.GOLPE, ACTIONS.ASSASSINO, ACTIONS.CAPITAO].includes(action);
                    if (needsTarget) {
                        this.promptHumanTarget(action);
                    } else {
                        this.handleAction(action);
                    }
                };
            });
        }
    }

    promptHumanTarget(actionType) {
        let targets = this.activePlayers.filter(p => !p.isHuman); // Humans can only target bots in this simulation
        if (targets.length === 0) return; // Should not happen, win condition handled

        this.showModal("Ação Ofensiva", "Selecione o alvo da ação:", targets.map(t => ({
            text: t.name,
            className: "btn-primary",
            action: () => {
                this.hideModal();
                this.handleAction(actionType, t.id);
            }
        })));
    }

    renderLog() {
        const ul = document.getElementById('log-list');
        ul.innerHTML = '';
        this.log.forEach(item => {
            let li = document.createElement('li');
            li.className = item.className;
            li.innerText = item.msg;
            ul.appendChild(li);
        });
        const logBox = document.getElementById('action-log');
        logBox.scrollTop = logBox.scrollHeight;
    }

    // Modal Manager
    showModal(title, desc, buttons) {
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-desc').innerText = desc;
        
        let actionsDiv = document.getElementById('modal-actions');
        actionsDiv.innerHTML = '';
        
        buttons.forEach(btnInfo => {
            let btn = document.createElement('button');
            btn.className = btnInfo.className;
            btn.innerText = btnInfo.text;
            btn.onclick = btnInfo.action;
            actionsDiv.appendChild(btn);
        });
    }

    hideModal() {
        document.getElementById('overlay').classList.add('hidden');
    }
}

// Initialize Game
window.onload = () => {
    window.game = new CoupGame();
};
