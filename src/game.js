import {
    GAME_TITLE,
    FIREBASE_CONFIG,
    BIRD_IMAGE_PATH,
    BIRD_PASS_IMAGE_PATH,
    BIRD_HIT_IMAGE_PATH,
    FLAP_SOUND_PATH,
    OUT_SOUND_PATH,
    PASS_SOUND_PATH,
    PIPE_GAP,
    PIPE_SPACING_DISTANCE,
    BIRD_WIDTH,
    BIRD_HEIGHT,
    PIPE_WIDTH,
    GRAVITY,
    FLAP_STRENGTH,
    SPEED,
    GROUND_HEIGHT,
    CLOUD_SPEED,
    PARALLAX_FAR_SPEED,
    PARALLAX_MID_SPEED,
    MAX_PARTICLES,
    PRESENCE_HEARTBEAT_MS,
    PRESENCE_TIMEOUT_MS
} from './config.js';
import { clamp, computeTimeScale, updateCameraState } from './physics.js';
import { drawRoundedRect, ensureRenderCache } from './render.js';
import { ParticleSystem } from './particles.js';
import {
    createBackgroundState,
    initBackgroundState,
    updateBackgroundState,
    drawBackgroundState
} from './background.js';

export function createTextUpdater(element) {
    let lastValue = element ? element.textContent : '';

    return function updateText(value) {
        if (!element) {
            return;
        }

        const nextValue = String(value);
        if (nextValue !== lastValue) {
            element.textContent = nextValue;
            lastValue = nextValue;
        }
    };
}

export function shouldSpawnPipeDistance(lastPipeX, canvasWidth, spacingDistance) {
    return typeof lastPipeX !== 'number' || lastPipeX < canvasWidth - spacingDistance;
}

export function getNextPipeX(lastPipeX, canvasWidth, spacingDistance) {
    return typeof lastPipeX !== 'number'
        ? canvasWidth
        : lastPipeX + spacingDistance;
}

export function configureCanvasSize(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.logicalWidth = rect.width;
    canvas.logicalHeight = rect.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    return {
        dpr,
        width: rect.width,
        height: rect.height
    };
}

export function ensureImageAsset(asset, src) {
    if (asset || !src) {
        return asset;
    }

    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    return image;
}

export function ensureAudioAsset(asset, src) {
    if (asset || !src) {
        return asset;
    }

    const audio = new Audio();
    audio.preload = 'none';
    audio.src = src;
    return audio;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash &= hash;
    }
    return Math.abs(hash).toString(36);
}

export function initGame({ firebaseApi = window.firebase, toneApi = window.Tone } = {}) {
    if (window.__flappyGameInitialized) {
        return window.__flappyGameApi || null;
    }

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    const nameEntryScreen = document.getElementById('nameEntryScreen');
    const playerNameInput = document.getElementById('playerNameInput');
    const saveNameButton = document.getElementById('saveNameButton');
    const changeNameButton = document.getElementById('changeNameButton');

    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');

    const scoreDisplay = document.getElementById('scoreDisplay');
    const finalScore = document.getElementById('finalScore');
    const highScoreDisplay = document.getElementById('highScore');
    const playerNameDisplay = document.getElementById('playerNameDisplay');
    const currentPlayerName = document.getElementById('currentPlayerName');
    const leaderboardList = document.getElementById('leaderboardList');
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    const clearBtn = document.getElementById('clearLeaderboardBtn');
    const gameTitle = document.getElementById('gameTitle');
    const activePlayersCount = document.getElementById('activePlayersCount');
    const setScoreDisplayText = createTextUpdater(scoreDisplay);

    if (
        !canvas
        || !ctx
        || !nameEntryScreen
        || !playerNameInput
        || !saveNameButton
        || !changeNameButton
        || !startScreen
        || !gameOverScreen
        || !startButton
        || !restartButton
        || !scoreDisplay
        || !finalScore
        || !highScoreDisplay
        || !playerNameDisplay
        || !currentPlayerName
        || !leaderboardList
        || !leaderboardContainer
        || !clearBtn
        || !gameTitle
        || !activePlayersCount
    ) {
        console.error('Flappy game bootstrap failed: missing required DOM elements.');
        return null;
    }

    // --- Firebase setup ---
    const isFirebaseConfigured = FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';
    let database = null;
    let useLocalLeaderboard = true;
    let presenceRef = null;
    let activePlayersRef = null;
    let presenceHeartbeatTimer = null;

    if (isFirebaseConfigured && firebaseApi) {
        try {
            if (!firebaseApi.apps || firebaseApi.apps.length === 0) {
                firebaseApi.initializeApp(FIREBASE_CONFIG);
            }
            database = firebaseApi.database();
            useLocalLeaderboard = false;
            console.log('✅ Firebase initialized successfully');
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            console.log('📝 Using local leaderboard instead');
            useLocalLeaderboard = true;
        }
    } else {
        console.log('⚠️ Firebase not configured. Using local leaderboard.');
        useLocalLeaderboard = true;
    }

    // --- Game state ---
    let bird;
    let pipes;
    let score;
    let highScore;
    let gameover;
    let frame;
    let lastTime = 0;
    let deltaTime = 0;
    let displayedScore = 0;

    // --- Visual state ---
    let deathSlowMoTimer = 0;
    let trailSpawnTimer = 0;
    let birdGlow = 0;
    let nearMissFlash = 0;
    let scorePopTimeout = null;

    const camera = {
        x: 0,
        y: 0,
        kick: 0,
        shake: 0
    };

    // Anti-cheat tracking
    let gameStartTime = 0;
    let pipesPassed = 0;
    let totalFlaps = 0;
    let gameHash = '';

    // Player state
    let playerName = localStorage.getItem('flappyPlayerName') || '';
    let playerId = localStorage.getItem('flappyPlayerId') || generatePlayerId();

    // Background and particles
    const backgroundState = createBackgroundState();
    const particleSystem = new ParticleSystem(MAX_PARTICLES);
    const renderCache = {};

    // Responsive gameplay scaling
    const BASE_HEIGHT = 700;
    const BASE_WIDTH = 400;
    const MOBILE_BREAKPOINT = 768;
    const MIN_PIPE_GAP = 140;
    const MAX_PIPE_GAP = 260;
    const MIN_PIPE_WIDTH = 50;
    const MAX_PIPE_WIDTH = 110;
    const MOBILE_GAP_MULTIPLIER = 0.92;
    const MOBILE_SPEED_MULTIPLIER = 0.9;

    const gameplayScale = {
        scaleFactor: 1,
        pipeGap: PIPE_GAP,
        pipeWidth: PIPE_WIDTH,
        birdWidth: BIRD_WIDTH,
        birdHeight: BIRD_HEIGHT,
        gravity: GRAVITY,
        flapStrength: FLAP_STRENGTH,
        speed: SPEED
    };

    function updateGameplayScale() {
        const logicalHeight = Math.max(1, canvas.logicalHeight || BASE_HEIGHT);
        const logicalWidth = Math.max(1, canvas.logicalWidth || BASE_WIDTH);
        const scaleFactor = Math.min(logicalWidth / BASE_WIDTH, logicalHeight / BASE_HEIGHT);
        const isMobileViewport = logicalWidth < MOBILE_BREAKPOINT;

        const scaledBirdWidth = BIRD_WIDTH * scaleFactor;
        const scaledBirdHeight = BIRD_HEIGHT * scaleFactor;
        let scaledPipeGap = clamp(PIPE_GAP * scaleFactor, MIN_PIPE_GAP, MAX_PIPE_GAP);
        if (isMobileViewport) {
            scaledPipeGap = clamp(scaledPipeGap * MOBILE_GAP_MULTIPLIER, MIN_PIPE_GAP, MAX_PIPE_GAP);
        }

        let scaledPipeWidth = clamp(PIPE_WIDTH * scaleFactor, MIN_PIPE_WIDTH, MAX_PIPE_WIDTH);
        // Keep pipe width close to ~1.2x bird width when possible within width clamps.
        const targetPipeWidth = scaledBirdWidth * 1.2;
        const ratioMin = clamp(targetPipeWidth * 0.9, MIN_PIPE_WIDTH, MAX_PIPE_WIDTH);
        const ratioMax = clamp(targetPipeWidth * 1.1, ratioMin, MAX_PIPE_WIDTH);
        scaledPipeWidth = clamp(scaledPipeWidth, ratioMin, ratioMax);

        gameplayScale.scaleFactor = scaleFactor;
        gameplayScale.pipeGap = scaledPipeGap;
        gameplayScale.pipeWidth = scaledPipeWidth;
        gameplayScale.birdWidth = scaledBirdWidth;
        gameplayScale.birdHeight = scaledBirdHeight;
        gameplayScale.gravity = GRAVITY * scaleFactor;
        gameplayScale.flapStrength = FLAP_STRENGTH * scaleFactor;
        gameplayScale.speed = (SPEED * scaleFactor) * (isMobileViewport ? MOBILE_SPEED_MULTIPLIER : 1);
    }

    // Seeded random for repeatable levels
    let seed = 12345;

    // Assets and synths
    let birdImage = null;
    let birdPassImage = null;
    let birdHitImage = null;
    let flapAudio = null;
    let outAudio = null;
    let passAudio = null;
    let showPassImage = false;
    let showHitImage = false;

    let flapSynth;
    let outSynth;
    let passSynth;

    function seededRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    }

    function validateScore(nextScore, time, pipesCount, flapsCount) {
        if (nextScore !== pipesCount) {
            console.error('🚫 Score mismatch:', { score: nextScore, pipes: pipesCount });
            return false;
        }

        const minTimeNeeded = pipesCount * 2;
        if (time < minTimeNeeded) {
            console.error('🚫 Time too fast:', { time, minTimeNeeded });
            return false;
        }

        const maxTimeAllowed = pipesCount * 30;
        if (time > maxTimeAllowed) {
            console.error('🚫 Time too slow:', { time, maxTimeAllowed });
            return false;
        }

        const minFlapsNeeded = pipesCount;
        const maxReasonableFlaps = pipesCount * 5 + 10;
        if (flapsCount < minFlapsNeeded || flapsCount > maxReasonableFlaps) {
            console.error('🚫 Flap count suspicious:', { flaps: flapsCount, min: minFlapsNeeded, max: maxReasonableFlaps });
            return false;
        }

        if (nextScore < 0 || nextScore > 9999) {
            console.error('🚫 Score out of bounds:', nextScore);
            return false;
        }

        if (bird && Math.abs(bird.velocity) > 50) {
            console.error('🚫 Impossible velocity:', bird.velocity);
            return false;
        }

        return true;
    }

    function getLocalLeaderboard() {
        const saved = localStorage.getItem('flappyLocalLeaderboard');
        return saved ? JSON.parse(saved) : [];
    }

    function saveToLocalLeaderboard(nextPlayerName, nextScore) {
        const gameTime = (Date.now() - gameStartTime) / 1000;
        if (!validateScore(nextScore, gameTime, pipesPassed, totalFlaps)) {
            console.error('🚫 Invalid score - local save rejected');
            return;
        }

        const leaderboard = getLocalLeaderboard();
        const existingPlayerIndex = leaderboard.findIndex(entry =>
            entry.playerName.toLowerCase() === nextPlayerName.toLowerCase()
        );

        if (existingPlayerIndex !== -1) {
            if (nextScore > leaderboard[existingPlayerIndex].score) {
                console.log(`🎉 ${nextPlayerName}: New high score! ${leaderboard[existingPlayerIndex].score} → ${nextScore}`);
                leaderboard[existingPlayerIndex].score = nextScore;
                leaderboard[existingPlayerIndex].playerId = playerId;
                leaderboard[existingPlayerIndex].timestamp = Date.now();
            } else {
                console.log(`${nextPlayerName}: Score ${nextScore} not better than best ${leaderboard[existingPlayerIndex].score}`);
                return;
            }
        } else {
            console.log(`🆕 New player: ${nextPlayerName} with score ${nextScore}`);
            leaderboard.push({
                playerName: nextPlayerName,
                score: nextScore,
                playerId,
                timestamp: Date.now()
            });
        }

        leaderboard.sort((a, b) => b.score - a.score);
        localStorage.setItem('flappyLocalLeaderboard', JSON.stringify(leaderboard.slice(0, 100)));
    }

    function clearLocalLeaderboard() {
        localStorage.removeItem('flappyLocalLeaderboard');
        console.log('🗑️ Local leaderboard cleared');
    }

    function generatePlayerId() {
        const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('flappyPlayerId', id);
        return id;
    }

    function setupPresence() {
        if (useLocalLeaderboard || !database) {
            console.log('📡 Active players tracking: Using local mode (no Firebase)');
            activePlayersCount.textContent = '1';
            return;
        }

        try {
            presenceRef = database.ref(`presence/${playerId}`);
            activePlayersRef = database.ref('presence');

            const presenceData = {
                playerName,
                playerId,
                lastActive: firebaseApi.database.ServerValue.TIMESTAMP,
                status: 'online'
            };

            presenceRef.set(presenceData);

            if (presenceHeartbeatTimer) {
                clearInterval(presenceHeartbeatTimer);
            }

            presenceHeartbeatTimer = setInterval(() => {
                if (presenceRef) {
                    presenceRef.update({
                        lastActive: firebaseApi.database.ServerValue.TIMESTAMP
                    });
                }
            }, PRESENCE_HEARTBEAT_MS);

            presenceRef.onDisconnect().remove();

            activePlayersRef.on('value', (snapshot) => {
                const now = Date.now();
                let activeCount = 0;

                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val();
                    if (now - data.lastActive < PRESENCE_TIMEOUT_MS) {
                        activeCount++;
                    }
                });

                activePlayersCount.textContent = String(activeCount);
                console.log(`📡 Active players: ${activeCount}`);
            });

            console.log('✅ Active players tracking enabled');
        } catch (error) {
            console.error('❌ Error setting up presence:', error);
            activePlayersCount.textContent = '?';
        }
    }

    function updatePresenceStatus(status) {
        if (presenceRef && !useLocalLeaderboard) {
            presenceRef.update({
                status,
                lastActive: firebaseApi.database.ServerValue.TIMESTAMP
            });
        }
    }

    async function getActivePlayers() {
        if (useLocalLeaderboard || !database) {
            return [{ playerName, status: 'online' }];
        }

        try {
            const snapshot = await database.ref('presence').once('value');
            const players = [];
            const now = Date.now();

            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (now - data.lastActive < PRESENCE_TIMEOUT_MS) {
                    players.push({
                        playerName: data.playerName,
                        playerId: data.playerId,
                        status: data.status,
                        lastActive: new Date(data.lastActive).toLocaleTimeString()
                    });
                }
            });

            return players;
        } catch (error) {
            console.error('Error getting active players:', error);
            return [];
        }
    }

    function savePlayerName(name) {
        playerName = name.trim();
        localStorage.setItem('flappyPlayerName', playerName);
        currentPlayerName.textContent = playerName;
        setupPresence();
    }

    function showNameEntry() {
        nameEntryScreen.classList.remove('hidden');
        nameEntryScreen.style.display = 'flex';
        playerNameInput.value = playerName;
        playerNameInput.focus();
    }

    function hideNameEntry() {
        nameEntryScreen.classList.add('hidden');
        nameEntryScreen.style.display = 'none';
    }

    async function saveScoreToFirebase(nextPlayerName, nextScore) {
        const gameTime = (Date.now() - gameStartTime) / 1000;
        const isValid = validateScore(nextScore, gameTime, pipesPassed, totalFlaps);

        if (!isValid) {
            console.error('🚫 Invalid score detected! Score rejected.');
            console.log('Debug:', { score: nextScore, gameTime, pipesPassed, totalFlaps });
            return;
        }

        const integrityCheck = simpleHash(
            gameHash + nextScore + pipesPassed + totalFlaps + gameTime.toFixed(2)
        );

        console.log('✅ Score validated:', { score: nextScore, time: gameTime.toFixed(1), pipes: pipesPassed, flaps: totalFlaps, hash: integrityCheck });

        if (useLocalLeaderboard) {
            console.log('💾 Saving score to local leaderboard:', { playerName: nextPlayerName, score: nextScore });
            saveToLocalLeaderboard(nextPlayerName, nextScore);
            return;
        }

        if (!database) {
            console.log('Database not initialized, using local leaderboard');
            saveToLocalLeaderboard(nextPlayerName, nextScore);
            return;
        }

        try {
            const playerKey = nextPlayerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const leaderboardRef = database.ref(`leaderboard/${playerKey}`);

            const snapshot = await leaderboardRef.once('value');
            const existingData = snapshot.val();
            const currentBest = existingData ? existingData.score : 0;

            if (nextScore > currentBest) {
                const scoreData = {
                    playerName: nextPlayerName,
                    score: nextScore,
                    timestamp: Date.now(),
                    playerId
                };

                console.log(`☁️ ${nextPlayerName}: New high score! ${currentBest} → ${nextScore}`);
                await leaderboardRef.set(scoreData);
                console.log('✅ Leaderboard updated in Firebase');
            } else {
                console.log(`${nextPlayerName}: Score ${nextScore} not better than best ${currentBest}`);
            }
        } catch (error) {
            console.error('❌ Error saving score to Firebase:', error);
            console.log('💾 Falling back to local leaderboard');
            saveToLocalLeaderboard(nextPlayerName, nextScore);
        }
    }

    async function loadLeaderboard() {
        try {
            leaderboardList.innerHTML = '<p class="text-gray-400 text-center">Loading leaderboard...</p>';

            let scores = [];
            const activePlayerIds = new Set();

            if (!useLocalLeaderboard && database) {
                try {
                    const presenceSnapshot = await database.ref('presence').once('value');
                    const now = Date.now();
                    presenceSnapshot.forEach((childSnapshot) => {
                        const data = childSnapshot.val();
                        if (data && data.playerId && (now - data.lastActive < PRESENCE_TIMEOUT_MS)) {
                            activePlayerIds.add(data.playerId);
                        }
                    });
                } catch (err) {
                    console.warn('⚠️ Could not fetch presence data:', err);
                }
            }

            if (useLocalLeaderboard) {
                console.log('📂 Loading from local leaderboard');
                scores = getLocalLeaderboard();

                const infoDiv = document.createElement('div');
                infoDiv.className = 'text-xs text-gray-500 text-center mb-2 py-2 px-3 rounded-lg';
                infoDiv.style.background = 'rgba(255,255,255,0.04)';
                infoDiv.innerHTML = '💾 Local Leaderboard';
                leaderboardList.innerHTML = '';
                leaderboardList.appendChild(infoDiv);
            } else if (database) {
                console.log('☁️ Loading from Firebase');

                const snapshot = await database.ref('leaderboard').once('value');
                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val();
                    if (data && data.playerName && typeof data.score === 'number') {
                        scores.push({
                            playerName: data.playerName,
                            score: data.score,
                            playerId: data.playerId,
                            timestamp: data.timestamp || 0,
                            isOnline: activePlayerIds.has(data.playerId)
                        });
                    }
                });
            }

            scores.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.timestamp - b.timestamp;
            });

            if (scores.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.className = 'text-gray-500 text-center text-sm py-4';
                emptyMsg.textContent = 'No scores yet. Be the first! 🎮';
                leaderboardList.appendChild(emptyMsg);
            } else {
                scores.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const isCurrentPlayer = scoreData.playerId === playerId;
                    const medal = rank === 1
                        ? '🥇'
                        : rank === 2
                            ? '🥈'
                            : rank === 3
                                ? '🥉'
                                : `<span style="color:#94a3b8;font-weight:700;font-size:0.85rem;">${rank}</span>`;

                    const onlineIndicator = scoreData.isOnline
                        ? '<span class="online-dot text-green-400" title="Online">●</span>'
                        : '<span class="online-dot text-gray-600" title="Offline">●</span>';

                    const entry = document.createElement('div');
                    entry.className = `lb-entry ${isCurrentPlayer ? 'current-player' : ''}`;
                    entry.innerHTML = `
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="rank">${medal}</span>
                            <span class="player-name truncate">${scoreData.playerName}</span>
                            ${onlineIndicator}
                        </div>
                        <span class="player-score">${scoreData.score}</span>
                    `;
                    leaderboardList.appendChild(entry);
                });
            }
        } catch (error) {
            console.error('❌ Error loading leaderboard:', error);
            leaderboardList.innerHTML = `<p class="text-red-400 text-center text-sm">Error: ${error.message}</p>`;
        }
    }

    function initAudio() {
        if (!toneApi) {
            return;
        }

        if (!flapSynth) {
            flapSynth = new toneApi.Synth({
                oscillator: { type: 'sine' },
                envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
            }).toDestination();
            flapSynth.volume.value = 5;
        }

        if (!outSynth) {
            outSynth = new toneApi.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
            }).toDestination();
            outSynth.volume.value = 5;
        }

        if (!passSynth) {
            passSynth = new toneApi.Synth({
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
            }).toDestination();
            passSynth.volume.value = -5;
        }
    }

    function loadDeveloperAssets() {
        birdImage = ensureImageAsset(birdImage, BIRD_IMAGE_PATH);
    }

    function playFlapSound() {
        if (toneApi && toneApi.context && toneApi.context.state !== 'running') {
            toneApi.start();
        }

        flapAudio = ensureAudioAsset(flapAudio, FLAP_SOUND_PATH);
        if (flapAudio) {
            flapAudio.currentTime = 0;
            flapAudio.play().catch(e => console.error('Error playing flap sound:', e));
        } else if (toneApi) {
            initAudio();
            flapSynth.triggerRelease();
            flapSynth.triggerAttackRelease('C5', '8n', toneApi.now());
        }
    }

    function playOutSound() {
        outAudio = ensureAudioAsset(outAudio, OUT_SOUND_PATH);
        if (outAudio) {
            outAudio.currentTime = 0;
            outAudio.play().catch(e => console.error('Error playing out sound:', e));
        } else if (toneApi) {
            initAudio();
            outSynth.triggerRelease();
            outSynth.triggerAttackRelease('4n', toneApi.now());
        }
    }

    function playPassSound() {
        if (toneApi && toneApi.context && toneApi.context.state !== 'running') {
            toneApi.start();
        }

        passAudio = ensureAudioAsset(passAudio, PASS_SOUND_PATH);
        if (passAudio) {
            passAudio.currentTime = 0;
            passAudio.play().catch(e => console.error('Error playing pass sound:', e));
        } else if (toneApi) {
            initAudio();
            passSynth.triggerRelease();
            passSynth.triggerAttackRelease('E5', '8n', toneApi.now());
        }
    }

    function initBackground() {
        initBackgroundState(backgroundState, canvas, GROUND_HEIGHT);
        particleSystem.reset();
    }

    function updateBackground(timeScale = 1, ignoreFreeze = false) {
        updateBackgroundState(backgroundState, {
            gameover,
            ignoreFreeze,
            canvasWidth: canvas.logicalWidth,
            canvasHeight: canvas.logicalHeight,
            speed: gameplayScale.speed * timeScale,
            cloudSpeed: (CLOUD_SPEED * gameplayScale.scaleFactor) * timeScale,
            parallaxFarSpeed: PARALLAX_FAR_SPEED,
            parallaxMidSpeed: PARALLAX_MID_SPEED,
            timeScale,
            groundHeight: GROUND_HEIGHT
        });
    }

    function drawBackground(w, h, cachedRender) {
        drawBackgroundState(backgroundState, ctx, {
            w,
            h,
            groundHeight: GROUND_HEIGHT,
            cachedRender,
            frame
        });
    }

    function setup() {
        updatePresenceStatus('playing');
        configureCanvasSize(canvas, ctx);
        updateGameplayScale();

        initBackground();

        bird = {
            x: canvas.logicalWidth / 3,
            y: canvas.logicalHeight / 2,
            width: gameplayScale.birdWidth,
            height: gameplayScale.birdHeight,
            velocity: 0,
            rotation: 0,
            idlePhase: 0,
            idleOffset: 0,
            scaleX: 1,
            scaleY: 1
        };

        pipes = [];
        score = 0;
        displayedScore = 0;
        highScore = localStorage.getItem('flappyHighScore') || 0;
        gameover = false;
        frame = 0;
        lastTime = 0;
        deltaTime = 0;
        deathSlowMoTimer = 0;
        trailSpawnTimer = 0;
        birdGlow = 0;
        nearMissFlash = 0;
        camera.x = 0;
        camera.y = 0;
        camera.kick = 0;
        camera.shake = 0;

        if (scorePopTimeout) {
            clearTimeout(scorePopTimeout);
            scorePopTimeout = null;
        }
        scoreDisplay.classList.remove('score-pop');

        showPassImage = false;
        showHitImage = false;

        gameStartTime = Date.now();
        pipesPassed = 0;
        totalFlaps = 0;
        gameHash = simpleHash(playerId + gameStartTime + seed);

        seed = 12345;

        const dynamicPipeGap = gameplayScale.pipeGap;
        const minPipeHeight = 50;
        const maxPipeHeight = canvas.logicalHeight - dynamicPipeGap - minPipeHeight - GROUND_HEIGHT;
        const firstPipeHeight = seededRandom() * (maxPipeHeight - minPipeHeight) + minPipeHeight;

        pipes.push({
            x: canvas.logicalWidth,
            top: firstPipeHeight,
            bottom: firstPipeHeight + dynamicPipeGap,
            passed: false
        });

        setScoreDisplayText(0);

        startScreen.style.transform = 'translateY(8px) scale(0.98)';
        startScreen.style.opacity = '0';
        setTimeout(() => {
            startScreen.classList.add('hidden');
            scoreDisplay.classList.remove('hidden');
            scoreDisplay.style.animation = 'slideDown 0.5s ease-out';
        }, 300);

        gameOverScreen.classList.add('hidden');
        gameOverScreen.style.display = 'none';
        gameOverScreen.style.opacity = '0';
        gameOverScreen.style.transform = 'translateY(12px) scale(0.98)';
        finalScore.classList.remove('new-high-score');

        gameLoop();
    }

    function updateParticles(timeScale = 1) {
        particleSystem.update(timeScale);
    }

    function drawParticles() {
        particleSystem.draw(ctx);
    }

    function createFlapParticles(x, y) {
        particleSystem.spawnFlapBurst(x, y);
    }

    function createTrailParticle(x, y, velocity) {
        particleSystem.spawnTrail(x, y, velocity);
    }

    function createScoreParticles(x, y) {
        particleSystem.spawnScoreBurst(x, y);
    }

    function createNearMissParticles(x, y) {
        particleSystem.spawnNearMissBurst(x, y);
    }

    function createCollisionParticles(x, y) {
        particleSystem.spawnCollisionBurst(x, y);
    }

    function gameLoop(currentTime = 0) {
        const deathCinematicActive = gameover && deathSlowMoTimer > 0;
        if (gameover && !deathCinematicActive) {
            return;
        }

        if (lastTime === 0) {
            lastTime = currentTime;
        }

        deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        deltaTime = Math.min(deltaTime, 0.1);

        if (!gameover) {
            update();
        } else {
            const cinematicTimeScale = 0.28;
            deathSlowMoTimer = Math.max(0, deathSlowMoTimer - deltaTime);
            updateBackground(cinematicTimeScale, true);
            updateParticles(cinematicTimeScale);
            updateCameraState(camera, cinematicTimeScale);
            birdGlow = Math.max(0, birdGlow - 0.05 * cinematicTimeScale);
            nearMissFlash = Math.max(0, nearMissFlash - 0.08 * cinematicTimeScale);
        }

        draw();
        frame++;
        requestAnimationFrame(gameLoop);
    }

    function update() {
        if (typeof bird === 'undefined' || typeof pipes === 'undefined' || typeof score === 'undefined') {
            console.error('🚫 Game tampering detected! Variables modified.');
            return endGame();
        }

        const timeScale = computeTimeScale(deltaTime);

        bird.velocity += gameplayScale.gravity * timeScale;
        bird.y += bird.velocity * timeScale;

        const targetRotation = bird.velocity < 0
            ? -0.42
            : clamp(bird.velocity * 0.06, -0.42, Math.PI / 2.5);
        bird.rotation += (targetRotation - bird.rotation) * Math.min(1, 0.18 * timeScale);

        bird.idlePhase += 0.08 * timeScale;
        const targetIdleOffset = Math.abs(bird.velocity) < 0.35
            ? Math.sin(bird.idlePhase) * 2.2
            : 0;
        bird.idleOffset += (targetIdleOffset - bird.idleOffset) * Math.min(1, 0.2 * timeScale);

        bird.scaleX += (1 - bird.scaleX) * Math.min(1, 0.2 * timeScale);
        bird.scaleY += (1 - bird.scaleY) * Math.min(1, 0.2 * timeScale);
        birdGlow = Math.max(0, birdGlow - 0.03 * timeScale);
        nearMissFlash = Math.max(0, nearMissFlash - 0.05 * timeScale);

        trailSpawnTimer += deltaTime;
        if (trailSpawnTimer >= 0.045) {
            trailSpawnTimer = 0;
            createTrailParticle(bird.x, bird.y + bird.idleOffset, bird.velocity);
        }

        if (bird.y + bird.height / 2 > canvas.logicalHeight - GROUND_HEIGHT) {
            bird.y = canvas.logicalHeight - GROUND_HEIGHT - bird.height / 2;
            bird.velocity = 0;

            birdHitImage = ensureImageAsset(birdHitImage, BIRD_HIT_IMAGE_PATH);
            if (birdHitImage) {
                showHitImage = true;
                showPassImage = false;
            }

            return endGame();
        }

        if (bird.y - bird.height / 2 < 0) {
            bird.y = bird.height / 2;
            bird.velocity = 0;
        }

        const lastPipe = pipes[pipes.length - 1];
        if (shouldSpawnPipeDistance(lastPipe?.x, canvas.logicalWidth, PIPE_SPACING_DISTANCE)) {
            const dynamicPipeGap = gameplayScale.pipeGap;
            const minPipeHeight = 50;
            const maxPipeHeight = canvas.logicalHeight - dynamicPipeGap - minPipeHeight - GROUND_HEIGHT;
            const pipeHeight = seededRandom() * (maxPipeHeight - minPipeHeight) + minPipeHeight;

            pipes.push({
                x: getNextPipeX(lastPipe?.x, canvas.logicalWidth, PIPE_SPACING_DISTANCE),
                top: pipeHeight,
                bottom: pipeHeight + dynamicPipeGap,
                passed: false
            });
        }

        let collisionDetected = false;

        pipes.forEach((pipe) => {
            pipe.x -= gameplayScale.speed * timeScale;

            const birdLeft = bird.x - bird.width / 2;
            const birdRight = bird.x + bird.width / 2;
            const birdTop = bird.y - bird.height / 2;
            const birdBottom = bird.y + bird.height / 2;

            const pipeRight = pipe.x + gameplayScale.pipeWidth;
            const horizontalCollision = birdRight > pipe.x && birdLeft < pipeRight;
            const topCollision = birdTop < pipe.top;
            const bottomCollision = birdBottom > pipe.bottom;

            if (horizontalCollision && !topCollision && !bottomCollision && !pipe.nearMissed) {
                const topClearance = Math.abs(birdTop - pipe.top);
                const bottomClearance = Math.abs(pipe.bottom - birdBottom);
                if (Math.min(topClearance, bottomClearance) < 24) {
                    pipe.nearMissed = true;
                    nearMissFlash = 1;
                    createNearMissParticles(bird.x + bird.width * 0.2, bird.y);
                }
            }

            if (horizontalCollision && (topCollision || bottomCollision)) {
                collisionDetected = true;
                console.error('🚫 Pipe collision detected!');

                birdHitImage = ensureImageAsset(birdHitImage, BIRD_HIT_IMAGE_PATH);
                if (birdHitImage) {
                    showHitImage = true;
                    showPassImage = false;
                }
            }

            if (!pipe.passed && pipe.x < bird.x) {
                pipe.passed = true;
                pipesPassed++;

                if (score !== pipesPassed - 1) {
                    console.error('🚫 Score tampering detected!');
                    collisionDetected = true;
                }

                score++;
                birdGlow = 1;

                playPassSound();

                birdPassImage = ensureImageAsset(birdPassImage, BIRD_PASS_IMAGE_PATH);
                if (birdPassImage) {
                    showPassImage = true;
                    setTimeout(() => {
                        showPassImage = false;
                    }, 1500);
                }

                createScoreParticles(canvas.logicalWidth / 2, 60);

                scoreDisplay.classList.remove('score-pop');
                void scoreDisplay.offsetWidth;
                scoreDisplay.classList.add('score-pop');

                if (scorePopTimeout) {
                    clearTimeout(scorePopTimeout);
                }
                scorePopTimeout = setTimeout(() => {
                    scoreDisplay.classList.remove('score-pop');
                }, 220);
            }
        });

        if (collisionDetected) {
            return endGame();
        }

        pipes = pipes.filter(pipe => pipe.x + gameplayScale.pipeWidth > 0);

        displayedScore += (score - displayedScore) * Math.min(1, 0.2 * timeScale);
        if (Math.abs(score - displayedScore) < 0.01) {
            displayedScore = score;
        }
        setScoreDisplayText(Math.round(displayedScore));

        updateBackground(timeScale);
        updateParticles(timeScale);
        updateCameraState(camera, timeScale);
    }

    function draw() {
        const w = canvas.logicalWidth;
        const h = canvas.logicalHeight;
        const cachedRender = ensureRenderCache(renderCache, ctx, w, h, GROUND_HEIGHT, gameplayScale.pipeWidth);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.save();
        const baseZoomPulse = Math.sin(frame * 0.022) * 0.0045;
        const velocityZoom = clamp(Math.abs(bird.velocity) * 0.0011, 0, 0.011);
        const impactZoom = nearMissFlash * 0.0055;
        const cameraZoom = 1 + baseZoomPulse + velocityZoom + impactZoom;

        ctx.translate((w * 0.5) + camera.x, (h * 0.5) + camera.y);
        ctx.scale(cameraZoom, cameraZoom);
        ctx.translate(-w * 0.5, -h * 0.5);

        drawBackground(w, h, cachedRender);
        drawParticles();

        pipes.forEach((pipe, index) => {
            const renderX = pipe.x + Math.sin((frame * 0.03) + index * 1.2) * 1.5;
            const pipeWidth = gameplayScale.pipeWidth;
            const pipeRadius = clamp(pipeWidth * 0.1, 6, 12);
            const capHeight = clamp(pipeWidth * 0.25, 16, 30);
            const capOverlap = clamp(pipeWidth * 0.06, 4, 8);
            const bottomPipeHeight = h - pipe.bottom - GROUND_HEIGHT;

            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 7;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            drawRoundedRect(ctx, renderX + 3, 0, pipeWidth, pipe.top, pipeRadius);
            drawRoundedRect(ctx, renderX + 3, pipe.bottom, pipeWidth, bottomPipeHeight, pipeRadius);

            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = cachedRender.pipeGradient;
            drawRoundedRect(ctx, renderX, 0, pipeWidth, pipe.top, pipeRadius);
            drawRoundedRect(ctx, renderX, pipe.bottom, pipeWidth, bottomPipeHeight, pipeRadius);

            ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = cachedRender.capGradient;
            drawRoundedRect(ctx, renderX - capOverlap, pipe.top - capHeight, pipeWidth + capOverlap * 2, capHeight, 8);
            drawRoundedRect(ctx, renderX - capOverlap, pipe.bottom, pipeWidth + capOverlap * 2, capHeight, 8);

            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            drawRoundedRect(ctx, renderX + pipeWidth * 0.14, 0, pipeWidth * 0.14, pipe.top, 6);
            drawRoundedRect(ctx, renderX + pipeWidth * 0.14, pipe.bottom, pipeWidth * 0.14, bottomPipeHeight, 6);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            drawRoundedRect(ctx, renderX - capOverlap, pipe.top - capHeight, pipeWidth + capOverlap * 2, capHeight * 0.32, 8);
            drawRoundedRect(ctx, renderX - capOverlap, pipe.bottom, pipeWidth + capOverlap * 2, capHeight * 0.32, 8);
        });

        const altitudeRatio = clamp(bird.y / Math.max(1, h - GROUND_HEIGHT), 0, 1);
        const shadowWidth = bird.width * (0.58 - altitudeRatio * 0.26);
        const shadowHeight = bird.height * (0.2 - altitudeRatio * 0.08);
        const shadowAlpha = clamp(0.32 - altitudeRatio * 0.18, 0.08, 0.32);
        ctx.save();
        ctx.globalAlpha = shadowAlpha;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(bird.x + 8, h - GROUND_HEIGHT + 15, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (birdGlow > 0.01) {
            ctx.save();
            const glowGradient = ctx.createRadialGradient(
                bird.x,
                bird.y + bird.idleOffset,
                bird.width * 0.15,
                bird.x,
                bird.y + bird.idleOffset,
                bird.width * (0.6 + birdGlow * 0.55)
            );
            glowGradient.addColorStop(0, `rgba(34, 211, 238, ${0.35 * birdGlow})`);
            glowGradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(bird.x, bird.y + bird.idleOffset, bird.width * (0.6 + birdGlow * 0.55), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (nearMissFlash > 0.01) {
            ctx.save();
            const nearMissGradient = ctx.createRadialGradient(
                bird.x,
                bird.y,
                bird.width * 0.2,
                bird.x,
                bird.y,
                bird.width * 1.2
            );
            nearMissGradient.addColorStop(0, `rgba(251, 191, 36, ${0.25 * nearMissFlash})`);
            nearMissGradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
            ctx.fillStyle = nearMissGradient;
            ctx.beginPath();
            ctx.arc(bird.x, bird.y, bird.width * 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(bird.x, bird.y + bird.idleOffset);
        ctx.rotate(bird.rotation);
        ctx.scale(bird.scaleX, bird.scaleY);

        birdImage = ensureImageAsset(birdImage, BIRD_IMAGE_PATH);
        let currentBirdImage = birdImage;
        if (showHitImage && birdHitImage) {
            currentBirdImage = birdHitImage;
        } else if (showPassImage && birdPassImage) {
            currentBirdImage = birdPassImage;
        }

        if (currentBirdImage && currentBirdImage.complete && currentBirdImage.naturalWidth > 0) {
            const aspectRatio = currentBirdImage.width / currentBirdImage.height;
            let drawWidth = bird.width;
            let drawHeight = bird.height;

            if (aspectRatio > 1) {
                drawHeight = bird.width / aspectRatio;
            } else {
                drawWidth = bird.height * aspectRatio;
            }

            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            ctx.drawImage(currentBirdImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

            ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.drawImage(currentBirdImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        } else {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            const gradient = ctx.createLinearGradient(-bird.width / 2, -bird.height / 2, bird.width / 2, bird.height / 2);
            gradient.addColorStop(0, '#fbbf24');
            gradient.addColorStop(1, '#f59e0b');
            ctx.fillStyle = gradient;
            ctx.fillRect(-bird.width / 2, -bird.height / 2, bird.width, bird.height);

            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(-bird.width / 2, -bird.height / 2, bird.width / 4, bird.height / 4);
        }

        ctx.restore();
        ctx.restore();

        ctx.fillStyle = cachedRender.vignette;
        ctx.fillRect(0, 0, w, h);
    }

    function flap() {
        if (!gameover) {
            totalFlaps++;
            bird.velocity = gameplayScale.flapStrength;
            bird.scaleX = 1.12;
            bird.scaleY = 0.88;
            camera.kick = -1.35;
            camera.shake = Math.min(0.45, camera.shake + 0.08);
            playFlapSound();
            createFlapParticles(bird.x, bird.y);
        }
    }

    function endGame() {
        if (gameover) {
            return;
        }

        gameover = true;
        deathSlowMoTimer = 0.3;
        camera.shake = Math.max(camera.shake, 1.15);
        camera.kick = -0.6;
        displayedScore = score;
        setScoreDisplayText(score);

        birdHitImage = ensureImageAsset(birdHitImage, BIRD_HIT_IMAGE_PATH);
        if (birdHitImage) {
            showHitImage = true;
            showPassImage = false;
        }

        updatePresenceStatus('viewing_score');
        playOutSound();
        createCollisionParticles(bird.x, bird.y);

        canvas.style.animation = 'shake 0.45s';
        setTimeout(() => {
            canvas.style.animation = '';
        }, 450);

        let isNewHighScore = false;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('flappyHighScore', highScore);
            isNewHighScore = true;
        }

        finalScore.textContent = String(score);
        highScoreDisplay.textContent = String(highScore);

        if (playerName && score > 0) {
            saveScoreToFirebase(playerName, score);
        }

        setTimeout(() => {
            scoreDisplay.classList.add('hidden');
            playerNameDisplay.classList.add('hidden');
            gameOverScreen.classList.remove('hidden');
            gameOverScreen.style.display = 'flex';
            gameOverScreen.style.opacity = '0';
            gameOverScreen.style.transform = 'translateY(14px) scale(0.98)';
            requestAnimationFrame(() => {
                gameOverScreen.style.opacity = '1';
                gameOverScreen.style.transform = 'translateY(0) scale(1)';
            });

            if (isNewHighScore && score > 0) {
                finalScore.classList.add('new-high-score');
            }

            loadLeaderboard();
        }, 300);
    }

    function startGame() {
        initAudio();
        if (toneApi) {
            toneApi.start();
        }
        loadDeveloperAssets();

        if (outAudio) {
            outAudio.pause();
            outAudio.currentTime = 0;
        }
        if (outSynth) {
            outSynth.triggerRelease();
        }

        setup();
    }

    function initialScreenSetup() {
        gameTitle.textContent = GAME_TITLE;

        configureCanvasSize(canvas, ctx);
        updateGameplayScale();
        const cachedRender = ensureRenderCache(
            renderCache,
            ctx,
            canvas.logicalWidth,
            canvas.logicalHeight,
            GROUND_HEIGHT,
            gameplayScale.pipeWidth
        );

        initBackground();
        drawBackground(canvas.logicalWidth, canvas.logicalHeight, cachedRender);

        scoreDisplay.classList.add('hidden');
        playerNameDisplay.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        gameOverScreen.style.display = 'none';
        gameOverScreen.style.opacity = '0';
        gameOverScreen.style.transform = 'translateY(12px) scale(0.98)';

        if (playerName) {
            currentPlayerName.textContent = playerName;
            startScreen.classList.remove('hidden');
            startScreen.style.opacity = '1';
            startScreen.style.transform = 'translateY(0) scale(1)';
            nameEntryScreen.classList.add('hidden');
        } else {
            startScreen.classList.add('hidden');
            showNameEntry();
        }
    }

    // --- Console helpers ---
    window.clearLeaderboard = function clearLeaderboard() {
        clearLocalLeaderboard();
        console.log('✅ Local leaderboard cleared!');

        if (database && !useLocalLeaderboard) {
            database.ref('leaderboard').remove()
                .then(() => {
                    console.log('☁️ Firebase leaderboard cleared!');
                    alert('✅ Leaderboard cleared (Local + Firebase)! Refresh the page.');
                })
                .catch((err) => {
                    console.error('❌ Error clearing Firebase:', err);
                    alert('✅ Local leaderboard cleared! Refresh the page.');
                });
        } else {
            alert('✅ Local leaderboard cleared! Refresh the page.');
        }
    };

    window.clearAllData = function clearAllData() {
        localStorage.removeItem('flappyLocalLeaderboard');
        localStorage.removeItem('flappyPlayerName');
        localStorage.removeItem('flappyPlayerId');
        localStorage.removeItem('flappyHighScore');
        console.log('🗑️ Local data cleared!');

        if (database && !useLocalLeaderboard) {
            database.ref('leaderboard').remove()
                .then(() => {
                    console.log('☁️ Firebase leaderboard cleared!');
                    alert('✅ All data cleared (Local + Firebase)! The page will reload.');
                })
                .catch((err) => {
                    console.error('❌ Error clearing Firebase:', err);
                    alert('⚠️ Local data cleared, but Firebase error. Check console. Refreshing...');
                });
        } else {
            alert('✅ All local data cleared! The page will reload.');
        }
    };

    window.viewActivePlayers = async function viewActivePlayers() {
        const players = await getActivePlayers();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🟢 ACTIVE PLAYERS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (players.length === 0) {
            console.log('No active players');
        } else {
            players.forEach((player, idx) => {
                console.log(`${idx + 1}. ${player.playerName} - ${player.status} (Last: ${player.lastActive})`);
            });
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total: ${players.length} player(s) online`);
    };

    // --- Event listeners ---
    saveNameButton.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (name.length > 0) {
            savePlayerName(name);
            hideNameEntry();
            startScreen.classList.remove('hidden');
        } else {
            alert('Please enter a name!');
        }
    });

    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNameButton.click();
        }
    });

    changeNameButton.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        gameOverScreen.style.display = 'none';
        showNameEntry();
    });

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    canvas.addEventListener('mousedown', flap);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        flap();
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
            e.preventDefault();
            if (startScreen.classList.contains('hidden') && gameOverScreen.classList.contains('hidden')) {
                flap();
            } else if (!startScreen.classList.contains('hidden')) {
                startGame();
            } else if (!gameOverScreen.classList.contains('hidden')) {
                startGame();
            }
        }
    });

    window.addEventListener('resize', () => {
        configureCanvasSize(canvas, ctx);
        updateGameplayScale();

        if (gameover) {
            draw();
        } else if (!startScreen.classList.contains('hidden')) {
            initialScreenSetup();
        } else {
            setup();
        }
    });

    let shiftClicks = 0;
    leaderboardContainer.addEventListener('click', (e) => {
        if (e.shiftKey) {
            shiftClicks++;
            if (shiftClicks >= 3) {
                clearBtn.classList.remove('hidden');
                console.log('🔓 Admin mode activated - Clear button visible');
            }
        }
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('⚠️ Clear entire leaderboard?\n\nThis will remove:\n- All leaderboard scores\n- Your player name\n- Your high score\n\nThis action cannot be undone!')) {
            window.clearAllData();
            location.reload();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (presenceRef) {
            presenceRef.remove();
        }
        if (presenceHeartbeatTimer) {
            clearInterval(presenceHeartbeatTimer);
            presenceHeartbeatTimer = null;
        }
    });

    initialScreenSetup();

    console.log('🎮 Game Commands Available:');
    console.log('  - clearLeaderboard() : Clear the leaderboard');
    console.log('  - clearAllData() : Clear all game data (leaderboard, name, ID, high score)');
    console.log('');
    console.log('💡 Quick Clear: Hold Shift and click leaderboard 3 times to show clear button');

    const api = {
        startGame,
        loadLeaderboard,
        flap
    };

    window.__flappyGameInitialized = true;
    window.__flappyGameApi = api;

    return api;
}
