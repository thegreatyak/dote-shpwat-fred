import { Application, Text, Assets, Sprite, Graphics } from "pixi.js";

// Emojis for targets
const EMOJIS = [
  "😀",
  "🐶",
  "🍕",
  "🚗",
  "👻",
  "🎩",
  "🥑",
  "🍄",
  "🦄",
  "⚽",
  "🤖",
  "🎯",
  "🎪",
  "🎨",
  "🎭",
  "🎬",
  "🎵",
  "🎸",
  "🎹",
  "🎲",
  "🎳",
  "🎮",
  "🎰",
  "🚀",
  "🛸",
  "🚁",
  "🚂",
  "🚢",
  "✈️",
  "🚙",
  "🏎️",
  "🚲",
  "🛵",
  "🏠",
  "🏢",
  "🏰",
  "🗽",
  "🌟",
  "⭐",
  "🌙",
  "☀️",
  "🌈",
  "🔥",
  "💎",
  "💰",
  "💡",
  "🔔",
  "🎁",
  "🎈",
  "🎊",
  "🎉",
  "🧸",
  "🎀",
  "🍎",
  "🍌",
  "🍇",
  "🍓",
  "🍒",
  "🍑",
  "🥝",
  "🍍",
  "🥭",
  "🍊",
  "🍋",
  "🥥",
  "🥨",
  "🍔",
  "🌭",
  "🍟",
  "🍗",
  "🥓",
  "🍳",
  "🥞",
  "🧇",
  "🥯",
  "🍞",
  "🥖",
  "🧀",
  "🥪",
  "🌮",
  "🌯",
  "🥙",
  "🍲",
  "🍱",
  "🍣",
  "🍤",
  "🍝",
  "🍜",
  "🍛",
  "🍚",
  "🍘",
  "🥟",
  "🍡",
  "🍧",
  "🍨",
  "🍦",
  "🥧",
  "🍰",
  "🎂",
  "🍮",
  "🍭",
  "🍬",
  "🍫",
  "🍿",
  "🧊",
];

// Leaderboard functionality
interface LeaderboardEntry {
  initials: string;
  score: number;
  time: number;
}

function getLeaderboard(): LeaderboardEntry[] {
  const stored = localStorage.getItem("dote-shpwat-fred-leaderboard");
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
}

function saveLeaderboard(leaderboard: LeaderboardEntry[]) {
  localStorage.setItem(
    "dote-shpwat-fred-leaderboard",
    JSON.stringify(leaderboard),
  );
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
  for (let i = 0; i < 3; i++) {
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
    resizeTo: window,
  });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // Load assets
  const skrawTexture = await Assets.load("/assets/img/skraw.png");
  const shpitballTexture = await Assets.load("/assets/img/shpitball.png");
  const logoTexture = await Assets.load("/assets/img/logo.png");
  const uWinzTexture = await Assets.load("/assets/img/u_winz.png");
  const uLooseTexture = await Assets.load("/assets/img/u_loose.png");

  // Setup background music using HTML5 Audio
  const bgMusic = new Audio("/assets/audio/born_to_drive.mp3");
  bgMusic.loop = true;
  bgMusic.volume = 0.3;
  let musicEnabled = true; // Allow users to toggle music

  // Setup sound effects
  const fireSound = new Audio("/assets/audio/bwoe.wav");
  fireSound.volume = 0.5;
  const hitSound = new Audio("/assets/audio/shpwat.wav");
  hitSound.volume = 0.5;

  function playFireSound() {
    if (musicEnabled) {
      // Use music toggle to control all audio
      fireSound.currentTime = 0; // Reset to beginning for rapid fire
      fireSound.play().catch((e) => console.log("Fire sound play failed:", e));
    }
  }

  function playHitSound() {
    if (musicEnabled) {
      // Use music toggle to control all audio
      hitSound.currentTime = 0; // Reset to beginning for rapid hits
      hitSound.play().catch((e) => console.log("Hit sound play failed:", e));
    }
  }

  function startBackgroundMusic() {
    if (musicEnabled) {
      bgMusic.currentTime = 0; // Reset to beginning
      bgMusic.play().catch((e) => console.log("Audio play failed:", e));
    }
  }

  function stopBackgroundMusic() {
    bgMusic.pause();
    bgMusic.currentTime = 0; // Reset to beginning
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (musicEnabled) {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
  }

  let freds = pickFreds();
  let score = 0;
  let targets: Target[] = []; // Changed from single target to array
  let projectiles: Projectile[] = [];
  let gameRunning = false; // Start with intro screen
  let gameStarted = false;
  let targetsSpawned = 0;
  let mouseX = 0;
  let gameStartTime = Date.now();
  let gameWon = false;
  let gameLost = false;
  let hits = 0;
  let misses = 0;
  let fredHits = 0;
  let scapes = 0;
  const TARGET_LIFETIME_MIN = 1200; // Minimum time a target stays (hard mode) - made more challenging
  const TARGET_LIFETIME_MAX = 4000; // Maximum time a target stays (easy mode)
  const SPAWN_DELAY_MIN = 300; // Minimum delay between spawns (hard mode) - made more aggressive
  const SPAWN_DELAY_MAX = 1200; // Maximum delay between spawns (easy mode)
  const PROJECTILE_SPEED = 20; // Much faster projectiles
  const WIN_SCORE = 69;
  const LONG_SHOT_THRESHOLD = 2 / 3; // 2/3 of screen height for bonus points
  const DIFFICULTY_RAMP_TARGETS = 75; // How many targets to reach max difficulty - faster ramp than before
  const MAX_SIMULTANEOUS_TARGETS = 5; // Increased maximum targets on screen at once

  // Difficulty scaling functions
  function getDifficultyRatio(): number {
    return Math.min(1, targetsSpawned / DIFFICULTY_RAMP_TARGETS);
  }

  function getCurrentTargetLifetime(): number {
    const ratio = getDifficultyRatio();
    return (
      TARGET_LIFETIME_MAX - (TARGET_LIFETIME_MAX - TARGET_LIFETIME_MIN) * ratio
    );
  }

  function getCurrentSpawnDelay(): number {
    const ratio = getDifficultyRatio();
    return SPAWN_DELAY_MAX - (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN) * ratio;
  }

  function getMaxTargetsForDifficulty(): number {
    const ratio = getDifficultyRatio();
    // Start with 2 targets minimum, scale up to MAX_SIMULTANEOUS_TARGETS
    return Math.floor(2 + (MAX_SIMULTANEOUS_TARGETS - 2) * ratio);
  }

  function getFredSpawnProbability(): number {
    const ratio = getDifficultyRatio();
    // Start with base FRED probability (3/95+ emojis ≈ 3%), scale up to 35% chance
    const baseProbability = freds.length / EMOJIS.length;
    const maxProbability = 0.35; // 35% chance at max difficulty - increased from 25%
    return baseProbability + (maxProbability - baseProbability) * ratio;
  }

  function showRedPulse() {
    // Create a red overlay for the pulse effect
    const redOverlay = new Graphics();
    redOverlay.rect(0, 0, app.screen.width, app.screen.height);
    redOverlay.fill(0xff0000); // Red color
    redOverlay.alpha = 0.3; // Semi-transparent
    app.stage.addChild(redOverlay);

    // Animate the pulse effect
    let pulseAlpha = 0.3;
    const pulseFade = () => {
      pulseAlpha -= 0.02; // Fade out quickly
      redOverlay.alpha = pulseAlpha;

      if (pulseAlpha <= 0) {
        // Remove the overlay when fade is complete
        if (redOverlay.parent) {
          app.stage.removeChild(redOverlay);
        }
        app.ticker.remove(pulseFade);
      }
    };
    app.ticker.add(pulseFade);
  }

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

Today's FRED: ${freds.join(" ")}`,
      style: {
        fontSize: 18,
        fill: "#ffffff",
        fontFamily: "Comic Sans MS, cursive", // Fun hand-written style
        align: "center",
        wordWrap: true,
        wordWrapWidth: app.screen.width - 120,
      },
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
• Hit FRED = -5 points (DON'T HURT FRED!)
• Miss completely = -1 point
• Score goes negative = U LOSE
• Reach 69 points = U WIN (faster = bonus!)
• Game gets HARDER as u progress!

Move mouse to aim yer skraw
Click to fire shpitballs straight up
Work wit yer FRED to clear da rachet!`,
      style: {
        fontSize: 14,
        fill: "#dddddd",
        fontFamily: "Comic Sans MS, cursive", // Match the hand-written style
        align: "center",
        wordWrap: true,
        wordWrapWidth: app.screen.width - 120,
      },
    });
    rulesText.anchor.set(0.5);
    rulesText.x = app.screen.width / 2;
    rulesText.y = (app.screen.height * 5) / 6; // Bottom third of screen
    app.stage.addChild(rulesText);

    // Create start button - at very bottom
    const startText = new Text({
      text: "CLICK TO START SHPWATTING!",
      style: {
        fontSize: 22,
        fill: "#44ff44",
        fontFamily: "Comic Sans MS, cursive", // Consistent font
        align: "center",
        fontWeight: "bold",
      },
    });
    startText.anchor.set(0.5);
    startText.x = app.screen.width / 2;
    startText.y = app.screen.height - 70; // Moved up to make room for leaderboard button
    app.stage.addChild(startText);

    // Create leaderboard button
    const leaderboardButton = new Text({
      text: "View Leaderboard",
      style: {
        fontSize: 16,
        fill: "#ffff44",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
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

      // Start background music
      startBackgroundMusic();

      // Initialize game elements
      updateScoreDisplay();
      updateFredText();

      // Start spawning targets
      setTimeout(() => {
        if (gameRunning) {
          spawnTargets();
        }
      }, 1000);

      app.canvas.removeEventListener("pointerdown", handleIntroClick);
    };

    // Handle leaderboard click
    const showLeaderboardFromIntro = () => {
      app.stage.removeChild(logo);
      app.stage.removeChild(storyText);
      app.stage.removeChild(rulesText);
      app.stage.removeChild(startText);
      app.stage.removeChild(leaderboardButton);
      app.ticker.remove(pulseTicker);

      app.canvas.removeEventListener("pointerdown", handleIntroClick);
      showLeaderboard();
    };

    // Handle clicks on intro screen
    const handleIntroClick = (e: PointerEvent) => {
      const rect = app.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Check if click is on music button - if so, ignore (handled by PIXI event)
      if (isClickOnMusicButton(clickX, clickY)) {
        return;
      }

      // Check if click is on leaderboard button - if so, show leaderboard
      const leaderboardBounds = leaderboardButton.getBounds();
      if (
        clickX >= leaderboardBounds.x &&
        clickX <= leaderboardBounds.x + leaderboardBounds.width &&
        clickY >= leaderboardBounds.y &&
        clickY <= leaderboardBounds.y + leaderboardBounds.height
      ) {
        showLeaderboardFromIntro();
        return;
      }

      // Any other click starts the game
      startGame();
    };

    app.canvas.addEventListener("pointerdown", handleIntroClick);
  }

  function spawnTargets() {
    if (!gameRunning) return;

    const maxTargets = getMaxTargetsForDifficulty();

    // Always spawn at least one target if we're below max
    if (targets.length < maxTargets) {
      spawnSingleTarget();
    }

    // Schedule next spawn check - guaranteed spawn every second at most
    setTimeout(() => {
      if (gameRunning) {
        spawnTargets();
      }
    }, getCurrentSpawnDelay());
  }

  function spawnSingleTarget() {
    if (!gameRunning) return;

    // Just increment counter
    targetsSpawned++;

    // Determine if this should be a FRED based on increasing probability
    const fredProbability = getFredSpawnProbability();
    const shouldBeFred = Math.random() < fredProbability;

    // Create a new target
    let emoji: string;
    if (shouldBeFred) {
      // Pick a random FRED
      emoji = freds[Math.floor(Math.random() * freds.length)];
    } else {
      // Pick a random non-FRED emoji
      const nonFredEmojis = EMOJIS.filter((e) => !freds.includes(e));
      emoji = nonFredEmojis[Math.floor(Math.random() * nonFredEmojis.length)];
    }

    const x = Math.random() * (app.screen.width - 120) + 60;
    const y = Math.random() * (app.screen.height - 350) + 60; // Keep targets at least 100px above skraw

    const sprite = new Text({
      text: emoji,
      style: {
        fontSize: 48,
        fontFamily: "Arial",
      },
    });

    sprite.anchor.set(0.5);
    sprite.x = x;
    sprite.y = y;
    sprite.interactive = true;
    sprite.cursor = "pointer";

    // Check if it's a FRED
    const isFred = freds.includes(emoji);

    app.stage.addChild(sprite);
    const target: Target = {
      sprite,
      fred: isFred,
      timeLeft: getCurrentTargetLifetime(),
      maxTime: getCurrentTargetLifetime(),
    };

    targets.push(target);
  }

  function updateTargets(deltaTime: number) {
    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i];

      // Update timer
      target.timeLeft -= deltaTime;

      // Fade out effect as time runs out
      const fadeRatio = target.timeLeft / target.maxTime;
      target.sprite.alpha = Math.max(0.3, fadeRatio);

      // Scale effect to show urgency
      const scaleEffect = 1 + (1 - fadeRatio) * 0.2;
      target.sprite.scale.set(scaleEffect);

      // Remove target if time is up
      if (target.timeLeft <= 0) {
        // Only count as scape and lose points if it's an enemy (not a FRED)
        if (!target.fred) {
          scapes++;
          score -= 1; // Lose point for letting enemy escape
          updateScoreDisplay();
          checkGameState();
        }
        app.stage.removeChild(target.sprite);
        targets.splice(i, 1);
      }
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
    skraw.x = Math.max(
      skraw.width / 2,
      Math.min(app.screen.width - skraw.width / 2, mouseX),
    );
  }

  function fireProjectile() {
    // Play fire sound effect
    playFireSound();

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

      // Check collision with any target
      let hit = false;
      for (let j = targets.length - 1; j >= 0; j--) {
        const target = targets[j];
        const dx = proj.sprite.x - target.sprite.x;
        const dy = proj.sprite.y - target.sprite.y;

        if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {
          // Hit! Play hit sound effect
          playHitSound();

          let pointsEarned = 0;

          if (target.fred) {
            pointsEarned = -5; // Heavy penalty for hitting a FRED
            fredHits++;
            showRedPulse(); // Show red pulse effect for FRED hit
          } else {
            hits++;
            // Check if it's a long shot (target in upper 2/3 of screen)
            const longShotLine = app.screen.height * LONG_SHOT_THRESHOLD;
            if (target.sprite.y < longShotLine) {
              pointsEarned = 2; // Bonus points for long shots
            } else {
              pointsEarned = 1; // Regular points
            }
          }

          score += pointsEarned;

          // Remove target and projectile
          app.stage.removeChild(target.sprite);
          app.stage.removeChild(proj.sprite);
          targets.splice(j, 1);
          projectiles.splice(i, 1);

          updateScoreDisplay();
          checkGameState();

          hit = true;
          break;
        }
      }

      if (hit) continue;

      // Check if projectile missed (exited top of screen)
      if (proj.sprite.y < -50) {
        score -= 1; // Penalty for missing
        misses++;
        app.stage.removeChild(proj.sprite);
        projectiles.splice(i, 1);
        updateScoreDisplay();
        checkGameState();
        continue;
      }

      // Remove projectile if it goes off screen (sides or bottom)
      if (
        proj.sprite.x < -50 ||
        proj.sprite.x > app.screen.width + 50 ||
        proj.sprite.y > app.screen.height + 50
      ) {
        app.stage.removeChild(proj.sprite);
        projectiles.splice(i, 1);
      }
    }
  }

  function updateScoreDisplay() {
    scoreText.text = `Score: ${score}`;

    // Change color based on score
    if (score < 0) {
      scoreText.style.fill = "#ff4444"; // Red for negative
    } else if (score >= WIN_SCORE * 0.8) {
      scoreText.style.fill = "#44ff44"; // Green when close to winning
    } else {
      scoreText.style.fill = "#ffffff"; // White default
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
    // Remove all targets
    targets.forEach((target) => {
      if (target.sprite.parent) {
        app.stage.removeChild(target.sprite);
      }
    });
    targets = [];

    // Clear all projectiles
    projectiles.forEach((proj) => app.stage.removeChild(proj.sprite));
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

  function showHighScoreEntry(
    finalScore: number,
    gameTime: number,
    timeBonus: number,
    rank: number,
  ) {
    // Add win image at top with space
    const winImage = new Sprite(uWinzTexture);
    winImage.anchor.set(0.5);
    winImage.x = app.screen.width / 2;
    winImage.y = app.screen.height / 8; // Position higher up to give it dedicated space
    winImage.scale.set(0.3); // Adjust size as needed
    app.stage.addChild(winImage);

    // High score notification - moved down to avoid overlap
    const congratsText = new Text({
      text: `NEW HIGH SCORE!\n#${rank} on the leaderboard!\n\nFinal Score: ${finalScore}\nTime: ${gameTime.toFixed(1)}s\nTime Bonus: +${timeBonus}`,
      style: {
        fontSize: 24,
        fill: "#ffff44",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    congratsText.anchor.set(0.5);
    congratsText.x = app.screen.width / 2;
    congratsText.y = app.screen.height / 3; // Moved further down to create more space from the image
    app.stage.addChild(congratsText);

    // Create colored recap
    const recapTitle = new Text({
      text: "RECAP:",
      style: {
        fontSize: 22,
        fill: "#ffffff",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
        fontWeight: "bold",
      },
    });
    recapTitle.anchor.set(0.5);
    recapTitle.x = app.screen.width / 2;
    recapTitle.y = app.screen.height / 3 + 120; // Adjusted to follow the moved congratulations text
    app.stage.addChild(recapTitle);

    const hitsText = new Text({
      text: `Enemy Hits: ${hits}`,
      style: {
        fontSize: 22,
        fill: "#44ff44", // Green for good hits
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    hitsText.anchor.set(0.5);
    hitsText.x = app.screen.width / 2;
    hitsText.y = app.screen.height / 3 + 160; // Adjusted spacing
    app.stage.addChild(hitsText);

    const missesText = new Text({
      text: `Misses: -${misses}`,
      style: {
        fontSize: 22,
        fill: "#ff4444", // Red for bad misses
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    missesText.anchor.set(0.5);
    missesText.x = app.screen.width / 2;
    missesText.y = app.screen.height / 3 + 190; // Adjusted spacing
    app.stage.addChild(missesText);

    const fredHitsText = new Text({
      text: `FREDs Hit: -${fredHits}`,
      style: {
        fontSize: 22,
        fill: "#ff4444", // Red for bad FRED hits
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    fredHitsText.anchor.set(0.5);
    fredHitsText.x = app.screen.width / 2;
    fredHitsText.y = app.screen.height / 3 + 220; // Adjusted spacing
    app.stage.addChild(fredHitsText);

    const scapesText = new Text({
      text: `Scapes: -${scapes}`,
      style: {
        fontSize: 22,
        fill: "#ff4444", // Red for bad scapes
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    scapesText.anchor.set(0.5);
    scapesText.x = app.screen.width / 2;
    scapesText.y = app.screen.height / 3 + 250; // Adjusted spacing
    app.stage.addChild(scapesText);

    // Initials entry
    const enterInitialsText = new Text({
      text: "Enter your initials (3 letters):",
      style: {
        fontSize: 20,
        fill: "#ffffff",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    enterInitialsText.anchor.set(0.5);
    enterInitialsText.x = app.screen.width / 2;
    enterInitialsText.y = app.screen.height / 3 + 300; // Adjusted to follow the recap
    app.stage.addChild(enterInitialsText);

    // Initials display
    let initials = "";
    const initialsText = new Text({
      text: "___",
      style: {
        fontSize: 32,
        fill: "#44ff44",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
        fontWeight: "bold",
      },
    });
    initialsText.anchor.set(0.5);
    initialsText.x = app.screen.width / 2;
    initialsText.y = app.screen.height / 3 + 340; // Adjusted spacing
    app.stage.addChild(initialsText);

    // Instructions
    const instructionsText = new Text({
      text: "Type letters A-Z, Backspace to delete, Enter to save",
      style: {
        fontSize: 16,
        fill: "#cccccc",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    instructionsText.anchor.set(0.5);
    instructionsText.x = app.screen.width / 2;
    instructionsText.y = app.screen.height / 3 + 380; // Adjusted spacing
    app.stage.addChild(instructionsText);

    // Music credit
    const musicCreditText = new Text({
      text: "Music: AudioCoffee - Born To Drive (loop ver.2)",
      style: {
        fontSize: 12,
        fill: "#888888",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    musicCreditText.anchor.set(0.5);
    musicCreditText.x = app.screen.width / 2;
    musicCreditText.y = app.screen.height - 40; // Bottom of screen
    app.stage.addChild(musicCreditText);

    // Update initials display
    function updateInitialsDisplay() {
      let display = initials;
      while (display.length < 3) {
        display += "_";
      }
      initialsText.text = display;
    }

    // Handle keyboard input
    const handleKeyboard = (e: KeyboardEvent) => {
      if (
        e.key.length === 1 &&
        e.key.match(/[a-zA-Z]/) &&
        initials.length < 3
      ) {
        initials += e.key.toUpperCase();
        updateInitialsDisplay();
      } else if (e.key === "Backspace" && initials.length > 0) {
        initials = initials.slice(0, -1);
        updateInitialsDisplay();
      } else if (e.key === "Enter" && initials.length === 3) {
        // Save to leaderboard
        addToLeaderboard(initials, finalScore, gameTime);

        // Remove input elements
        app.stage.removeChild(winImage);
        app.stage.removeChild(congratsText);
        app.stage.removeChild(recapTitle);
        app.stage.removeChild(hitsText);
        app.stage.removeChild(missesText);
        app.stage.removeChild(fredHitsText);
        app.stage.removeChild(scapesText);
        app.stage.removeChild(enterInitialsText);
        app.stage.removeChild(initialsText);
        app.stage.removeChild(instructionsText);
        app.stage.removeChild(musicCreditText);
        window.removeEventListener("keydown", handleKeyboard);

        // Show leaderboard
        showLeaderboard();
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    updateInitialsDisplay();
  }

  function showRegularGameOver(
    won: boolean,
    finalScore: number,
    gameTime: number,
    timeBonus: number,
  ) {
    let message: string;
    let color: string;

    if (won) {
      message = `YOU WIN!\nScore: ${score}\nTime: ${gameTime.toFixed(1)}s\nTime Bonus: +${timeBonus}\nFinal Score: ${finalScore}`;
      color = "#44ff44";
    } else {
      message = `GAME OVER\nScore went negative!\nTime: ${gameTime.toFixed(1)}s`;
      color = "#ff4444";
    }

    const gameOverText = new Text({
      text: message,
      style: {
        fontSize: 24,
        fill: color,
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });

    gameOverText.anchor.set(0.5);
    gameOverText.x = app.screen.width / 2;
    gameOverText.y = app.screen.height / 3; // Keep game over text in same position
    app.stage.addChild(gameOverText);

    // Add appropriate image positioned at top with proper spacing
    const resultImage = new Sprite(won ? uWinzTexture : uLooseTexture);
    resultImage.anchor.set(0.5);
    resultImage.x = app.screen.width / 2;
    resultImage.y = app.screen.height / 8; // Position at top like win image for consistent spacing
    resultImage.scale.set(0.3); // Adjust size as needed
    app.stage.addChild(resultImage);

    // Create colored recap
    const recapTitle = new Text({
      text: "RECAP:",
      style: {
        fontSize: 24,
        fill: "#ffffff",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
        fontWeight: "bold",
      },
    });
    recapTitle.anchor.set(0.5);
    recapTitle.x = app.screen.width / 2;
    recapTitle.y = app.screen.height / 3 + 140;
    app.stage.addChild(recapTitle);

    const hitsText = new Text({
      text: `Enemy Hits: ${hits}`,
      style: {
        fontSize: 24,
        fill: "#44ff44", // Green for good hits
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    hitsText.anchor.set(0.5);
    hitsText.x = app.screen.width / 2;
    hitsText.y = app.screen.height / 3 + 190;
    app.stage.addChild(hitsText);

    const missesText = new Text({
      text: `Misses: -${misses}`,
      style: {
        fontSize: 24,
        fill: "#ff4444", // Red for bad misses
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    missesText.anchor.set(0.5);
    missesText.x = app.screen.width / 2;
    missesText.y = app.screen.height / 3 + 230;
    app.stage.addChild(missesText);

    const fredHitsText = new Text({
      text: `FREDs Hit: -${fredHits}`,
      style: {
        fontSize: 24,
        fill: "#ff4444", // Red for bad FRED hits
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    fredHitsText.anchor.set(0.5);
    fredHitsText.x = app.screen.width / 2;
    fredHitsText.y = app.screen.height / 3 + 270;
    app.stage.addChild(fredHitsText);

    const scapesText = new Text({
      text: `Scapes: -${scapes}`,
      style: {
        fontSize: 24,
        fill: "#ff4444", // Red for bad scapes
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    scapesText.anchor.set(0.5);
    scapesText.x = app.screen.width / 2;
    scapesText.y = app.screen.height / 3 + 310;
    app.stage.addChild(scapesText);

    // Music credit
    const musicCreditText = new Text({
      text: "Music: AudioCoffee - Born To Drive (loop ver.2)",
      style: {
        fontSize: 12,
        fill: "#888888",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    musicCreditText.anchor.set(0.5);
    musicCreditText.x = app.screen.width / 2;
    musicCreditText.y = app.screen.height - 40; // Bottom of screen
    app.stage.addChild(musicCreditText);

    // Show leaderboard button
    const leaderboardText = new Text({
      text: "Click to view leaderboard",
      style: {
        fontSize: 20,
        fill: "#44ff44",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
      },
    });
    leaderboardText.anchor.set(0.5);
    leaderboardText.x = app.screen.width / 2;
    leaderboardText.y = app.screen.height / 3 + 370;
    app.stage.addChild(leaderboardText);

    // Handle click to show leaderboard
    const showLeaderboardClick = (e: PointerEvent) => {
      const rect = app.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Check if click is on music button - if so, ignore
      if (isClickOnMusicButton(clickX, clickY)) {
        return;
      }

      app.stage.removeChild(resultImage);
      app.stage.removeChild(gameOverText);
      app.stage.removeChild(recapTitle);
      app.stage.removeChild(hitsText);
      app.stage.removeChild(missesText);
      app.stage.removeChild(fredHitsText);
      app.stage.removeChild(scapesText);
      app.stage.removeChild(musicCreditText);
      app.stage.removeChild(leaderboardText);
      app.canvas.removeEventListener("pointerdown", showLeaderboardClick);
      showLeaderboard();
    };

    app.canvas.addEventListener("pointerdown", showLeaderboardClick);
  }

  function showLeaderboard() {
    const leaderboard = getLeaderboard();
    leaderboard.sort((a, b) => b.score - a.score);

    // Title
    const titleText = new Text({
      text: "SHPWAT LEADERBOARD",
      style: {
        fontSize: 32,
        fill: "#ffff44",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
        fontWeight: "bold",
      },
    });
    titleText.anchor.set(0.5);
    titleText.x = app.screen.width / 2;
    titleText.y = 60;
    app.stage.addChild(titleText);

    // Leaderboard entries
    const entries: Text[] = [titleText];
    if (leaderboard.length === 0) {
      const emptyText = new Text({
        text: "No scores yet!\nBe the first to SHPWAT your way to glory!",
        style: {
          fontSize: 20,
          fill: "#ffffff",
          fontFamily: "Comic Sans MS, cursive",
          align: "center",
        },
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
            fill: i < 3 ? "#ffff44" : "#ffffff", // Gold for top 3
            fontFamily: "Comic Sans MS, cursive",
            align: "center",
          },
        });
        entryText.anchor.set(0.5);
        entryText.x = app.screen.width / 2;
        entryText.y = 120 + i * 30;
        app.stage.addChild(entryText);
        entries.push(entryText);
      }
    }

    // Buttons
    const restartText = new Text({
      text: "Play Again",
      style: {
        fontSize: 20,
        fill: "#44ff44",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
        fontWeight: "bold",
      },
    });
    restartText.anchor.set(0.5);
    restartText.x = app.screen.width / 2 - 100;
    restartText.y = app.screen.height - 60;
    app.stage.addChild(restartText);
    entries.push(restartText);

    const backToMenuText = new Text({
      text: "Main Menu",
      style: {
        fontSize: 20,
        fill: "#4444ff",
        fontFamily: "Comic Sans MS, cursive",
        align: "center",
        fontWeight: "bold",
      },
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

      // Check if click is on music button - if so, ignore (handled by PIXI event)
      if (isClickOnMusicButton(clickX, clickY)) {
        return;
      }

      // Check if click is on Play Again button
      const restartBounds = restartText.getBounds();
      if (
        clickX >= restartBounds.x &&
        clickX <= restartBounds.x + restartBounds.width &&
        clickY >= restartBounds.y &&
        clickY <= restartBounds.y + restartBounds.height
      ) {
        // Remove all leaderboard elements
        entries.forEach((entry) => {
          if (entry.parent) {
            app.stage.removeChild(entry);
          }
        });
        app.ticker.remove(pulseTicker);

        // Reset game state and start immediately
        score = 0;
        hits = 0;
        misses = 0;
        fredHits = 0;
        scapes = 0;
        gameStartTime = Date.now();
        gameWon = false;
        gameLost = false;
        gameRunning = true;
        gameStarted = true;
        targetsSpawned = 0;
        targets = []; // Clear targets array
        freds = pickFreds();
        updateScoreDisplay();
        updateFredText();

        // Start background music
        startBackgroundMusic();

        setTimeout(() => {
          if (gameRunning) {
            spawnTargets();
          }
        }, 1000);

        app.canvas.removeEventListener("pointerdown", handleLeaderboardClick);
        return;
      }

      // Check if click is on Main Menu button
      const menuBounds = backToMenuText.getBounds();
      if (
        clickX >= menuBounds.x &&
        clickX <= menuBounds.x + menuBounds.width &&
        clickY >= menuBounds.y &&
        clickY <= menuBounds.y + menuBounds.height
      ) {
        // Remove all leaderboard elements
        entries.forEach((entry) => {
          if (entry.parent) {
            app.stage.removeChild(entry);
          }
        });
        app.ticker.remove(pulseTicker);

        // Reset to intro screen state
        gameStarted = false;
        gameRunning = false;
        score = 0;
        hits = 0;
        misses = 0;
        fredHits = 0;
        scapes = 0;
        gameWon = false;
        gameLost = false;
        targetsSpawned = 0;
        targets = []; // Clear targets array
        freds = pickFreds();
        updateFredText(); // Update the display to show new FREDs

        app.canvas.removeEventListener("pointerdown", handleLeaderboardClick);
        showIntroScreen();
        return;
      }
    };

    app.canvas.addEventListener("pointerdown", handleLeaderboardClick);
  }

  // Create scoreboard
  const scoreText = new Text({
    text: "Score: 0",
    style: {
      fontSize: 32,
      fill: "#ffffff",
      fontFamily: "Arial",
    },
  });
  scoreText.x = 15;
  scoreText.y = 15;
  app.stage.addChild(scoreText);

  // Create FREDS display
  const fredText = new Text({
    text: "FREDS: " + freds.join(" "),
    style: {
      fontSize: 28,
      fill: "#ff4444",
      fontFamily: "Arial",
    },
  });
  fredText.x = 15;
  fredText.y = 60;
  app.stage.addChild(fredText);

  function updateFredText() {
    fredText.text = "FREDS: " + freds.join(" ");
  }

  // Create persistent music toggle button (always visible)
  const persistentMusicButton = new Text({
    text: musicEnabled ? "♪ ON" : "♪ OFF",
    style: {
      fontSize: 18,
      fill: musicEnabled ? "#44ff44" : "#ff4444",
      fontFamily: "Comic Sans MS, cursive",
      align: "left",
    },
  });
  persistentMusicButton.x = 15;
  persistentMusicButton.y = app.screen.height - 30;
  persistentMusicButton.interactive = true;
  persistentMusicButton.cursor = "pointer";
  app.stage.addChild(persistentMusicButton);

  function updatePersistentMusicButton() {
    persistentMusicButton.text = musicEnabled ? "♪ ON" : "♪ OFF";
    persistentMusicButton.style.fill = musicEnabled ? "#44ff44" : "#ff4444";
  }

  // Handle persistent music button clicks
  persistentMusicButton.on("pointerdown", (e) => {
    e.stopPropagation(); // Prevent other click handlers from firing
    toggleMusic();
    updatePersistentMusicButton();
  });

  // Helper function to check if click is on music button
  function isClickOnMusicButton(clientX: number, clientY: number): boolean {
    const musicBounds = persistentMusicButton.getBounds();
    return (
      clientX >= musicBounds.x &&
      clientX <= musicBounds.x + musicBounds.width &&
      clientY >= musicBounds.y &&
      clientY <= musicBounds.y + musicBounds.height
    );
  }

  // Handle mouse movement
  app.canvas.addEventListener("mousemove", (e) => {
    const rect = app.canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    updateSkrawPosition();
  });

  // Handle mouse/touch clicks - now fires projectiles instead of instant hit
  app.canvas.addEventListener("pointerdown", (e) => {
    if (!gameRunning || !gameStarted) return; // Don't fire when game is over or not started

    const rect = app.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if click is on music button - if so, don't fire
    if (isClickOnMusicButton(clickX, clickY)) {
      return;
    }

    mouseX = clickX;
    updateSkrawPosition();
    fireProjectile();
  });

  // Handle window resize - reload page for proper scaling
  window.addEventListener("resize", () => {
    // Reload the page to ensure proper scaling and layout
    window.location.reload();
  });

  // Game loop
  app.ticker.add((time) => {
    if (gameStarted && gameRunning) {
      updateTargets(time.deltaTime * 16.67); // Convert to milliseconds (assuming 60fps)
      updateProjectiles();
    }
  });

  // Show intro screen instead of starting game immediately
  showIntroScreen();
})();
