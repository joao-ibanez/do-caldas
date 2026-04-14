// Three.js Setup
const container = document.getElementById('game-container');
let scene, camera, renderer;
let pitchObject, yawObject;
let isLocked = false, isGameOver = false, isRoundTransition = false;
let keys = {};
let clock = new THREE.Clock();
let raycaster = new THREE.Raycaster();

// Math Pool (Reduce GC)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _m1 = new THREE.Matrix4();

const UI = {
    roundDisplay: document.getElementById('round-display'),
    scorePlayer: document.getElementById('score-player'),
    scoreBots: document.getElementById('score-bots'),
    crosshair: document.getElementById('crosshair'),
    scopeOverlay: document.getElementById('scope-overlay'),
    lockScreen: document.getElementById('lock-screen'),
    roundOverlay: document.getElementById('round-overlay'),
    roundTitle: document.getElementById('round-title'),
    roundMessage: document.getElementById('round-message'),
    roundTimer: document.getElementById('round-timer'),
    gameOverScreen: document.getElementById('game-over-screen'),
    gameOverTitle: document.getElementById('game-over-title'),
    gameOverMessage: document.getElementById('game-over-message'),
    restartBtn: document.getElementById('restartBtn'),
    damageFlash: document.getElementById('damage-flash'),
    
    // CS HUD v2
    healthTextCS: document.getElementById('health-text-cs'),
    ammoDisplayCS: document.getElementById('ammo-display-cs'),
    weaponNameCS: document.getElementById('weapon-name-cs'),
    weaponNameSlot: null, // legacy compat shim
    ammoCountSlot: null,  // legacy compat shim
    botsAlive: document.getElementById('bots-alive-count'),
    scoreboard: document.getElementById('scoreboard-overlay'),
    playerScoreboardBody: document.getElementById('player-scoreboard-body'),
    botsScoreboardBody: document.getElementById('bots-scoreboard-body'),
    
    // Economy
    moneyDisplay: document.getElementById('money-display'),
    buyMenu: document.getElementById('buy-menu'),
    buyMoney: document.getElementById('buy-money'),
    closeBuyMenu: document.getElementById('close-buy-menu'),
    
    // Main Menu
    startGameBtn: document.getElementById('start-game-btn'),
    volumeControl: document.getElementById('volume-control'),
    volInfo: document.getElementById('vol-info'),
    minimap: document.getElementById('minimap')
};

let roundNumber = 1, playerWins = 0, botWins = 0;
const TOTAL_BOTS = 5;
let minimapBgCanvas = null;

const T_SPAWN = new THREE.Vector3(140, 7.5, 230);
let roundStartTime = 0;
let isFreezeTime = false;
let lastRoundDisplayString = "";

function updateRoundDisplayCache(text, color) {
    if (lastRoundDisplayString !== text) {
        lastRoundDisplayString = text;
        UI.roundDisplay.textContent = text;
        UI.roundDisplay.style.color = color;
    }
}

const DIFFICULTY = {
    EASY: { speed: 0.6, fireRate: 1.5, name: 'Fácil' },
    MEDIUM: { speed: 1.0, fireRate: 1.0, name: 'Médio' },
    HARD: { speed: 1.5, fireRate: 0.6, name: 'Difícil' }
};
let currentDifficulty = DIFFICULTY.MEDIUM;
let masterVolume = 0.5;

// Sound Engine
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
    }
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = masterVolume;
        this.masterGain.connect(this.ctx.destination);
    }
    setVolume(v) {
        masterVolume = v;
        if (this.masterGain) this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
    playShot(type = 'pistol') {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const noise = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        
        // Simple procedural noise for gunshot
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = type === 'sniper' ? 400 : (type === 'rifle' ? 800 : 1500);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        noise.start();
        noise.stop(this.ctx.currentTime + 0.1);
    }
    playClick() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }
    playFootstep() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(60, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
}
const sfx = new SoundEngine();

// Init Engine
scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky
// Fog disabled for performance

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400); // Reduced far plane

renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); 
renderer.setSize(window.innerWidth, window.innerHeight);
// High Quality Shadows Enabled
renderer.shadowMap.enabled = true; 
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.insertBefore(renderer.domElement, container.firstChild);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// Advanced Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)); // Sky/Ground ambient mix

let dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 200, 100);
dirLight.castShadow = true;
// Ultra-HD Shadow Map
dirLight.shadow.mapSize.set(2048, 2048); 
dirLight.shadow.camera.left = -200;
dirLight.shadow.camera.right = 200;
dirLight.shadow.camera.top = 200;
dirLight.shadow.camera.bottom = -200;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.bias = -0.0001; // Fix shadow acne
scene.add(dirLight);

// Realistic Procedural Floor Texture
function createFloorTexture() {
    let canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = '#baa37e'; // Base color
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#a69270';
    ctx.lineWidth = 2;
    for(let i=0; i<512; i+=32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    // Add some noise/specks
    for(let i=0; i<200; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(Math.random()*512, Math.random()*512, 4, 4);
    }
    let tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
}

let floorGeo = new THREE.PlaneGeometry(400, 400); 
let floorMat = new THREE.MeshStandardMaterial({ 
    map: createFloorTexture(),
    roughness: 0.8,
    metalness: 0.1
});
let floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(125, 0, 125);
scene.add(floor);

// Camera / Player Controls
pitchObject = new THREE.Object3D();
pitchObject.add(camera);
yawObject = new THREE.Object3D();
yawObject.position.y = 5; // Eye height
yawObject.add(pitchObject);
scene.add(yawObject);

UI.volumeControl.addEventListener('input', (e) => {
    let v = e.target.value / 100;
    sfx.setVolume(v);
    UI.volInfo.textContent = `${e.target.value}%`;
});

UI.startGameBtn.addEventListener('click', () => {
    sfx.init();
    sfx.playClick();
    startRound();
    document.body.requestPointerLock();
});

document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-diff')) {
        let mode = e.target.id.split('-')[1].toUpperCase();
        currentDifficulty = DIFFICULTY[mode];
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        sfx.playClick();
        return;
    }
    
    if (!isGameOver && !isRoundTransition && !isLocked) {
        document.body.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        isLocked = true;
        UI.lockScreen.classList.add('hidden');
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mousedown', onMouseDown, false);
        document.addEventListener('mouseup', onMouseUp, false);
    } else {
        isLocked = false;
        if (!isGameOver && !isRoundTransition && UI.buyMenu.classList.contains('hidden')) UI.lockScreen.classList.remove('hidden');
        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mousedown', onMouseDown, false);
        document.removeEventListener('mouseup', onMouseUp, false);
        player.isFiring = false;
    }
}, false);

// Buy Menu Controls
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB' && !player.isDead && !isRoundTransition) {
        let elapsed = (Date.now() - roundStartTime) / 1000;
        // Exact Minimap Orange Box (X: 120-180, Z: 210-240)
        let inSpawn = (yawObject.position.x >= 120 && yawObject.position.x <= 180 && yawObject.position.z >= 210 && yawObject.position.z <= 240); 
        if (elapsed > 15 || !inSpawn) {
            UI.moneyDisplay.style.color = "red";
            setTimeout(() => UI.moneyDisplay.style.color = "#4caf50", 500);
            return;
        }
        
        if (!UI.buyMenu.classList.contains('hidden')) {
            UI.buyMenu.classList.add('hidden');
            document.body.requestPointerLock();
        } else {
            if (isLocked) document.exitPointerLock();
            UI.buyMenu.classList.remove('hidden');
            UI.lockScreen.classList.add('hidden');
            UI.buyMoney.textContent = `$${player.money}`;
        }
    }
});

function buyWeapon(w, price) {
    if (player.money >= price) {
        player.money -= price;
        if (w.type === 'grenade') {
            player.inventory.grenade = w;
        } else if (w.id <= 3) { // SHOTGUN, RIFLE, SNIPER
            player.inventory.primary = w;
        } else { // GLOCK, USP, DEAGLE
            player.inventory.secondary = w;
        }
        player.ammo[w.name] = { clip: w.clipSize || 0, reserve: w.reserveSize || 0 };
        changeWeapon(w);
        UI.buyMoney.textContent = `$${player.money}`;
        updateUI();
        sfx.playClick();
    }
}

document.getElementById('buy-shotgun').addEventListener('click', () => buyWeapon(WEAPONS.SHOTGUN, 1200));
document.getElementById('buy-rifle').addEventListener('click', () => buyWeapon(WEAPONS.RIFLE, 2700));
document.getElementById('buy-sniper').addEventListener('click', () => buyWeapon(WEAPONS.SNIPER, 4750));
UI.closeBuyMenu.addEventListener('click', () => {
    UI.buyMenu.classList.add('hidden');
    document.body.requestPointerLock();
});

// New Buy Listeners
document.getElementById('buy-glock').addEventListener('click', () => buyWeapon(WEAPONS.GLOCK, 200));
document.getElementById('buy-usp').addEventListener('click', () => buyWeapon(WEAPONS.USP, 200));
document.getElementById('buy-deagle').addEventListener('click', () => buyWeapon(WEAPONS.DEAGLE, 700));
document.getElementById('buy-he').addEventListener('click', () => buyWeapon(WEAPONS.HE, 300));
document.getElementById('buy-smoke').addEventListener('click', () => buyWeapon(WEAPONS.SMOKE, 300));
document.getElementById('buy-flash').addEventListener('click', () => buyWeapon(WEAPONS.FLASH, 200));

function onMouseMove(e) {
    if (isRoundTransition || isGameOver || player.isDead) return;
    yawObject.rotation.y -= e.movementX * 0.002;
    pitchObject.rotation.x -= e.movementY * 0.002;
    pitchObject.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitchObject.rotation.x));
}

window.addEventListener("contextmenu", e => e.preventDefault());

function onMouseDown(e) { 
    if (e.button === 0) player.isFiring = true; 
    if (e.button === 2 && player.weapon.name === 'Sniper') {
        player.isAiming = !player.isAiming;
        if (player.isAiming) {
            camera.fov = 20;
            camera.updateProjectionMatrix();
            UI.crosshair.classList.add('hidden');
            UI.scopeOverlay.classList.remove('hidden');
            gunContainer.visible = false;
        } else {
            camera.fov = 75;
            camera.updateProjectionMatrix();
            UI.crosshair.classList.remove('hidden');
            UI.scopeOverlay.classList.add('hidden');
            gunContainer.visible = true;
        }
    }
}
function onMouseUp(e) { if (e.button === 0) { player.isFiring = false; player.pistolFired = false; } }

window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Weapons Setup
const WEAPONS = {
    SHOTGUN: { id: 1, name: 'Escopeta', type: 'shotgun', fireRate: 800, damageHead: 150, damageChest: 100, damageLegs: 50, range: 120.0, color: 0x4a3c31, clipSize: 5, reserveSize: 15 },
    RIFLE: { id: 2, name: 'Rifle', type: 'auto', fireRate: 100, damageHead: 150, damageChest: 25, damageLegs: 15, range: 450.0, color: 0x654321, clipSize: 25, reserveSize: 100 },
    SNIPER: { id: 3, name: 'Sniper', type: 'semi', fireRate: 1500, damageHead: 300, damageChest: 150, damageLegs: 80, range: 800.0, color: 0x3b4d3b, clipSize: 5, reserveSize: 20 },
    GLOCK: { id: 4, name: 'Glock-18', type: 'semi', fireRate: 150, damageHead: 100, damageChest: 20, damageLegs: 10, range: 250.0, color: 0x333333, clipSize: 20, reserveSize: 120 },
    USP: { id: 5, name: 'USP-S', type: 'semi', fireRate: 200, damageHead: 100, damageChest: 25, damageLegs: 15, range: 300.0, color: 0x111111, clipSize: 12, reserveSize: 96 },
    DEAGLE: { id: 6, name: 'Desert Eagle', type: 'semi', fireRate: 600, damageHead: 150, damageChest: 55, damageLegs: 30, range: 400.0, color: 0x555555, clipSize: 7, reserveSize: 35 },
    KNIFE: { id: 7, name: 'Faca', type: 'melee', fireRate: 400, damageHead: 100, damageChest: 55, damageLegs: 30, range: 15.0, color: 0xcccccc, clipSize: 0, reserveSize: 0 },
    HE: { id: 8, name: 'HE Grenade', type: 'grenade', fireRate: 1000, color: 0xff0000, clipSize: 1, reserveSize: 0 },
    SMOKE: { id: 9, name: 'Smoke Grenade', type: 'grenade', fireRate: 1000, color: 0xdddddd, clipSize: 1, reserveSize: 0 },
    FLASH: { id: 10, name: 'Flashbang', type: 'grenade', fireRate: 1000, color: 0xeeeeee, clipSize: 1, reserveSize: 0 }
};
const PISTOL = WEAPONS.GLOCK; // Default pistol

// Viewmodel
let viewmodelGroup = new THREE.Object3D();
camera.add(viewmodelGroup);

let gunContainer = new THREE.Group();
viewmodelGroup.add(gunContainer);

let muzzleFlash = new THREE.PointLight(0xffaa00, 0, 15);
muzzleFlash.position.set(0.6, -0.6, -3);
camera.add(muzzleFlash);

let bobTimer = 0;
let tracers = [];
const TRACER_POOL_SIZE = 40;
const tracerPool = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffddaa, transparent: true, opacity: 0.8 });
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0,0,1)]);

for(let i=0; i<TRACER_POOL_SIZE; i++) {
    let line = new THREE.Line(tracerGeo.clone(), tracerMat.clone());
    line.visible = false;
    scene.add(line);
    tracerPool.push({ line, time: 0 });
}

let hitParticles = [];
const PARTICLE_POOL_SIZE = 80;
const particlePool = [];
const PARTICLE_GEO = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const BLOOD_MAT = new THREE.MeshBasicMaterial({color: 0xff0000});
const SPARK_MAT = new THREE.MeshBasicMaterial({color: 0xaaaaaa});

for(let i=0; i<PARTICLE_POOL_SIZE; i++) {
    let p = new THREE.Mesh(PARTICLE_GEO, SPARK_MAT);
    p.visible = false;
    scene.add(p);
    particlePool.push({ mesh: p, velocity: new THREE.Vector3(), life: 0 });
}

let reloadTimeout = null;
let activeGrenades = [];

// Player Logic
let player = {
    speed: 35.0,
    velocity: new THREE.Vector3(),
    canJump: false,
    isWalking: false,
    isCrouched: false,
    health: 100, maxHealth: 100,
    weapon: PISTOL,
    inventory: {
        primary: null,
        secondary: PISTOL,
        melee: WEAPONS.KNIFE,
        grenade: null
    },
    money: 800,
    ammo: {},
    isReloading: false,
    lastFired: 0,
    pistolFired: false,
    isFiring: false,
    isAiming: false,
    kills: 0,
    deaths: 0,
    score: 0,
    damage: 0,
    isDead: false,
    sprayParams: { shots: 0, lastShotTime: 0 }
};

const BOT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]; // Only 5 bots
let botStats = {}; 
function initBotStats() {
    botStats = {};
    BOT_NAMES.forEach(name => {
        botStats[name] = { kills: 0, deaths: 0, score: 0, damage: 0 };
    });
}
initBotStats();

function initAmmo() {
    Object.values(WEAPONS).forEach(w => {
        player.ammo[w.name] = { clip: w.clipSize, reserve: w.reserveSize };
    });
}
initAmmo();

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyR' && !player.isReloading && player.weapon.type !== 'melee') {
        reloadWeapon();
    }
});

function reloadWeapon() {
    let a = player.ammo[player.weapon.name];
    let w = player.weapon;
    if (a.clip === w.clipSize || a.reserve === 0) return;
    
    if (player.isAiming) {
        player.isAiming = false; camera.fov = 75; camera.updateProjectionMatrix();
        UI.crosshair.classList.remove('hidden'); UI.scopeOverlay.classList.add('hidden');
        gunContainer.visible = true;
    }
    
    sfx.playClick();
    player.isReloading = true;
    updateUI();
    
    gunContainer.position.y = -1; // hide down
    reloadTimeout = setTimeout(() => {
        if(player.isDead || isRoundTransition || !player.isReloading) return;
        player.isReloading = false;
        gunContainer.position.y = 0;
        
        let needed = w.clipSize - a.clip;
        if (a.reserve >= needed) {
            a.clip += needed;
            a.reserve -= needed;
        } else {
            a.clip += a.reserve;
            a.reserve = 0;
        }
        updateUI();
        reloadTimeout = null;
    }, 2000); // 2 sec reload
}

function changeWeapon(w) {
    if (player.isReloading) {
        player.isReloading = false;
        if (reloadTimeout) clearTimeout(reloadTimeout);
        reloadTimeout = null;
        gunContainer.position.y = 0;
    }
    if (player.isAiming) {
        player.isAiming = false;
        camera.fov = 75; camera.updateProjectionMatrix();
        UI.crosshair.classList.remove('hidden');
        UI.scopeOverlay.classList.add('hidden');
        gunContainer.visible = true;
    }
    player.weapon = w;
    // UI.weaponName and UI.ammoCount moved to CS HUD — updateUI() handles display
    updateUI();
    
    // Clear old gun
    while(gunContainer.children.length > 0){ 
        gunContainer.remove(gunContainer.children[0]); 
    }
    
    // Build new realistic gun model
    if (w.name === 'Sniper') {
        let stockMat = new THREE.MeshStandardMaterial({color: 0x3b4d3b, roughness: 0.9});
        let metalMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.4, metalness: 0.8});
        let body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 2.5), stockMat);
        body.position.set(0.6, -0.6, -1.0);
        let barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.0, 8), metalMat);
        barrel.rotation.x = Math.PI / 2; barrel.position.set(0.6, -0.45, -2.8);
        let scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), metalMat);
        scope.rotation.x = Math.PI / 2; scope.position.set(0.6, -0.2, -0.8);
        let bipod = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), metalMat);
        bipod.position.set(0.6, -0.8, -2.0); bipod.rotation.z = Math.PI/4;
        let bipod2 = bipod.clone(); bipod2.rotation.z = -Math.PI/4;
        gunContainer.add(body, barrel, scope, bipod, bipod2);
    } else if (w.type === 'shotgun') {
        let stockMat = new THREE.MeshStandardMaterial({color: 0x4a3c31, roughness: 0.8});
        let metalMat = new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.5, metalness: 0.7});
        let stock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 1.0), stockMat);
        stock.position.set(0.6, -0.7, -0.8);
        let rec = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 1.0), metalMat);
        rec.position.set(0.6, -0.6, -1.6);
        let barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), metalMat);
        barrel.rotation.x = Math.PI/2; barrel.position.set(0.6, -0.5, -2.6);
        let pump = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), stockMat);
        pump.rotation.x = Math.PI/2; pump.position.set(0.6, -0.65, -2.3);
        gunContainer.add(stock, rec, barrel, pump);
    } else if (w.name === 'AK-47') {
        let woodMat = new THREE.MeshStandardMaterial({color: 0x5c3a21, roughness: 0.7});
        let metalMat = new THREE.MeshStandardMaterial({color: 0x2b2b2b, roughness: 0.6, metalness: 0.8});
        let stock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.8), woodMat);
        stock.position.set(0.6, -0.8, -0.6); stock.rotation.x = -Math.PI/12;
        let rec = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 1.2), metalMat);
        rec.position.set(0.6, -0.6, -1.4);
        let bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), metalMat);
        bar.rotation.x = Math.PI/2; bar.position.set(0.6, -0.5, -2.4);
        let hg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.6), woodMat);
        hg.position.set(0.6, -0.55, -2.0);
        let mag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.3), metalMat);
        mag.position.set(0.6, -0.9, -1.2); mag.rotation.x = Math.PI/6;
        gunContainer.add(stock, rec, bar, hg, mag);
    } else if (w.type === 'auto') {
        let metalMat = new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.5, metalness: 0.8});
        let greenMat = new THREE.MeshStandardMaterial({color: 0x2d382d, roughness: 0.8});
        let stock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.8), greenMat);
        stock.position.set(0.6, -0.7, -0.8);
        let rec = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 1.2), metalMat);
        rec.position.set(0.6, -0.6, -1.4);
        let bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), metalMat);
        bar.rotation.x = Math.PI/2; bar.position.set(0.6, -0.5, -2.4);
        let scope = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.4), metalMat);
        scope.position.set(0.6, -0.3, -1.3);
        let mag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.3), metalMat);
        mag.position.set(0.6, -0.9, -1.3); mag.rotation.x = Math.PI/12;
        gunContainer.add(stock, rec, bar, scope, mag);
    } else if (w.type === 'melee') {
        let metalMat = new THREE.MeshStandardMaterial({color: 0x99aabb, roughness: 0.3, metalness: 0.9});
        let darkMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.8});
        let handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), darkMat);
        handle.position.set(0.6, -0.6, -1.0); handle.rotation.x = -Math.PI/4;
        let guard = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.1), darkMat);
        guard.position.set(0.6, -0.45, -1.15); guard.rotation.x = -Math.PI/4;
        let blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.8, 0.15), metalMat);
        blade.position.set(0.6, -0.05, -1.55); blade.rotation.x = -Math.PI/4;
        gunContainer.add(handle, guard, blade);
    } else if (w.name === 'Glock-18') {
        let polyMat = new THREE.MeshStandardMaterial({color: 0x181818, roughness: 0.9});
        let metalMat = new THREE.MeshStandardMaterial({color: 0x2a2a2a, roughness: 0.5, metalness: 0.7});
        let grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.25), polyMat);
        grip.position.set(0.6, -0.7, -1.0); grip.rotation.x = -Math.PI/12;
        let slide = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.6), metalMat);
        slide.position.set(0.6, -0.5, -1.2);
        gunContainer.add(grip, slide);
    } else if (w.name === 'USP-S') {
        let polyMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.9});
        let metalMat = new THREE.MeshStandardMaterial({color: 0x1a1a1a, roughness: 0.4, metalness: 0.8});
        let grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.25), polyMat);
        grip.position.set(0.6, -0.7, -1.0); grip.rotation.x = -Math.PI/12;
        let slide = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.6), metalMat);
        slide.position.set(0.6, -0.55, -1.2);
        let sil = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12), new THREE.MeshStandardMaterial({color: 0x050505, roughness: 0.6}));
        sil.position.set(0.6, -0.55, -1.9); sil.rotation.x = Math.PI/2;
        gunContainer.add(grip, slide, sil);
    } else if (w.name === 'Desert Eagle') {
        let gripMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.8});
        let chromMat = new THREE.MeshStandardMaterial({color: 0xdddddd, roughness: 0.2, metalness: 1.0});
        let grip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.3), gripMat);
        grip.position.set(0.6, -0.8, -1.0); grip.rotation.x = -Math.PI/12;
        let slide = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.8), chromMat);
        slide.position.set(0.6, -0.55, -1.3);
        let barrelPart = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), chromMat);
        barrelPart.rotation.x = Math.PI/2; barrelPart.position.set(0.6, -0.5, -1.3);
        gunContainer.add(grip, slide, barrelPart);
    } else if (w.type === 'grenade') {
        let greenMat = new THREE.MeshStandardMaterial({color: w.color, roughness: 0.6, metalness: 0.4});
        let metalMat = new THREE.MeshStandardMaterial({color: 0x222, metalness: 0.8});
        let body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12), greenMat);
        body.position.set(0.6, -0.6, -1.2);
        let pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), metalMat);
        pin.position.set(0.6, -0.3, -1.2);
        gunContainer.add(body, pin);
    } else {
        let fallback = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.6), new THREE.MeshStandardMaterial({color: 0x222222}));
        fallback.position.set(0.6, -0.6, -1.2);
        gunContainer.add(fallback);
    }
    
    // Animate change
    viewmodelGroup.position.y = -1;
    setTimeout(() => viewmodelGroup.position.y = 0, 100);
    gunContainer.children.forEach(c => c.castShadow = true);
}

// Map Dust 2 (25x25) - 0=empty, 1=sand wall, 2=green box, 3=dark door
const mapGrid = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // 00
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // 01
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,1],  // 02 (CT Spawn top-left)
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,1],  // 03
    [1,0,0,0,2,2,2,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,1],  // 04
    [1,0,0,0,2,2,2,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,1],  // 05 
    [1,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,2,2,2,0,0,1],  // 06
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,1],  // 07
    [1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1],  // 08
    [1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1],  // 09
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // 10
    [1,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,1],  // 11
    [1,0,2,2,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,0,2,2,0,1],  // 12 (Mid box cluster)
    [1,0,2,2,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,0,2,2,0,1],  // 13
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // 14
    [1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1],  // 15
    [1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1],  // 16
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // 17
    [1,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,0,2,2,2,0,0,0,1],  // 18
    [1,0,0,2,2,2,0,0,0,1,1,0,0,0,1,1,0,0,2,2,2,0,0,0,1],  // 19
    [1,0,0,2,2,2,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,1],  // 20
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // 21 (T Spawn X:12-17)
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // 22 
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // 23
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]   // 24
];

const mapW = mapGrid[0].length;
const mapH = mapGrid.length;
const gridSize = 10;
let boxes = [];
let instancedWalls = null;

function buildMap() {
    let wallCount = 0;
    for(let z=0; z<mapGrid.length; z++) {
        for(let x=0; x<mapGrid[z].length; x++) {
            if (mapGrid[z][x] > 0) wallCount++;
        }
    }
    
    // Graphics Upgrade: PBR Material & Precise Instanced Colors
    const boxGeo = new THREE.BoxGeometry(gridSize, 10, gridSize);
    const boxMat = new THREE.MeshStandardMaterial({roughness: 0.8, metalness: 0.1}); // Base material
    instancedWalls = new THREE.InstancedMesh(boxGeo, boxMat, wallCount);
    instancedWalls.castShadow = true;
    instancedWalls.receiveShadow = true;
    
    let idx = 0;
    const dummy = new THREE.Object3D();
    const colorWall = new THREE.Color(0xd2b48c); // Sand tan
    const colorBox = new THREE.Color(0x4a5d23); // Military green
    boxes = [];
    const hitGeo1 = new THREE.BoxGeometry(gridSize, 8, gridSize);
    const hitGeo2 = new THREE.BoxGeometry(gridSize, 40, gridSize);
    
    for(let z=0; z<mapGrid.length; z++) {
        for(let x=0; x<mapGrid[z].length; x++) {
            let val = mapGrid[z][x];
            if (val > 0) {
                let h = val === 2 ? 8 : 40; // Boxes vs Outer Walls
                let posX = x * gridSize;
                let posZ = z * gridSize;
                
                dummy.position.set(posX, h/2, posZ);
                dummy.scale.set(1, h/10, 1); 
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(idx, dummy.matrix);
                instancedWalls.setColorAt(idx, val === 2 ? colorBox : colorWall);
                idx++;
                
                let mesh = new THREE.Mesh(val === 2 ? hitGeo1 : hitGeo2);
                mesh.position.set(posX, h/2, posZ);
                mesh.updateMatrixWorld(true);
                boxes.push(mesh);
            }
        }
    }
    
    instancedWalls.instanceMatrix.needsUpdate = true;
    instancedWalls.instanceColor.needsUpdate = true;
    scene.add(instancedWalls);
}
buildMap();

let enemiesObjects = [];

class Enemy3D {
    constructor(x, z) {
        this.group = new THREE.Group();
        this.group.position.set(x, 0, z); // FLOOR
        this.updateFrame = Math.floor(Math.random() * 3); // Stagger updates
        
        // Tactical Vest / Torso
        let bodyGeo = new THREE.BoxGeometry(3.6, 4.0, 2.6);
        let bodyMat = new THREE.MeshStandardMaterial({color: 0x2b2b2b, roughness: 0.9, metalness: 0.1});
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.set(0, 5.5, 0); 
        this.body.name = 'chest';
        
        // Pouches / Gear
        let pouchCol = new THREE.MeshStandardMaterial({color: 0x1f1f1f});
        let pouch1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.6), pouchCol);
        pouch1.position.set(-0.8, -0.5, 1.4);
        let pouch2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.6), pouchCol);
        pouch2.position.set(0.8, -0.5, 1.4);
        let pack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.5, 1.2), new THREE.MeshStandardMaterial({color: 0x222520}));
        pack.position.set(0, 0.2, -1.5);
        this.body.add(pouch1, pouch2, pack);

        // Head and Helmet
        let headGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        let headMat = new THREE.MeshStandardMaterial({color: 0xe0c090, roughness: 0.6});
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.set(0, 8.4, 0); 
        this.head.name = 'head';
        
        let helmet = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 2.0), new THREE.MeshStandardMaterial({color: 0x1a2015, roughness: 0.8, metalness: 0.3}));
        helmet.position.set(0, 0.5, 0);
        this.head.add(helmet);
        
        let visorGeo = new THREE.BoxGeometry(2.1, 0.6, 2.1);
        let visorMat = new THREE.MeshStandardMaterial({color: 0x0a0a0a, roughness: 0.1, metalness: 0.9});
        this.visor = new THREE.Mesh(visorGeo, visorMat);
        this.visor.position.set(0, 8.4, 0.1); 
        this.visor.name = 'head';
        
        // Gun block & Arms
        let armGeo = new THREE.BoxGeometry(0.8, 3.0, 0.8);
        let armMat = new THREE.MeshStandardMaterial({color: 0x2b2b2b});
        let rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(2.4, 6.0, 0.5);
        rightArm.rotation.x = -Math.PI / 3; // Holding gun forwards
        
        // Detailed Gun for Bot
        let eGunGeo = new THREE.BoxGeometry(0.4, 0.6, 4.0);
        let eGunMat = new THREE.MeshStandardMaterial({color: 0x111111, metalness: 0.8, roughness: 0.3});
        this.eGun = new THREE.Mesh(eGunGeo, eGunMat);
        this.eGun.position.set(2.4, 5.0, 2.0); 
        
        let eMag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.5), eGunMat);
        eMag.position.set(2.4, 4.3, 1.5);
        
        // Legs & Boots
        let legGeo = new THREE.BoxGeometry(1.4, 3.5, 1.4);
        let legMat = new THREE.MeshStandardMaterial({color: 0x1a1a1a});
        this.legL = new THREE.Mesh(legGeo, legMat);
        this.legL.position.set(-1.0, 1.75, 0); this.legL.name = 'legs';
        this.legR = new THREE.Mesh(legGeo, legMat);
        this.legR.position.set(1.0, 1.75, 0); this.legR.name = 'legs';
        
        // Knee pads
        let padGeo = new THREE.BoxGeometry(1.6, 1.0, 1.6);
        let padMat = new THREE.MeshStandardMaterial({color: 0x111111});
        let padL = new THREE.Mesh(padGeo, padMat); padL.position.set(0, 0.5, 0);
        this.legL.add(padL);
        let padR = padL.clone();
        this.legR.add(padR);

        this.group.add(this.body, this.head, this.visor, rightArm, this.eGun, eMag, this.legL, this.legR);
        this.group.traverse(c => { if(c.isMesh) c.castShadow = true; });
        
        scene.add(this.group);
        enemiesObjects.push(this);
        
        this.health = 100;
        this.speed = (15 + Math.random() * 5) * currentDifficulty.speed;
        this.lastFired = 0;
        this.fireRate = (800 + Math.random() * 800) * currentDifficulty.fireRate;
        this.flashTime = 0;
        this.lastLOSCheck = 0;
        this.hasLOS = false;
        
        // AI Patrol
        this.patrolTarget = null;
        this.patrolTimer = 0;

        this.name = BOT_NAMES[enemiesObjects.length % BOT_NAMES.length];
        this.stats = botStats[this.name];
    }
    
    takeDamage(amount, attackerIsPlayer = true) {
        if (isRoundTransition) return;
        this.health -= amount;
        if (attackerIsPlayer) player.damage += amount;
        
        this.body.material.color.setHex(0xffffff);
        this.head.material.color.setHex(0xffffff);
        setTimeout(() => { 
            if (this.body) {
                this.body.material.color.setHex(0x3e423a); 
                this.head.material.color.setHex(0x1c1e19);
            }
        }, 100);
        
        if (this.health <= 0) {
            this.stats.deaths++;
            scene.remove(this.group);
            let idx = enemiesObjects.indexOf(this);
            if (idx > -1) {
                enemiesObjects.splice(idx, 1);
                if (attackerIsPlayer) {
                    player.kills++;
                    player.score += 2;
                    player.money += 300;
                }
                updateUI();
                if (enemiesObjects.length === 0) triggerRoundEnd(true);
            }
        }
    }
    
    update(delta) {
        if (player.isDead || isRoundTransition || isFreezeTime) return;
        let dist = this.group.position.distanceTo(yawObject.position);
        if (dist > 150) { // Too far to care about LOS
            this.hasLOS = false;
            return;
        }
        
        let now = Date.now();
        let checkInterval = 250 + (enemiesObjects.indexOf(this) * 50); // Staggered checks
        if (now - this.lastLOSCheck > checkInterval) {
            this.lastLOSCheck = now;
            // Bot eye height 7.9, Target eye height 7.5
            _v1.copy(this.group.position);
            _v1.y = this.group.position.y + 7.9; // Bot height
            _v2.copy(yawObject.position);
            
            _v2.sub(_v1).normalize(); // _v2 now holds the direction
            raycaster.set(_v1, _v2);
            raycaster.far = dist; // check LOS
            let intersects = raycaster.intersectObjects(boxes, false);
            raycaster.far = Infinity; // reset
            
            let previousLOS = this.hasLOS; // Capture previous state before updating
            
            this.hasLOS = true;
            if (intersects.length > 0 && intersects[0].distance < dist - 5) {
                this.hasLOS = false;
            }
            
            // Apply Humanized Reaction Time when spotting the player for the first time
            if (this.hasLOS && !previousLOS) {
                let reactDelay = currentDifficulty === DIFFICULTY.HARD ? 200 : (currentDifficulty === DIFFICULTY.EASY ? 800 : 450);
                this.lastFired = now + reactDelay - this.fireRate; 
                this.consecutiveShots = 0; // reset recoil on new encounter
            }
        }
        
        if (this.hasLOS) {
            this.group.lookAt(yawObject.position.x, this.group.position.y, yawObject.position.z);
            
            if (dist > 30) {
                _v1.set(0,0,1);
                this.group.getWorldQuaternion(_q1);
                _v1.applyQuaternion(_q1).multiplyScalar(this.speed * delta);
                this.group.position.add(_v1);
                if (checkWallCollision(this.group.position, 4)) this.group.position.sub(_v1);
            }
            
            let now = Date.now();
            if (now - this.lastFired > 1000) {
                this.consecutiveShots = 0; // Reset recoil penalty
            }

            if (now - this.lastFired > this.fireRate && dist < 300) {
                this.lastFired = now;
                this.consecutiveShots = (this.consecutiveShots || 0) + 1;
                
                sfx.playShot('rifle'); // Added bot shooting sound
                
                // Recoil & Inaccuracy Calculation
                // Base spread is much higher to prevent laser-accurate first shots
                let spread = 0.08 + (this.consecutiveShots * 0.025);
                if (currentDifficulty === DIFFICULTY.EASY) spread *= 2.0;
                if (currentDifficulty === DIFFICULTY.HARD) spread *= 0.5;
                // Cap maximum spread
                spread = Math.min(spread, 0.25);

                // Calculate aim with spread
                _v1.copy(yawObject.position);
                _v1.y -= 1.0; // Center mass aim
                // Add random spread
                _v1.x += (Math.random() - 0.5) * spread * dist;
                _v1.y += (Math.random() - 0.5) * spread * dist;
                _v1.z += (Math.random() - 0.5) * spread * dist;

                _v2.copy(this.group.position);
                _v2.y += 7.0; // Bot firing height

                let dir = _v3.copy(_v1).sub(_v2).normalize();
                
                // Mathematical check for player collision (abstract Hitbox radius)
                let rayLine = new THREE.Line3(_v2, _v2.clone().add(dir.clone().multiplyScalar(dist + 50)));
                let closestPoint = new THREE.Vector3();
                rayLine.closestPointToPoint(yawObject.position, true, closestPoint);
                
                let distToRay = closestPoint.distanceTo(yawObject.position);
                let playerHit = false;
                
                if (distToRay < 2.0) { // Tighter, more realistic player hitbox radius (was 3.5)
                    playerHit = true;
                    // Lower body hit vs headshot probability
                    let dmg = Math.random() < 0.15 ? 30 : 12; // 15% headshot chance
                    player.takeDamage(dmg, this.name);
                } else {
                    // Missed! Raycast against world map for sparks
                    raycaster.set(_v2, dir);
                    let intersects = raycaster.intersectObjects(boxes, false);
                    if (intersects.length > 0) {
                        createHitEffect(intersects[0].point, 0xaaaaaa);
                    }
                }
                
                // Add tracer effect for Bot bullets
                for(let j=0; j<tracerPool.length; j++) {
                    let t = tracerPool[j];
                    if (Date.now() - t.time > 150) {
                        t.line.visible = true;
                        let posArray = t.line.geometry.attributes.position.array;
                        posArray[0] = _v2.x; posArray[1] = _v2.y; posArray[2] = _v2.z;
                        
                        let endP = playerHit ? closestPoint : _v1; // End point
                        posArray[3] = endP.x; posArray[4] = endP.y; posArray[5] = endP.z;
                        t.line.geometry.attributes.position.needsUpdate = true;
                        t.time = Date.now();
                        t.line.material.opacity = 0.8;
                        break;
                    }
                }
            }
        } else {
            // PATROL LOGIC
            if (!this.patrolTarget || this.group.position.distanceTo(this.patrolTarget) < 5) {
                this.patrolTimer -= delta;
                if (this.patrolTimer <= 0) {
                    this.patrolTarget = new THREE.Vector3(
                        Math.random() * 230 + 10,
                        0,
                        Math.random() * 230 + 10
                    );
                    this.patrolTimer = 2 + Math.random() * 5;
                }
            } else {
                this.group.lookAt(this.patrolTarget.x, this.group.position.y, this.patrolTarget.z);
                _v1.set(0,0,1);
                this.group.getWorldQuaternion(_q1);
                _v1.applyQuaternion(_q1).multiplyScalar(this.speed * 0.7 * delta);
                this.group.position.add(_v1);
                if (checkWallCollision(this.group.position, 4)) {
                    this.group.position.sub(_v1);
                    this.patrolTarget = null; // Immediately pick new target if blocked
                    this.patrolTimer = 0;
                }
            }
        }
    }
}

player.takeDamage = function(amount, attackerName = "Bot") {
    if (this.isDead || isRoundTransition) return;
    this.health -= amount;
    if (this.health < 0) this.health = 0;
    
    if (botStats[attackerName]) botStats[attackerName].damage += amount;

    // Damage Flash
    UI.damageFlash.style.opacity = "1";
    setTimeout(() => UI.damageFlash.style.opacity = "0", 100);
    
    updateUI();
    if (this.health === 0) {
        this.isDead = true;
        this.deaths++;
        if (botStats[attackerName]) {
            botStats[attackerName].kills++;
            botStats[attackerName].score += 2;
        }
        triggerRoundEnd(false);
    }
}

function checkWallCollision(pos, radius) {
    const halfGrid = gridSize / 2;
    // Standard Eye Level is 7.5. Players height range: [pos.y - 7, pos.y + 0.5]
    // Walls are at y=0, height 40 (outer) or 8 (boxes)
    const pMinY = pos.y - 7.0;
    const pMaxY = pos.y + 0.5;

    let minGX = Math.floor((pos.x - radius + halfGrid) / gridSize);
    let maxGX = Math.floor((pos.x + radius + halfGrid) / gridSize);
    let minGZ = Math.floor((pos.z - radius + halfGrid) / gridSize);
    let maxGZ = Math.floor((pos.z + radius + halfGrid) / gridSize);

    for (let gz = minGZ; gz <= maxGZ; gz++) {
        for (let gx = minGX; gx <= maxGX; gx++) {
            if (gz >= 0 && gz < mapGrid.length && gx >= 0 && gx < mapGrid[gz].length) {
                const val = mapGrid[gz][gx];
                if (val > 0) {
                    const wallHeight = (val === 2) ? 8 : (val === 3 ? 40 : 40); // 2: Box (8), 1/3: Wall/Door (40)
                    // Check horizontal overlap (already handled by grid loop) and vertical overlap
                    if (pMaxY > 0 && pMinY < wallHeight) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

// Get floor height at a specific position (Optimized)
function getFloorHeight(pos) {
    let gx = Math.floor((pos.x + gridSize / 2) / gridSize);
    let gz = Math.floor((pos.z + gridSize / 2) / gridSize);
    if (gz >= 0 && gz < mapGrid.length && gx >= 0 && gx < mapGrid[gz].length) {
        if (mapGrid[gz][gx] === 2) return 8; // If it's a box (val 2), floor is 8
    }
    return 0;
}

function createHitEffect(pos, colorHex) {
    let count = 0;
    let mat = colorHex === 0xff0000 ? BLOOD_MAT : SPARK_MAT;
    for(let i=0; i<particlePool.length && count < 4; i++) {
        let p = particlePool[i];
        if (p.life <= 0) {
            p.mesh.visible = true;
            p.mesh.material = mat;
            p.mesh.position.copy(pos);
            p.velocity.set((Math.random()-0.5)*10, Math.random()*15, (Math.random()-0.5)*10);
            p.life = 1.0;
            count++;
        }
    }
}

function fire() {
    if (player.isReloading) return;
    let now = Date.now();
    if (now - player.lastFired < player.weapon.fireRate) return;
    if (player.weapon.type === 'semi' && player.pistolFired) return;
    
    let a = player.ammo[player.weapon.name];
    if (player.weapon.type !== 'melee') {
        if (a.clip <= 0) { reloadWeapon(); return; }
        a.clip--;
        updateUI();
    }
    
    if (player.weapon.type === 'semi') player.pistolFired = true;
    player.lastFired = now;
    
    if (player.weapon.type === 'grenade') {
        throwGrenade(player.weapon);
        return;
    }
    
    // Play Procedural Sound
    sfx.playShot(player.weapon.type === 'auto' ? 'rifle' : (player.weapon.name === 'Sniper' ? 'sniper' : 'pistol'));
    
    if (player.weapon.type === 'melee') {
        // Bayonet Stab Animation - No camera recoil
        gunContainer.position.z -= 0.6; // move forward
        gunContainer.rotation.x -= 0.2; // thrust down slightly
        setTimeout(() => { gunContainer.position.z += 0.6; gunContainer.rotation.x += 0.2; }, 100);
    } else {
        if (player.weapon.name === 'Pistola') {
            muzzleFlash.intensity = 0.5; // Suppressed flash
        } else {
            muzzleFlash.intensity = 3;
        }
        setTimeout(() => muzzleFlash.intensity = 0, 50);
        
        // Removed artificial random recoil to guarantee 100% precision
        pitchObject.rotation.x += 0.001; 
        if (pitchObject.rotation.x > Math.PI/2) pitchObject.rotation.x = Math.PI/2;
        
        // Viewmodel Recoil (Muzzle pulls UP and back to screen)
        gunContainer.rotation.x = 0.15; // Positive X rotates muzzle UP
        gunContainer.position.z += 0.3; // Kick back to screen
        setTimeout(() => { gunContainer.rotation.x = 0; gunContainer.position.z -= 0.3; }, 80);
    }
    
    // CS SPRAY PATTERN E INACCURACY CALCULATION
    player.sprayParams.shots++;
    player.sprayParams.lastShotTime = now;
    
    let baseAccX = 0, baseAccY = 0;
    
    if (player.weapon.type === 'auto') {
        let sp = Math.min(player.sprayParams.shots / 25, 1.0); // full spray
        baseAccY = sp * 0.03; // Massively buffed Spray Pattern (Laser focus)
        baseAccX = Math.sin(sp * Math.PI * 4) * 0.01; // Less hook
    }
    
    // Movement Inaccuracy Bloom (Radically Buffed)
    let bloom = player.isCrouched ? 0.0 : (player.isWalking ? 0.001 : (player.velocity.length() > 2 ? 0.015 : 0.0));
    if (player.weapon.type === 'shotgun') bloom = 0.05; 
    else if (player.weapon.name === 'Sniper' && player.velocity.length() > 2) bloom = 0.08; 
    
    if (player.weapon.name === 'Sniper' && !player.isAiming) bloom += 0.05; 
    
    // Hit Particle System (Optimized Pooling)
    let bullets = player.weapon.type === 'shotgun' ? 6 : 1;
    let hitEnemy = null;
    let hitPartName = '';
    let hitDistance = 0;
    
    for(let i=0; i<bullets; i++) {
        // Laser Accuracy: Bullet always goes exactly where the camera points (including pitch/recoil)
        _v1.set(0,0,0); // dir
        camera.getWorldDirection(_v1);
        
        _v2.set(0,0,0); // raycastPos
        camera.getWorldPosition(_v2);
        raycaster.set(_v2, _v1);
        
        let targets = [...boxes];
        enemiesObjects.forEach(e => { targets.push(e.body, e.head, e.visor, e.legL, e.legR); });
        
        let intersects = raycaster.intersectObjects(targets, false);
        
        _v3.copy(_v2).add(_v1.clone().multiplyScalar(player.weapon.range)); // endPoint
        
        if (intersects.length > 0 && intersects[0].distance <= player.weapon.range) {
            _v3.copy(intersects[0].point); // endPoint
            let hitObj = intersects[0].object;
            let hitBot = false;
            for(let e of enemiesObjects) {
                if (e.body === hitObj || e.head === hitObj || e.visor === hitObj || e.legL === hitObj || e.legR === hitObj) {
                    hitEnemy = e; 
                    hitPartName = hitObj.name;
                    hitDistance = intersects[0].distance;
                    hitBot = true;
                    break;
                }
            }
            createHitEffect(intersects[0].point, hitBot ? 0xff0000 : 0xaaaaaa);
        }
        
        // Draw Tracer from Pool
        for(let j=0; j<tracerPool.length; j++) {
            let t = tracerPool[j];
            if (Date.now() - t.time > 150) { // reuse oldest or available
                t.line.visible = true;
                _v2.set(0,0,0); muzzleFlash.getWorldPosition(_v2);
                let posArray = t.line.geometry.attributes.position.array;
                posArray[0] = _v2.x; posArray[1] = _v2.y; posArray[2] = _v2.z;
                posArray[3] = _v3.x; posArray[4] = _v3.y; posArray[5] = _v3.z;
                t.line.geometry.attributes.position.needsUpdate = true;
                t.time = Date.now();
                t.line.material.opacity = 0.8;
                break;
            }
        }
    }
    
    if (hitEnemy) {
        UI.crosshair.style.color = "red";
        UI.crosshair.style.textShadow = "0 0 10px red";
        setTimeout(() => {
            UI.crosshair.style.color = "rgba(0,255,0,0.8)";
            UI.crosshair.style.textShadow = "1px 1px 2px #000";
        }, 150);
        
        let dmg = 25; // Standard body damage
        if (hitPartName === 'head') {
            dmg = 100; // Fatal headshot
        } else if (hitPartName === 'legs') {
            dmg = 15;
        }
        hitEnemy.takeDamage(dmg, true);
    }
}

function throwGrenade(type) {
    sfx.playClick(); // Sound feedback for throw
    let geo = new THREE.SphereGeometry(0.5, 16, 16);
    let mat = new THREE.MeshPhongMaterial({color: type.color});
    let nade = new THREE.Mesh(geo, mat);
    nade.position.copy(yawObject.position);
    nade.position.y -= 1; // From hand height
    
    _v1.set(0,0,0); // dir
    camera.getWorldDirection(_v1);
    nade.velocity = _v1.multiplyScalar(50).add(new THREE.Vector3(0, 15, 0)); // Better arc
    nade.type = type.name;
    nade.timer = type.name.includes('Smoke') ? 3.0 : 2.5; 
    
    scene.add(nade);
    activeGrenades.push(nade);
    
    // Consume grenade
    player.inventory.grenade = null;
    changeWeapon(player.inventory.secondary);
}

function updateGrenades(delta) {
    for (let i = activeGrenades.length - 1; i >= 0; i--) {
        let g = activeGrenades[i];
        g.velocity.y -= 80 * delta; // Gravity
        g.position.add(g.velocity.clone().multiplyScalar(delta));
        g.timer -= delta;
        
        // Bounce on floor and boxes
        let floorY = getFloorHeight(g.position);
        if (g.position.y < floorY + 0.3) {
            g.position.y = floorY + 0.3;
            g.velocity.y *= -0.4;
            g.velocity.x *= 0.8;
            g.velocity.z *= 0.8;
        }
        
        if (g.timer <= 0) {
            // EXPLODE/EFFECT
            if (g.type.includes('HE')) {
                // HE Explosion Effect
                createHitEffect(g.position, 0xffaa00);
                createHitEffect(g.position, 0xff0000);
                
                // Explosion Flash
                let flash = new THREE.PointLight(0xffaa00, 5, 20);
                flash.position.copy(g.position);
                scene.add(flash);
                setTimeout(() => scene.remove(flash), 100);
                createHitEffect(g.position.clone().add(new THREE.Vector3(2,2,2)), 0xff5500);
                createHitEffect(g.position.clone().add(new THREE.Vector3(-2,0,-2)), 0xff5500);
                
                // Area Damage
                enemiesObjects.forEach(e => {
                    let d = e.group.position.distanceTo(g.position);
                    if (d < 40) e.takeDamage(100 - d * 2, true);
                });
                
                // Sound
                sfx.playShot('sniper'); // Loud boom
            } else if (g.type.includes('Smoke')) {
                // Tactical Smoke Cloud
                let sGeo = new THREE.SphereGeometry(18, 16, 16);
                let sMat = new THREE.MeshBasicMaterial({
                    color: 0x999999, 
                    transparent: true, 
                    opacity: 0.8,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
                let smoke = new THREE.Mesh(sGeo, sMat);
                smoke.position.copy(g.position);
                scene.add(smoke);
                
                // Fade out and remove
                setTimeout(() => {
                    let fade = setInterval(() => {
                        smoke.material.opacity -= 0.05;
                        if (smoke.material.opacity <= 0) {
                            clearInterval(fade);
                            scene.remove(smoke);
                        }
                    }, 100);
                }, 12000);
            } else if (g.type.includes('Flash')) {
                // Flashbang Effect
                let d = yawObject.position.distanceTo(g.position);
                if (d < 120) {
                    UI.damageFlash.style.transition = "none";
                    UI.damageFlash.style.backgroundColor = "white";
                    UI.damageFlash.style.opacity = "1";
                    
                    setTimeout(() => {
                        UI.damageFlash.style.transition = "opacity 3s ease-in";
                        UI.damageFlash.style.opacity = "0";
                        setTimeout(() => {
                            UI.damageFlash.style.backgroundColor = "rgba(255,0,0,0.4)";
                            UI.damageFlash.style.transition = "opacity 0.1s";
                        }, 3100);
                    }, 500);
                }
            }
            scene.remove(g);
            activeGrenades.splice(i, 1);
        }
    }
}

function updateUI() {
    UI.healthTextCS.textContent = Math.ceil(player.health);
    // CS Green for health (standard is white, green when high?)
    UI.healthTextCS.style.color = player.health > 20 ? "#fff" : "#e94560";

    UI.botsAlive.textContent = `${enemiesObjects.length} VIVOS`;
    // UI.roundDisplay.textContent is handled by updateRoundDisplayCache in animate()
    UI.scorePlayer.textContent = playerWins;
    UI.scoreBots.textContent = botWins;
    UI.moneyDisplay.textContent = player.money;
    
    if(player.weapon.type === 'melee') {
        UI.ammoDisplayCS.textContent = '-';
    } else if (player.isReloading) {
        UI.ammoDisplayCS.textContent = '...';
    } else {
        if(player.ammo[player.weapon.name]) {
            let a = player.ammo[player.weapon.name];
            UI.ammoDisplayCS.textContent = `${a.clip} / ${a.reserve}`;
        }
    }
    UI.weaponNameCS.textContent = player.weapon.name;
    updateInventoryUI();
}

function updateInventoryUI() {
    const slots = [
        { id: 'slot-1', weapon: player.inventory.primary },
        { id: 'slot-2', weapon: player.inventory.secondary },
        { id: 'slot-3', weapon: player.inventory.melee },
        { id: 'slot-4', weapon: player.inventory.grenade }
    ];
    
    slots.forEach(s => {
        let el = document.getElementById(s.id);
        if (!el) return;
        let nameEl = el.querySelector('.slot-name');
        if (s.weapon) {
            nameEl.textContent = s.weapon.name;
            el.classList.remove('hidden');
            if (player.weapon.name === s.weapon.name) el.classList.add('active');
            else el.classList.remove('active');
        } else {
            nameEl.textContent = '---';
            if (s.id === 'slot-1' || s.id === 'slot-4') el.classList.add('hidden'); // Hide empty primary/utility
            else el.classList.remove('active');
        }
    });
}

function updateScoreboard() {
    const pRow = `
        <tr class="row-player">
            <td>VOCÊ (T)</td>
            <td>${player.kills}</td>
            <td>${player.deaths}</td>
            <td>${Math.floor(player.damage)}</td>
            <td>${player.score}</td>
        </tr>
    `;
    UI.playerScoreboardBody.innerHTML = pRow;
    
    let bots = [];
    Object.keys(botStats).forEach(name => {
        let s = botStats[name];
        bots.push({ name: name, kills: s.kills, deaths: s.deaths, damage: s.damage, score: s.score });
    });
    bots.sort((a, b) => b.score - a.score);
    
    UI.botsScoreboardBody.innerHTML = bots.map(b => `
        <tr class="row-bot">
            <td>${b.name} (CT)</td>
            <td>${b.kills}</td>
            <td>${b.deaths}</td>
            <td>${Math.floor(b.damage)}</td>
            <td>${b.score}</td>
        </tr>
    `).join('');
}

function startRound() {
    isRoundTransition = false;
    UI.roundOverlay.classList.add('hidden');
    
    // Perda de arma caso tenha morrido no round anterior (Regra padrão do CS)
    if (player.isDead) {
        player.inventory.primary = null;
        player.inventory.secondary = WEAPONS.GLOCK;
        player.inventory.grenade = null;
        initAmmo(); // Reseta os pentes
        changeWeapon(WEAPONS.GLOCK);
    }
    
    // T Spawn - Eye Level 7.5 (Bottom-Right area)
    yawObject.position.copy(T_SPAWN);
    yawObject.rotation.y = Math.PI; // Look North
    pitchObject.rotation.x = 0;
    player.velocity.set(0,0,0);
    
    player.health = 100;
    player.isDead = false;
    
    enemiesObjects.forEach(e => scene.remove(e.group));
    enemiesObjects = [];
    
    // Spawn Bots safely in CT Base area (Northeast)
    for (let i = 0; i < TOTAL_BOTS; i++) {
        let bx, bz, attempts = 0;
        do {
            bx = (2 + Math.random() * 8) * gridSize; 
            bz = (2 + Math.random() * 8) * gridSize;
            attempts++;
        } while (checkWallCollision(new THREE.Vector3(bx, 7.5, bz), 5) && attempts < 50);
        new Enemy3D(bx, bz);
    }
    
    roundStartTime = Date.now();
    isFreezeTime = true;
    updateUI();
}

function drawMinimap() {
    if (!UI.minimap) return;
    const ctx = UI.minimap.getContext('2d');
    const size = 160;
    const scale = size / 250;
    
    // Create background cache once
    if (!minimapBgCanvas) {
        minimapBgCanvas = document.createElement('canvas');
        minimapBgCanvas.width = size;
        minimapBgCanvas.height = size;
        const bgCtx = minimapBgCanvas.getContext('2d');
        
        // Draw Bases
        bgCtx.fillStyle = 'rgba(0, 0, 255, 0.3)'; // CT
        bgCtx.fillRect(2 * gridSize * scale, 2 * gridSize * scale, 8 * gridSize * scale, 8 * gridSize * scale);
        bgCtx.fillStyle = 'rgba(255, 165, 0, 0.3)'; // T
        bgCtx.fillRect(12 * gridSize * scale, 21 * gridSize * scale, 6 * gridSize * scale, 3 * gridSize * scale);
        
        // Draw Walls
        bgCtx.fillStyle = '#444';
        for(let z=0; z<mapGrid.length; z++) {
            for(let x=0; x<mapGrid[z].length; x++) {
                if (mapGrid[z][x] > 0) {
                    bgCtx.fillRect(x * 10 * scale, z * 10 * scale, 10 * scale, 10 * scale);
                }
            }
        }
    }
    
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(minimapBgCanvas, 0, 0);
    
    // Draw Player
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(yawObject.position.x * scale, yawObject.position.z * scale, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw Bots (Only when firing/noise)
    let now = Date.now();
    enemiesObjects.forEach(e => {
        if (now - e.lastFired < 2000) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(e.group.position.x * scale, e.group.position.z * scale, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(e.group.position.x * scale, e.group.position.z * scale, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

function triggerRoundEnd(playerWon) {
    if (isRoundTransition) return;
    isRoundTransition = true;
    
    if (playerWon) {
        playerWins++;
        player.money += 3250;
        UI.roundTitle.textContent = "Round Vitória!";
        UI.roundTitle.style.color = "#4caf50";
    } else {
        botWins++;
        player.money += 1400;
        UI.roundTitle.textContent = "Round Derrota!";
        UI.roundTitle.style.color = "#e94560";
    }
    
    updateUI();
    
    if (roundNumber >= 5) {
        isGameOver = true;
        let winner = playerWins > botWins ? "VOCÊ VENCEU A PARTIDA!" : "BOTS VENCERAM A PARTIDA!";
        if (UI.gameOverTitle) UI.gameOverTitle.textContent = winner;
        UI.gameOverScreen.classList.remove('hidden');
        if (document.pointerLockElement) document.exitPointerLock();
        return;
    }

    UI.roundOverlay.classList.remove('hidden');
    
    let time = 5;
    UI.roundTimer.textContent = `Próximo round em ${time}s...`;
    
    let timer = setInterval(() => {
        time--;
        if (time <= 0) {
            clearInterval(timer);
            roundNumber++;
            startRound();
        } else {
            UI.roundTimer.textContent = `Próximo round em ${time}s...`;
        }
    }, 1000);
}

    let frameCount = 0;
    function animate() {
        requestAnimationFrame(animate);
        frameCount++;
        let delta = clock.getDelta();
    if (delta > 0.1) delta = 0.1;
    
    if (!isGameOver && !isRoundTransition && !player.isDead) { // Update HUD regardless of pointer lock
        if (isFreezeTime) {
            let elapsed = (Date.now() - roundStartTime) / 1000;
            let left = Math.ceil(10 - elapsed);
            if (left <= 0) {
                isFreezeTime = false;
                sfx.playClick();
            } else {
                updateRoundDisplayCache(`AÇÃO EM ${left}s`, '#e94560');
            }
        } else {
            let elapsed = (Date.now() - roundStartTime) / 1000;
            // Exact Minimap Orange Box (X: 120-180, Z: 210-240)
            let inSpawn = (yawObject.position.x >= 120 && yawObject.position.x <= 180 && yawObject.position.z >= 210 && yawObject.position.z <= 240);
            if (elapsed < 15 && inSpawn) {
                let leftBuy = Math.ceil(15 - elapsed);
                updateRoundDisplayCache(`LOJA: ${leftBuy}s`, '#4caf50');
            } else {
                updateRoundDisplayCache(`ROUND ${roundNumber}`, '#aaa');
                
                // Auto close buy menu if time expired
                if (!UI.buyMenu.classList.contains('hidden')) {
                    UI.buyMenu.classList.add('hidden');
                    if (!isLocked && !isGameOver && !isRoundTransition && !player.isDead) {
                        UI.lockScreen.innerHTML = "<h2>TEMPO COMPRA ESGOTADO</h2><p>Clique para voltar ao combate</p>";
                        UI.lockScreen.classList.remove('hidden');
                    }
                }
            }
        }
    }
    
    if (!isGameOver && !isRoundTransition && isLocked && !player.isDead) {
        // Movement
        player.isWalking = keys['ShiftLeft'] || keys['ShiftRight'];
        player.isCrouched = keys['ControlLeft'] || keys['ControlRight'];
        
        let cSpeed = player.speed;
        let targetY = 7.5; // CS Eye height
        
        if (player.isCrouched) {
            cSpeed = player.speed * 0.4;
            targetY = 4.0; // Crouched CS Eye height
        } else if (player.isWalking) {
            cSpeed = player.speed * 0.5;
        }
        
        if (isFreezeTime) {
            cSpeed = 0;
            player.canJump = false;
            player.isFiring = false;
        }
        
        _v1.set(0,0,0); // dir
        if (keys['KeyW'] || keys['ArrowUp']) _v1.z -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) _v1.z += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) _v1.x -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) _v1.x += 1;
        _v1.normalize();
        
        let moveX = _v1.x * cSpeed * delta;
        let moveZ = _v1.z * cSpeed * delta;
        
        if (moveX !== 0 || moveZ !== 0) {
            _v2.set(moveX, 0, moveZ); // forward
            _v2.applyAxisAngle(_v3.set(0,1,0), yawObject.rotation.y);
            
            yawObject.position.x += _v2.x;
            if (checkWallCollision(yawObject.position, 2)) yawObject.position.x -= _v2.x;
            
            yawObject.position.z += _v2.z;
            if (checkWallCollision(yawObject.position, 2)) yawObject.position.z -= _v2.z;
            
            bobTimer += delta * 10;
            viewmodelGroup.position.x = Math.sin(bobTimer) * 0.1;
            viewmodelGroup.position.y = Math.abs(Math.cos(bobTimer)) * 0.1;
        } else {
            bobTimer = 0;
            viewmodelGroup.position.x = 0;
            viewmodelGroup.position.y = 0;
        }
        
        // Jumping
        if (keys['Space'] && player.canJump && !player.isCrouched) {
            player.velocity.y = 35.0; // Jump force
            player.canJump = false;
        }

        // PHYSICS: Gravity and Landing
        let floorHeight = getFloorHeight(yawObject.position);
        let actualTargetY = floorHeight + targetY; // targetY is 7.5 (standard) or 4.5 (crouch)
        
        yawObject.position.y += player.velocity.y * delta;
        
        if (yawObject.position.y <= actualTargetY) {
            player.velocity.y = 0;
            yawObject.position.y = actualTargetY;
            player.canJump = true;
        } else {
            player.velocity.y -= 80 * delta; // Gravity
            player.canJump = false;
        }
        
        // Smoothly stand up if below ceiling
        if (yawObject.position.y < targetY && player.canJump) {
            yawObject.position.y += 10.0 * delta;
            if (yawObject.position.y > targetY) yawObject.position.y = targetY;
        }
        
        // Recover spray dynamically
        if (Date.now() - player.sprayParams.lastShotTime > 300 && !player.isFiring) {
            player.sprayParams.shots = 0;
        }
        
        // Scoreboard Toggle
        if (keys['Tab']) {
            UI.scoreboard.classList.remove('hidden');
            updateScoreboard();
        } else {
            UI.scoreboard.classList.add('hidden');
        }
        
        // Slots Inventory Logic
        if (keys['Digit1'] && player.inventory.primary && player.weapon !== player.inventory.primary) changeWeapon(player.inventory.primary);
        if (keys['Digit2'] && player.weapon !== player.inventory.secondary) changeWeapon(player.inventory.secondary);
        if (keys['Digit3'] && player.weapon !== player.inventory.melee) changeWeapon(player.inventory.melee);
        if (keys['Digit4'] && player.inventory.grenade && player.weapon !== player.inventory.grenade) changeWeapon(player.inventory.grenade);
        
        if (player.isFiring) fire();
        
        // Footsteps
        if (player.canJump && (moveX !== 0 || moveZ !== 0) && !player.isCrouched) {
            player.footstepTimer = (player.footstepTimer || 0) + delta;
            let interval = player.isWalking ? 0.6 : 0.4;
            if (player.footstepTimer > interval) {
                sfx.playFootstep();
                player.footstepTimer = 0;
            }
        }
        
        updateGrenades(delta);
        if (frameCount % 4 === 0) drawMinimap();
        
        // Update Tracers from Pool
        for (let t of tracerPool) {
            if (!t.line.visible) continue;
            let elapsed = Date.now() - t.time;
            if (elapsed > 100) {
                t.line.visible = false;
            } else {
                t.line.material.opacity = 0.8 * (1 - elapsed / 100);
            }
        }
        
        // Update Hit Particles from Pool
        for (let p of particlePool) {
            if (p.life <= 0) continue;
            p.mesh.position.add(_v4.copy(p.velocity).multiplyScalar(delta));
            p.velocity.y -= 40 * delta; 
            p.life -= delta * 4;
            if (p.life <= 0) {
                p.mesh.visible = false;
            } else {
                p.mesh.scale.setScalar(p.life);
            }
        }
    }
    
    enemiesObjects.forEach(e => {
        if (frameCount % 3 === e.updateFrame) e.update(delta * 3);
    });
    renderer.render(scene, camera);
}

UI.restartBtn.addEventListener('click', () => {
    roundNumber = 1; playerWins = 0; botWins = 0;
    isGameOver = false; player.kills = 0; player.deaths = 0; player.score = 0;
    initBotStats();
    player.money = 800;
    player.inventory.primary = null;
    player.inventory.grenade = null;
    initAmmo();
    UI.gameOverScreen.classList.add('hidden');
    changeWeapon(WEAPONS.GLOCK);
    startRound();
    setTimeout(() => document.body.requestPointerLock(), 100);
});

changeWeapon(PISTOL);
// NO startRound() here anymore
animate();
