import { Application, Graphics, Text, Assets, Sprite } from "pixi.js";

// Emojis for targets
const EMOJIS = ['😀','🐶','🍕','🚗','👻','🎩','🥑','🍄','🦄','⚽','🤖'];

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

    let freds = pickFreds();
    let score = 0;
    let currentTarget: Target | null = null;
    let projectiles: Projectile[] = [];
    let gameRunning = true;
    let targetsSpawned = 0;
    let mouseX = 0;
    const TARGET_LIFETIME = 2000; // 2 seconds in milliseconds
    const SPAWN_DELAY = 500; // 0.5 seconds between targets
    const FREDS_REFRESH_INTERVAL = 10; // Change FREDS every 10 targets
    const PROJECTILE_SPEED = 20; // Much faster projectiles

    function spawnSingleTarget() {
        // Remove current target if it exists
        if (currentTarget) {
            app.stage.removeChild(currentTarget.sprite);
            currentTarget = null;
        }
        
        if (!gameRunning) return;
        
        // Refresh FREDS periodically
        targetsSpawned++;
        if (targetsSpawned % FREDS_REFRESH_INTERVAL === 0) {
            freds = pickFreds();
            updateFredText();
        }
        
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
                    if (currentTarget.fred) {
                        score -= 1; // Penalty for hitting a FRED
                    } else {
                        score += 1; // Points for hitting regular target
                    }
                    
                    // Remove target and projectile
                    app.stage.removeChild(currentTarget.sprite);
                    app.stage.removeChild(proj.sprite);
                    currentTarget = null;
                    projectiles.splice(i, 1);
                    scoreText.text = `Score: ${score}`;
                    
                    // Spawn next target after delay
                    setTimeout(() => {
                        if (gameRunning) {
                            spawnSingleTarget();
                        }
                    }, SPAWN_DELAY);
                    
                    continue;
                }
            }
            
            // Remove projectile if it goes off screen
            if (proj.sprite.x < -50 || proj.sprite.x > app.screen.width + 50 ||
                proj.sprite.y < -50 || proj.sprite.y > app.screen.height + 50) {
                app.stage.removeChild(proj.sprite);
                projectiles.splice(i, 1);
            }
        }
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
        updateTarget(time.deltaTime * 16.67); // Convert to milliseconds (assuming 60fps)
        updateProjectiles();
    });

    // Start the game with first target after a short delay
    setTimeout(() => {
        spawnSingleTarget();
    }, 1000); // 1 second delay before first target
})();
