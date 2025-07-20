import { Application, Text, Assets, Sprite } from "pixi.js";

// Emojis for targets
const EMOJIS = ['😀','🐶','🍕','🚗','👻','🎩','🥑','🍄','🦄','⚽','🤖'];

// Leaderboard functionality
interface LeaderboardEntry {
    initials: string;
    score: number;
    time: number;
}

function getLeaderboard(): LeaderboardEntry[] {
    const stored = localStorage.getItem('dote-shpwat-fred-leaderboard');
    if (stored) {
        return JSON.parse(stored);
    }
    return [];
}

function saveLeaderboard(leaderboard: LeaderboardEntry[]) {
    localStorage.setItem('dote-shpwat-fred-leaderboard', JSON.stringify(leaderboard));
}

function isHighScore(score: number): { isHigh: boolean; rank: number } {
    const leaderboard = getLeaderboard();
    leaderboard.sort((a, b) => b.score - a.score);
    
    if (leaderboard.length < 10) {
        return { isHigh: true, rank: leaderboard.length + 1 };
    }
    
    for (let i = 0; i < leaderboard.length; i++) {
        if (score > leaderboard[i].score) {
            return { isHigh: true, rank: i + 1 };
        }
    }
    
    return { isHigh: false, rank: -1 };
}

function addToLeaderboard(initials: string, score: number, time: number) {
    const leaderboard = getLeaderboard();
    leaderboard.push({ initials, score, time });
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep only top 10
    if (leaderboard.length > 10) {
        leaderboard.splice(10);
    }
    
    saveLeaderboard(leaderboard);
}

// Pick 3 FREDS (targets to avoid)
function pickFreds(): string[] {
    const copy = [...EMOJIS];
    const freds: string[] = [];
    for(let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * copy.length);
        freds.push(copy[idx]);
        copy.splice(idx, 1);
    }
    return freds;
}

interface Target {
    sprite: Text;
    fred: boolean;
    timeLeft: number;
    maxTime: number;
}

interface Projectile {
    sprite: Sprite;
    vx: number;
    vy: number;
}

(async () => {
    // Create a new application
    const app = new Application();

    // Initialize the application
    await app.init({ 
        background: "#222222", 
        resizeTo: window 
    });

    // Append the application canvas to the document body
    document.getElementById("pixi-container")!.appendChild(app.canvas);

    // Load assets
    const skrawTexture = await Assets.load('/assets/img/skraw.png');
    const shpitballTexture = await Assets.load('/assets/img/shpitball.png');
    const logoTexture = await Assets.load('/assets/img/logo.png');

    let freds = pickFreds();
    let score = 0;
    let currentTarget: Target | null = null;
    let projectiles: Projectile[] = [];
    let gameRunning = false; // Start with intro screen
    let gameStarted = false;
    let targetsSpawned = 0;
    let mouseX = 0;
    let gameStartTime = Date.now();
    let gameWon = false;
    let gameLost = false;
    const TARGET_LIFETIME = 2000; // 2 seconds in milliseconds
    const SPAWN_DELAY = 500; // 0.5 seconds between targets
    const PROJECTILE_SPEED = 20; // Much faster projectiles
    const WIN_SCORE = 20;
    const LONG_SHOT_THRESHOLD = 2/3; // 2/3 of screen height for bonus points

    function showIntroScreen() {
        // Create logo - positioned in top third
        const logo = new Sprite(logoTexture);
        logo.anchor.set(0.5);
        logo.x = app.screen.width / 2;
        logo.y = app.screen.height / 6; // Top third of screen
        logo.scale.set(0.4); // Smaller to fit in top section
        app.stage.addChild(logo);

        // Create title text with broken English story - positioned in middle third
        const storyText = new Text({
            text: `U went asleep wit yer underwares inside out and now u mega disgrunt...
            
Da rachets hav taken over da neighborhood! 
But don't worry - you got FREDS!
SHPWAT all da rachets but NOT yer FRED!

Today's FRED friends are: ${freds.join(' ')}
(dey glow red so u know dey yer friends!)`,
            style: {
                fontSize: 18,
                fill: '#ffffff',
                fontFamily: 'Comic Sans MS, cursive', // Fun hand-written style
                align: 'center',
                wordWrap: true,
                wordWrapWidth: app.screen.width - 120
            }
        });
        storyText.anchor.set(0.5);
        storyText.x = app.screen.width / 2;
        storyText.y = app.screen.height / 2; // Middle of screen
        app.stage.addChild(storyText);

        // Create rules text - positioned in bottom third
        const rulesText = new Text({
            text: `RULES OF DA SHPWAT:
• Hit rachets = +1 point
• Long shots (upper screen) = +2 points  
• Hit FRED friend = -1 point (DON'T HURT YER FRIENDS!)
• Miss completely = -1 point
• Score goes negative = U LOSE
• Reach 20 points = U WIN (faster = bonus!)

Move mouse to aim yer skraw
Click to fire shpitballs straight up
Work wit yer FRED friends to clear da rachets!`,
            style: {
                fontSize: 14,
                fill: '#dddddd',
                fontFamily: 'Comic Sans MS, cursive', // Match the hand-written style
                align: 'center',
                wordWrap: true,
                wordWrapWidth: app.screen.width - 120
            }
        });
        rulesText.anchor.set(0.5);
        rulesText.x = app.screen.width / 2;
        rulesText.y = app.screen.height * 5/6; // Bottom third of screen
        app.stage.addChild(rulesText);

        // Create start button - at very bottom
        const startText = new Text({
            text: 'CLICK TO START SHPWATTING!',
            style: {
                fontSize: 22,
                fill: '#44ff44',
                fontFamily: 'Comic Sans MS, cursive', // Consistent font
                align: 'center',
                fontWeight: 'bold'
            }
        });
        startText.anchor.set(0.5);
        startText.x = app.screen.width / 2;
        startText.y = app.screen.height - 70; // Moved up to make room for leaderboard button
        app.stage.addChild(startText);

        // Create leaderboard button
        const leaderboardButton = new Text({
            text: 'View Leaderboard',
            style: {
                fontSize: 16,
                fill: '#ffff44',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center'
            }
        });
        leaderboardButton.anchor.set(0.5);
        leaderboardButton.x = app.screen.width / 2;
        leaderboardButton.y = app.screen.height - 30;
        app.stage.addChild(leaderboardButton);

        // Add pulsing effect to start button
        let pulseDirection = 1;
        const pulseSpeed = 0.02;
        const pulseTicker = () => {
            if (startText.parent) {
                startText.alpha += pulseDirection * pulseSpeed;
                if (startText.alpha >= 1) {
                    startText.alpha = 1;
                    pulseDirection = -1;
                } else if (startText.alpha <= 0.5) {
                    startText.alpha = 0.5;
                    pulseDirection = 1;
                }
            }
        };
        app.ticker.add(pulseTicker);

        // Handle start game click
        const startGame = () => {
            app.stage.removeChild(logo);
            app.stage.removeChild(storyText);
            app.stage.removeChild(rulesText);
            app.stage.removeChild(startText);
            app.stage.removeChild(leaderboardButton);
            app.ticker.remove(pulseTicker);
            
            gameStarted = true;
            gameRunning = true;
            gameStartTime = Date.now();
            
            // Initialize game elements
            updateScoreDisplay();
            updateFredText();
            
            setTimeout(() => {
                if (gameRunning) {
                    spawnSingleTarget();
                }
            }, 1000);
            
            app.canvas.removeEventListener('pointerdown', handleIntroClick);
        };

        // Handle leaderboard click
        const showLeaderboardFromIntro = () => {
            app.stage.removeChild(logo);
            app.stage.removeChild(storyText);
            app.stage.removeChild(rulesText);
            app.stage.removeChild(startText);
            app.stage.removeChild(leaderboardButton);
            app.ticker.remove(pulseTicker);
            
            app.canvas.removeEventListener('pointerdown', handleIntroClick);
            showLeaderboard();
        };

        // Handle clicks on intro screen
        const handleIntroClick = (e: PointerEvent) => {
            const rect = app.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Check if click is on start button
            const startBounds = startText.getBounds();
            if (clickX >= startBounds.x && clickX <= startBounds.x + startBounds.width &&
                clickY >= startBounds.y && clickY <= startBounds.y + startBounds.height) {
                startGame();
                return;
            }
            
            // Check if click is on leaderboard button
            const leaderboardBounds = leaderboardButton.getBounds();
            if (clickX >= leaderboardBounds.x && clickX <= leaderboardBounds.x + leaderboardBounds.width &&
                clickY >= leaderboardBounds.y && clickY <= leaderboardBounds.y + leaderboardBounds.height) {
                showLeaderboardFromIntro();
                return;
            }
        };

        app.canvas.addEventListener('pointerdown', handleIntroClick);
    }

    function spawnSingleTarget() {
        // Remove current target if it exists
        if (currentTarget) {
            app.stage.removeChild(currentTarget.sprite);
            currentTarget = null;
        }
        
        if (!gameRunning) return;
        
        // Just increment counter (no more FRED refreshing during game)
        targetsSpawned++;
        
        // Create a new target
        const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        const x = Math.random() * (app.screen.width - 120) + 60;
        const y = Math.random() * (app.screen.height - 350) + 60; // Keep targets at least 100px above skraw
        
        const sprite = new Text({
            text: emoji,
            style: {
                fontSize: 48,
                fontFamily: 'Arial'
            }
        });
        
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.interactive = true;
        sprite.cursor = 'pointer';
        
        // Mark FREDS with a red glow
        const isFred = freds.includes(emoji);
        if (isFred) {
            sprite.style.dropShadow = {
                alpha: 1,
                angle: 0,
                blur: 4,
                color: '#ff0000',
                distance: 0
            };
        }
        
        app.stage.addChild(sprite);
        currentTarget = { 
            sprite, 
            fred: isFred, 
            timeLeft: TARGET_LIFETIME,
            maxTime: TARGET_LIFETIME
        };
    }

    function updateTarget(deltaTime: number) {
        if (!currentTarget) return;
        
        // Update timer
        currentTarget.timeLeft -= deltaTime;
        
        // Fade out effect as time runs out
        const fadeRatio = currentTarget.timeLeft / currentTarget.maxTime;
        currentTarget.sprite.alpha = Math.max(0.3, fadeRatio);
        
        // Scale effect to show urgency
        const scaleEffect = 1 + (1 - fadeRatio) * 0.2;
        currentTarget.sprite.scale.set(scaleEffect);
        
        // Remove target if time is up
        if (currentTarget.timeLeft <= 0) {
            app.stage.removeChild(currentTarget.sprite);
            currentTarget = null;
            
            // Spawn next target after delay
            setTimeout(() => {
                if (gameRunning) {
                    spawnSingleTarget();
                }
            }, SPAWN_DELAY);
        }
    }

    // Create the skraw (player weapon)
    const skraw = new Sprite(skrawTexture);
    skraw.anchor.set(0.5, 0); // Anchor at top center so bottom can go off-screen
    skraw.y = app.screen.height - 50; // Position so bottom extends below screen
    skraw.x = app.screen.width / 2;
    skraw.scale.set(0.5); // Adjust size as needed
    app.stage.addChild(skraw);

    function updateSkrawPosition() {
        // Keep skraw at bottom, following mouse X position
        skraw.x = Math.max(skraw.width/2, Math.min(app.screen.width - skraw.width/2, mouseX));
    }

    function fireProjectile() {
        // Create projectile
        const projectile = new Sprite(shpitballTexture);
        projectile.anchor.set(0.5);
        projectile.x = skraw.x;
        projectile.y = skraw.y; // Fire from top of skraw since anchor changed
        projectile.scale.set(0.3); // Make projectile smaller
        
        // Fire straight up vertically - no auto-aiming!
        const vx = 0; // No horizontal movement
        const vy = -PROJECTILE_SPEED; // Negative Y means going up
        
        app.stage.addChild(projectile);
        projectiles.push({ sprite: projectile, vx, vy });
    }

    function updateProjectiles() {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            
            // Move projectile
            proj.sprite.x += proj.vx;
            proj.sprite.y += proj.vy;
            
            // Check collision with current target
            if (currentTarget) {
                const dx = proj.sprite.x - currentTarget.sprite.x;
                const dy = proj.sprite.y - currentTarget.sprite.y;
                
                if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {
                    // Hit!
                    let pointsEarned = 0;
                    
                    if (currentTarget.fred) {
                        pointsEarned = -1; // Penalty for hitting a FRED
                    } else {
                        // Check if it's a long shot (target in upper 2/3 of screen)
                        const longShotLine = app.screen.height * LONG_SHOT_THRESHOLD;
                        if (currentTarget.sprite.y < longShotLine) {
                            pointsEarned = 2; // Bonus points for long shots
                        } else {
                            pointsEarned = 1; // Regular points
                        }
                    }
                    
                    score += pointsEarned;
                    
                    // Remove target and projectile
                    app.stage.removeChild(currentTarget.sprite);
                    app.stage.removeChild(proj.sprite);
                    currentTarget = null;
                    projectiles.splice(i, 1);
                    
                    updateScoreDisplay();
                    checkGameState();
                    
                    if (gameRunning) {
                        // Spawn next target after delay
                        setTimeout(() => {
                            if (gameRunning) {
                                spawnSingleTarget();
                            }
                        }, SPAWN_DELAY);
                    }
                    
                    continue;
                }
            }
            
            // Check if projectile missed (exited top of screen)
            if (proj.sprite.y < -50) {
                score -= 1; // Penalty for missing
                app.stage.removeChild(proj.sprite);
                projectiles.splice(i, 1);
                updateScoreDisplay();
                checkGameState();
                continue;
            }
            
            // Remove projectile if it goes off screen (sides or bottom)
            if (proj.sprite.x < -50 || proj.sprite.x > app.screen.width + 50 ||
                proj.sprite.y > app.screen.height + 50) {
                app.stage.removeChild(proj.sprite);
                projectiles.splice(i, 1);
            }
        }
    }

    function updateScoreDisplay() {
        scoreText.text = `Score: ${score}`;
        
        // Change color based on score
        if (score < 0) {
            scoreText.style.fill = '#ff4444'; // Red for negative
        } else if (score >= WIN_SCORE * 0.8) {
            scoreText.style.fill = '#44ff44'; // Green when close to winning
        } else {
            scoreText.style.fill = '#ffffff'; // White default
        }
    }

    function checkGameState() {
        if (score < 0 && !gameLost) {
            gameLost = true;
            gameRunning = false;
            showGameOver(false);
        } else if (score >= WIN_SCORE && !gameWon) {
            gameWon = true;
            gameRunning = false;
            showGameOver(true);
        }
    }

    function showGameOver(won: boolean) {
        // Remove current target if exists
        if (currentTarget) {
            app.stage.removeChild(currentTarget.sprite);
            currentTarget = null;
        }
        
        // Clear all projectiles
        projectiles.forEach(proj => app.stage.removeChild(proj.sprite));
        projectiles = [];
        
        const gameTime = (Date.now() - gameStartTime) / 1000; // Convert to seconds
        const timeBonus = won ? Math.max(0, 100 - Math.floor(gameTime)) : 0;
        const finalScore = score + timeBonus;
        
        // Check if this is a high score
        const highScoreInfo = isHighScore(finalScore);
        
        if (won && highScoreInfo.isHigh) {
            showHighScoreEntry(finalScore, gameTime, timeBonus, highScoreInfo.rank);
        } else {
            showRegularGameOver(won, finalScore, gameTime, timeBonus);
        }
    }

    function showHighScoreEntry(finalScore: number, gameTime: number, timeBonus: number, rank: number) {
        // High score notification
        const congratsText = new Text({
            text: `NEW HIGH SCORE!\n#${rank} on the leaderboard!\n\nFinal Score: ${finalScore}\nTime: ${gameTime.toFixed(1)}s\nTime Bonus: +${timeBonus}`,
            style: {
                fontSize: 28,
                fill: '#ffff44',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center'
            }
        });
        congratsText.anchor.set(0.5);
        congratsText.x = app.screen.width / 2;
        congratsText.y = app.screen.height / 3;
        app.stage.addChild(congratsText);

        // Initials entry
        const enterInitialsText = new Text({
            text: 'Enter your initials (3 letters):',
            style: {
                fontSize: 20,
                fill: '#ffffff',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center'
            }
        });
        enterInitialsText.anchor.set(0.5);
        enterInitialsText.x = app.screen.width / 2;
        enterInitialsText.y = app.screen.height / 2;
        app.stage.addChild(enterInitialsText);

        // Initials display
        let initials = '';
        const initialsText = new Text({
            text: '___',
            style: {
                fontSize: 32,
                fill: '#44ff44',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center',
                fontWeight: 'bold'
            }
        });
        initialsText.anchor.set(0.5);
        initialsText.x = app.screen.width / 2;
        initialsText.y = app.screen.height / 2 + 40;
        app.stage.addChild(initialsText);

        // Instructions
        const instructionsText = new Text({
            text: 'Type letters A-Z, Backspace to delete, Enter to save',
            style: {
                fontSize: 16,
                fill: '#cccccc',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center'
            }
        });
        instructionsText.anchor.set(0.5);
        instructionsText.x = app.screen.width / 2;
        instructionsText.y = app.screen.height / 2 + 80;
        app.stage.addChild(instructionsText);

        // Update initials display
        function updateInitialsDisplay() {
            let display = initials;
            while (display.length < 3) {
                display += '_';
            }
            initialsText.text = display;
        }

        // Handle keyboard input
        const handleKeyboard = (e: KeyboardEvent) => {
            if (e.key.length === 1 && e.key.match(/[a-zA-Z]/) && initials.length < 3) {
                initials += e.key.toUpperCase();
                updateInitialsDisplay();
            } else if (e.key === 'Backspace' && initials.length > 0) {
                initials = initials.slice(0, -1);
                updateInitialsDisplay();
            } else if (e.key === 'Enter' && initials.length === 3) {
                // Save to leaderboard
                addToLeaderboard(initials, finalScore, gameTime);
                
                // Remove input elements
                app.stage.removeChild(congratsText);
                app.stage.removeChild(enterInitialsText);
                app.stage.removeChild(initialsText);
                app.stage.removeChild(instructionsText);
                window.removeEventListener('keydown', handleKeyboard);
                
                // Show leaderboard
                showLeaderboard();
            }
        };

        window.addEventListener('keydown', handleKeyboard);
        updateInitialsDisplay();
    }

    function showRegularGameOver(won: boolean, finalScore: number, gameTime: number, timeBonus: number) {
        let message: string;
        let color: string;
        
        if (won) {
            message = `YOU WIN!\nScore: ${score}\nTime: ${gameTime.toFixed(1)}s\nTime Bonus: +${timeBonus}\nFinal Score: ${finalScore}`;
            color = '#44ff44';
        } else {
            message = `GAME OVER\nScore went negative!\nTime: ${gameTime.toFixed(1)}s`;
            color = '#ff4444';
        }
        
        const gameOverText = new Text({
            text: message,
            style: {
                fontSize: 32,
                fill: color,
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center'
            }
        });
        
        gameOverText.anchor.set(0.5);
        gameOverText.x = app.screen.width / 2;
        gameOverText.y = app.screen.height / 3;
        app.stage.addChild(gameOverText);

        // Show leaderboard button
        const leaderboardText = new Text({
            text: 'Click to view leaderboard',
            style: {
                fontSize: 20,
                fill: '#44ff44',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center'
            }
        });
        leaderboardText.anchor.set(0.5);
        leaderboardText.x = app.screen.width / 2;
        leaderboardText.y = app.screen.height / 2 + 40;
        app.stage.addChild(leaderboardText);

        // Handle click to show leaderboard
        const showLeaderboardClick = () => {
            app.stage.removeChild(gameOverText);
            app.stage.removeChild(leaderboardText);
            app.canvas.removeEventListener('pointerdown', showLeaderboardClick);
            showLeaderboard();
        };

        app.canvas.addEventListener('pointerdown', showLeaderboardClick);
    }

    function showLeaderboard() {
        const leaderboard = getLeaderboard();
        leaderboard.sort((a, b) => b.score - a.score);

        // Title
        const titleText = new Text({
            text: 'SHPWAT LEADERBOARD',
            style: {
                fontSize: 32,
                fill: '#ffff44',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center',
                fontWeight: 'bold'
            }
        });
        titleText.anchor.set(0.5);
        titleText.x = app.screen.width / 2;
        titleText.y = 60;
        app.stage.addChild(titleText);

        // Leaderboard entries
        const entries: Text[] = [titleText];
        if (leaderboard.length === 0) {
            const emptyText = new Text({
                text: 'No scores yet!\nBe the first to SHPWAT your way to glory!',
                style: {
                    fontSize: 20,
                    fill: '#ffffff',
                    fontFamily: 'Comic Sans MS, cursive',
                    align: 'center'
                }
            });
            emptyText.anchor.set(0.5);
            emptyText.x = app.screen.width / 2;
            emptyText.y = app.screen.height / 2;
            app.stage.addChild(emptyText);
            entries.push(emptyText);
        } else {
            for (let i = 0; i < Math.min(10, leaderboard.length); i++) {
                const entry = leaderboard[i];
                const entryText = new Text({
                    text: `${i + 1}. ${entry.initials} - ${entry.score} pts (${entry.time.toFixed(1)}s)`,
                    style: {
                        fontSize: 18,
                        fill: i < 3 ? '#ffff44' : '#ffffff', // Gold for top 3
                        fontFamily: 'Comic Sans MS, cursive',
                        align: 'center'
                    }
                });
                entryText.anchor.set(0.5);
                entryText.x = app.screen.width / 2;
                entryText.y = 120 + (i * 30);
                app.stage.addChild(entryText);
                entries.push(entryText);
            }
        }

        // Buttons
        const restartText = new Text({
            text: 'Play Again',
            style: {
                fontSize: 20,
                fill: '#44ff44',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center',
                fontWeight: 'bold'
            }
        });
        restartText.anchor.set(0.5);
        restartText.x = app.screen.width / 2 - 100;
        restartText.y = app.screen.height - 60;
        app.stage.addChild(restartText);
        entries.push(restartText);

        const backToMenuText = new Text({
            text: 'Main Menu',
            style: {
                fontSize: 20,
                fill: '#4444ff',
                fontFamily: 'Comic Sans MS, cursive',
                align: 'center',
                fontWeight: 'bold'
            }
        });
        backToMenuText.anchor.set(0.5);
        backToMenuText.x = app.screen.width / 2 + 100;
        backToMenuText.y = app.screen.height - 60;
        app.stage.addChild(backToMenuText);
        entries.push(backToMenuText);

        // Add pulsing effect to restart button
        let pulseDirection = 1;
        const pulseSpeed = 0.02;
        const pulseTicker = () => {
            if (restartText.parent) {
                restartText.alpha += pulseDirection * pulseSpeed;
                if (restartText.alpha >= 1) {
                    restartText.alpha = 1;
                    pulseDirection = -1;
                } else if (restartText.alpha <= 0.5) {
                    restartText.alpha = 0.5;
                    pulseDirection = 1;
                }
            }
        };
        app.ticker.add(pulseTicker);

        // Handle clicks on leaderboard screen
        const handleLeaderboardClick = (e: PointerEvent) => {
            const rect = app.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Check if click is on Play Again button
            const restartBounds = restartText.getBounds();
            if (clickX >= restartBounds.x && clickX <= restartBounds.x + restartBounds.width &&
                clickY >= restartBounds.y && clickY <= restartBounds.y + restartBounds.height) {
                
                // Remove all leaderboard elements
                entries.forEach(entry => {
                    if (entry.parent) {
                        app.stage.removeChild(entry);
                    }
                });
                app.ticker.remove(pulseTicker);
                
                // Reset game state and start immediately
                score = 0;
                gameStartTime = Date.now();
                gameWon = false;
                gameLost = false;
                gameRunning = true;
                gameStarted = true;
                targetsSpawned = 0;
                freds = pickFreds();
                updateScoreDisplay();
                updateFredText();
                
                setTimeout(() => {
                    if (gameRunning) {
                        spawnSingleTarget();
                    }
                }, 1000);
                
                app.canvas.removeEventListener('pointerdown', handleLeaderboardClick);
                return;
            }
            
            // Check if click is on Main Menu button
            const menuBounds = backToMenuText.getBounds();
            if (clickX >= menuBounds.x && clickX <= menuBounds.x + menuBounds.width &&
                clickY >= menuBounds.y && clickY <= menuBounds.y + menuBounds.height) {
                
                // Remove all leaderboard elements
                entries.forEach(entry => {
                    if (entry.parent) {
                        app.stage.removeChild(entry);
                    }
                });
                app.ticker.remove(pulseTicker);
                
                // Reset to intro screen state
                gameStarted = false;
                gameRunning = false;
                score = 0;
                gameWon = false;
                gameLost = false;
                targetsSpawned = 0;
                freds = pickFreds();
                
                app.canvas.removeEventListener('pointerdown', handleLeaderboardClick);
                showIntroScreen();
                return;
            }
        };

        app.canvas.addEventListener('pointerdown', handleLeaderboardClick);
    }

    // Create scoreboard
    const scoreText = new Text({
        text: 'Score: 0',
        style: {
            fontSize: 32,
            fill: '#ffffff',
            fontFamily: 'Arial'
        }
    });
    scoreText.x = 15;
    scoreText.y = 15;
    app.stage.addChild(scoreText);

    // Create FREDS display
    const fredText = new Text({
        text: 'FREDS: ' + freds.join(' '),
        style: {
            fontSize: 28,
            fill: '#ff4444',
            fontFamily: 'Arial'
        }
    });
    fredText.x = 15;
    fredText.y = 60;
    app.stage.addChild(fredText);

    function updateFredText() {
        fredText.text = 'FREDS: ' + freds.join(' ');
    }

    // Handle mouse movement
    app.canvas.addEventListener('mousemove', (e) => {
        const rect = app.canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        updateSkrawPosition();
    });

    // Handle mouse/touch clicks - now fires projectiles instead of instant hit
    app.canvas.addEventListener('pointerdown', (e) => {
        if (!gameRunning || !gameStarted) return; // Don't fire when game is over or not started
        
        const rect = app.canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        updateSkrawPosition();
        fireProjectile();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        skraw.y = app.screen.height - 50; // Keep skraw bottom off-screen
        skraw.x = app.screen.width / 2;
        mouseX = app.screen.width / 2;
        scoreText.x = 15;
        scoreText.y = 15;
        fredText.x = 15;
        fredText.y = 60;
    });

    // Game loop
    app.ticker.add((time) => {
        if (gameStarted && gameRunning) {
            updateTarget(time.deltaTime * 16.67); // Convert to milliseconds (assuming 60fps)
            updateProjectiles();
        }
    });

    // Show intro screen instead of starting game immediately
    showIntroScreen();
})();
