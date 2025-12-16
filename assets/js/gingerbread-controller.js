/**
 * Gingerbread Controller for Christmas Theme
 * Extends BugDispatch for gingerbread men that run across screen
 * Click to hit them - they fall when clicked
 *
 * Two types:
 * - Runners: Use East/West rows, run across screen
 * - Wigglers: Use South row, dance in place
 */

var GINGERBREAD_SPRITE = 'assets/christmas/sprites/gingerbread_sheet.png';
var GINGERBREAD_FRAME_WIDTH = 48;
var GINGERBREAD_FRAME_HEIGHT = 64;
var GINGERBREAD_COLS = 3;  // 3 frames per direction
var GINGERBREAD_ROWS = 4;  // S, W, E, N directions
var GINGERBREAD_SCALE = 2; // Scale factor for display

// Row indices for directions (in SWEN sprite sheet)
var DIR_SOUTH = 0;  // Facing user, wiggle
var DIR_WEST = 1;   // Running left
var DIR_EAST = 2;   // Running right
var DIR_NORTH = 3;  // Facing away

// Gingerbread types
var TYPE_RUNNER = 'runner';      // Uses East/West rows based on direction
var TYPE_WIGGLER = 'wiggler';    // Uses South row (facing user) while moving

// Gift counter and streak tracking
var GiftCounter = 0;
var StreakCounter = 0;
var HighestStreakCounter = 0;
var GingerbreadStatsKey = 'christmas-gingerbread-stats';

/**
 * Load saved stats from localStorage
 */
function loadGingerbreadStats() {
    try {
        var saved = localStorage.getItem(GingerbreadStatsKey);
        if (saved) {
            var stats = JSON.parse(saved);
            GiftCounter = stats.gifts || 0;
            StreakCounter = stats.currentStreak || 0;
            HighestStreakCounter = stats.highestStreak || 0;
            if (StreakCounter > HighestStreakCounter) {
                HighestStreakCounter = StreakCounter;
            }
            return stats;
        }
    } catch (e) {
        console.warn('Could not load gingerbread stats:', e);
    }
    return { gifts: 0, currentStreak: 0, highestStreak: 0 };
}

/**
 * Save stats to localStorage
 */
function saveGingerbreadStats() {
    try {
        var stats = {
            gifts: GiftCounter,
            currentStreak: StreakCounter,
            highestStreak: HighestStreakCounter,
            lastPlayed: new Date().toISOString()
        };
        localStorage.setItem(GingerbreadStatsKey, JSON.stringify(stats));
    } catch (e) {
        console.warn('Could not save gingerbread stats:', e);
    }
}

/**
 * Increment gift counter
 */
function incrementGiftCounter() {
    GiftCounter++;
    saveGingerbreadStats();

    // Start audio on first hit
    if (typeof window.startChristmasAudioOnFirstHit === 'function') {
        window.startChristmasAudioOnFirstHit();
    } else {
        // Flag for later if audio setup hasn't completed yet
        window._christmasAudioRequested = true;
    }

    var countEl = document.getElementById('gift-count');
    if (countEl) {
        countEl.textContent = GiftCounter;
        countEl.classList.remove('pulse');
        void countEl.offsetWidth;
        countEl.classList.add('pulse');
        setTimeout(function() {
            countEl.classList.remove('pulse');
        }, 400);
    }
}

/**
 * Increment streak counter
 */
function incrementStreakCounter() {
    StreakCounter++;

    var streakEl = document.getElementById('streak-count');
    if (streakEl) {
        streakEl.textContent = StreakCounter;
        streakEl.classList.remove('pulse');
        void streakEl.offsetWidth;
        streakEl.classList.add('pulse');
        setTimeout(function() {
            streakEl.classList.remove('pulse');
        }, 400);
    }

    var newRecord = false;
    if (StreakCounter > HighestStreakCounter) {
        HighestStreakCounter = StreakCounter;
        newRecord = true;
    }
    updateHighestStreakDisplay({ pulse: newRecord, newRecord: newRecord });
    saveGingerbreadStats();
}

/**
 * Reset streak counter
 */
function resetStreakCounter() {
    if (StreakCounter === 0) return;

    StreakCounter = 0;

    var streakEl = document.getElementById('streak-count');
    if (streakEl) {
        streakEl.textContent = '0';
        streakEl.classList.remove('streak-broken');
        void streakEl.offsetWidth;
        streakEl.classList.add('streak-broken');
        setTimeout(function() {
            streakEl.classList.remove('streak-broken');
        }, 500);
    }

    saveGingerbreadStats();
}

/**
 * Update counter displays
 */
function updateCounterDisplays() {
    var giftEl = document.getElementById('gift-count');
    if (giftEl) {
        giftEl.textContent = GiftCounter;
    }

    var streakEl = document.getElementById('streak-count');
    if (streakEl) {
        streakEl.textContent = StreakCounter;
    }

    updateHighestStreakDisplay({ resetHighlight: true });
}

function updateHighestStreakDisplay(options) {
    var bestEl = document.getElementById('highest-streak-count');
    if (!bestEl) return;

    bestEl.textContent = HighestStreakCounter;

    if (options && options.pulse) {
        bestEl.classList.remove('pulse');
        void bestEl.offsetWidth;
        bestEl.classList.add('pulse');
        setTimeout(function() {
            bestEl.classList.remove('pulse');
        }, 400);
    }

    if (options && options.resetHighlight) {
        bestEl.classList.remove('new-record');
    }

    if (options && options.newRecord) {
        bestEl.classList.remove('new-record');
        void bestEl.offsetWidth;
        bestEl.classList.add('new-record');
        setTimeout(function() {
            bestEl.classList.remove('new-record');
        }, 800);
    }
}

var GingerbreadController = function() {
    var gingerbreadOptions = {
        imageSprite: GINGERBREAD_SPRITE,
        bugWidth: GINGERBREAD_FRAME_WIDTH,
        bugHeight: GINGERBREAD_FRAME_HEIGHT,
        num_frames: GINGERBREAD_COLS,

        canFly: false,
        canDie: true,
        numDeathTypes: 1,

        zoom: 1,

        minDelay: 800,
        maxDelay: 4000,

        minSpeed: 8,
        maxSpeed: 18,

        minBugs: 4,
        maxBugs: 6,

        mouseOver: 'nothing'
    };

    this.options = mergeOptions(this.options, gingerbreadOptions);
    this.initialize.apply(this, arguments);
};

// Extend BugDispatch prototype
GingerbreadController.prototype = Object.create(BugDispatch);
GingerbreadController.prototype.constructor = GingerbreadController;

/**
 * Initialize controller
 */
GingerbreadController.prototype.initialize = function(options) {
    BugDispatch.initialize.call(this, options);

    for (var i = 0; i < this.bugs.length; i++) {
        // Randomly assign type - 30% chance of wiggler
        var type = Math.random() < 0.3 ? TYPE_WIGGLER : TYPE_RUNNER;
        this.patchGingerbreadBehaviors(this.bugs[i], type);
    }

    this.ensurePopulation();
    this.startPopulationMonitor();

    loadGingerbreadStats();
    setTimeout(function() {
        updateCounterDisplays();
    }, 100);

    window.resetStreakCounter = resetStreakCounter;
};

/**
 * Patch individual gingerbread instance
 * @param {Object} gingerbread - The bug instance
 * @param {string} type - TYPE_RUNNER (uses East/West) or TYPE_WIGGLER (uses South)
 */
GingerbreadController.prototype.patchGingerbreadBehaviors = function(gingerbread, type) {
    if (!gingerbread || !gingerbread.bug) return;

    var controller = this;
    var scale = GINGERBREAD_SCALE;
    var isWiggler = type === TYPE_WIGGLER;

    if (gingerbread._gingerbreadPatched) {
        gingerbread.walkFrameCounter = 0;
        gingerbread.walkIndex = 0;
        gingerbread._lastX = undefined;
        gingerbread._movingRight = Math.random() > 0.5;
        // Wigglers always use South row, runners use East/West
        if (gingerbread._type === TYPE_WIGGLER) {
            gingerbread._currentRow = DIR_SOUTH;
        } else {
            gingerbread._currentRow = gingerbread._movingRight ? DIR_EAST : DIR_WEST;
        }
        gingerbread.alive = true;
        gingerbread.applyFrame();
        return;
    }

    gingerbread._gingerbreadPatched = true;
    gingerbread._controller = controller;
    gingerbread._type = type || TYPE_RUNNER;

    var bugEl = gingerbread.bug;
    gingerbread.options.wingsOpen = true;
    gingerbread.wingsOpen = true;
    gingerbread.stationary = false;
    gingerbread.toggle_stationary_counter = 9999;

    // Animation state
    gingerbread.walkFrameCounter = 0;
    gingerbread.walkIndex = 0;
    gingerbread._movingRight = Math.random() > 0.5;
    // Wigglers always use South row (facing user), runners use direction-based rows
    gingerbread._currentRow = isWiggler ? DIR_SOUTH : (gingerbread._movingRight ? DIR_EAST : DIR_WEST);
    gingerbread._lastX = undefined;

    // Element dimensions (scaled)
    var displayWidth = GINGERBREAD_FRAME_WIDTH * scale;
    var displayHeight = GINGERBREAD_FRAME_HEIGHT * scale;

    // Sprite sheet dimensions (scaled)
    var sheetWidth = GINGERBREAD_FRAME_WIDTH * GINGERBREAD_COLS * scale;
    var sheetHeight = GINGERBREAD_FRAME_HEIGHT * GINGERBREAD_ROWS * scale;

    // Set element size
    bugEl.style.width = displayWidth + 'px';
    bugEl.style.height = displayHeight + 'px';
    bugEl.style.overflow = 'hidden';
    bugEl.style.imageRendering = 'pixelated';

    // Set background image once
    bugEl.style.backgroundImage = 'url("' + GINGERBREAD_SPRITE + '")';
    bugEl.style.backgroundRepeat = 'no-repeat';
    bugEl.style.backgroundColor = 'transparent';
    bugEl.style.setProperty('background-size', sheetWidth + 'px ' + sheetHeight + 'px', 'important');

    /**
     * Apply the current frame to the sprite
     * Runners: East (row 2) or West (row 1) based on direction
     * Wigglers: Always South (row 0) facing user
     */
    gingerbread.applyFrame = function() {
        if (!this.bug) return;

        var row = this._currentRow;
        var col = this.walkIndex % GINGERBREAD_COLS;

        // Calculate background position (scaled)
        var posX = -(col * GINGERBREAD_FRAME_WIDTH * scale);
        var posY = -(row * GINGERBREAD_FRAME_HEIGHT * scale);

        this.bug.style.backgroundPosition = posX + 'px ' + posY + 'px';
    };

    gingerbread.applyFrame();

    // Track time for wiggler animation
    gingerbread._lastWiggleTime = Date.now();

    // Override walkFrame for animation
    gingerbread.walkFrame = function() {
        if (!this.bug) return;

        var now = Date.now();

        if (this._type === TYPE_WIGGLER) {
            // Wigglers use time-based animation (faster wiggle)
            var wiggleInterval = 120; // ms between frames
            if (now - this._lastWiggleTime >= wiggleInterval) {
                this._lastWiggleTime = now;
                this.walkIndex = (this.walkIndex + 1) % GINGERBREAD_COLS;
            }
        } else {
            // Runners use time-based animation too (faster run cycle)
            var runInterval = 100; // ms between frames - fast running
            if (now - this._lastWiggleTime >= runInterval) {
                this._lastWiggleTime = now;
                this.walkIndex = (this.walkIndex + 1) % GINGERBREAD_COLS;
            }
        }

        this.applyFrame();
    };

    // Override moveBug for position only - direction is set once at spawn
    gingerbread.moveBug = function(x, y) {
        this.bug.left = x;
        this.bug.top = y;

        var translateX = Math.round(x);
        var translateY = Math.round(y);

        this.transform('translate(' + translateX + 'px, ' + translateY + 'px)');
    };

    // Override die for fall animation
    gingerbread.die = function() {
        if (!this.alive) return;

        if (this.dropTimer) {
            cancelAnimationFrame(this.dropTimer);
            this.dropTimer = null;
        }

        this.stop();
        this.alive = false;
        this.bug.classList.add('bug-dead');

        // Track stats
        incrementGiftCounter();
        incrementStreakCounter();

        // Fall animation
        var currentTop = this.bug.top;
        var groundLevel = document.documentElement.clientHeight - displayHeight - 20;
        var startTime = performance.now();
        var fallDuration = 600;
        var self = this;

        // Spin while falling
        var rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * 360;

        var fall = function(timestamp) {
            var elapsed = timestamp - startTime;
            var progress = Math.min(elapsed / fallDuration, 1);
            var eased = 1 - Math.pow(1 - progress, 2.5);
            var newTop = currentTop + (groundLevel - currentTop) * eased;
            var rotation = rotationSpeed * progress;

            self.bug.style.transform = 'translate(' + Math.round(self.bug.left) + 'px, ' + Math.round(newTop) + 'px) rotate(' + rotation + 'deg)';

            if (progress < 1) {
                self.dropTimer = requestAnimationFrame(fall);
            } else {
                // Fade out and respawn
                self.bug.style.transition = 'opacity 0.5s';
                self.bug.style.opacity = '0';
                setTimeout(function() {
                    self.bug.style.transition = '';
                    self.bug.style.opacity = '1';
                    self.bug.style.transform = '';
                    self.walkFrameCounter = 0;
                    self.walkIndex = 0;
                    self._movingRight = Math.random() > 0.5;
                    // Preserve type - wigglers stay South, runners use direction
                    if (self._type === TYPE_WIGGLER) {
                        self._currentRow = DIR_SOUTH;
                    } else {
                        self._currentRow = self._movingRight ? DIR_EAST : DIR_WEST;
                    }
                    self.applyFrame();
                    self.remove();
                    if (self._controller) {
                        self._controller.ensurePopulation();
                    }
                }, 500);
            }
        };

        self.dropTimer = requestAnimationFrame(fall);
    };

    // Override reset
    var originalReset = gingerbread.reset;
    gingerbread.reset = function() {
        if (typeof originalReset === 'function') {
            originalReset.apply(this, arguments);
        }

        this.walkFrameCounter = 0;
        this.walkIndex = 0;
        this._lastX = undefined;
        this._movingRight = Math.random() > 0.5;
        // Preserve type - wigglers stay South, runners use direction
        if (this._type === TYPE_WIGGLER) {
            this._currentRow = DIR_SOUTH;
        } else {
            this._currentRow = this._movingRight ? DIR_EAST : DIR_WEST;
        }
        this.alive = true;
        this.stationary = false;
        this.toggle_stationary_counter = 9999;
        this.applyFrame();
    };

    // Prevent stationary behavior
    gingerbread.toggleStationary = function() {
        this.stationary = false;
        this.toggle_stationary_counter = 9999;
    };
};

GingerbreadController.prototype.spawnGingerbread = function() {
    if (!this.transform) return;

    var aliveCount = 0;
    for (var i = 0; i < this.bugs.length; i++) {
        if (this.bugs[i].alive) aliveCount++;
    }

    if (aliveCount >= this.options.maxBugs) return;

    // Progressive difficulty (very gentle scaling)
    var difficultyMultiplier = Math.min(1 + (GiftCounter / 200), 1.25);

    var clonedOptions = JSON.parse(JSON.stringify(this.options));
    clonedOptions.wingsOpen = true;
    var baseSpeed = this.random(this.options.minSpeed, this.options.maxSpeed);
    clonedOptions.walkSpeed = baseSpeed * difficultyMultiplier;

    var gingerbread = SpawnBug();
    gingerbread.initialize(this.transform, clonedOptions);

    // Randomly assign type - 30% chance of wiggler (facing user while moving)
    var type = Math.random() < 0.3 ? TYPE_WIGGLER : TYPE_RUNNER;
    this.patchGingerbreadBehaviors(gingerbread, type);

    this.bugs.push(gingerbread);
    gingerbread.walkIn();
    this.add_events_to_bug(gingerbread);
};

GingerbreadController.prototype.ensurePopulation = function() {
    var alive = 0;
    for (var i = 0; i < this.bugs.length; i++) {
        if (this.bugs[i].alive) alive++;
    }

    var desired = Math.min(this.options.minBugs, this.options.maxBugs);
    while (alive < desired) {
        this.spawnGingerbread();
        alive++;
    }
};

GingerbreadController.prototype.startPopulationMonitor = function() {
    var self = this;
    this.stopPopulationMonitor();
    this.populationTimer = setInterval(function() {
        self.ensurePopulation();
    }, 1500);
};

GingerbreadController.prototype.stopPopulationMonitor = function() {
    if (this.populationTimer) {
        clearInterval(this.populationTimer);
        this.populationTimer = null;
    }
};

GingerbreadController.prototype.stop = function() {
    this.stopPopulationMonitor();
    if (typeof BugDispatch.stop === 'function') {
        BugDispatch.stop.call(this);
    }
};

GingerbreadController.prototype.end = function() {
    this.stopPopulationMonitor();
    if (typeof BugDispatch.end === 'function') {
        BugDispatch.end.call(this);
    }
};

// Export to window
window.GingerbreadController = GingerbreadController;
