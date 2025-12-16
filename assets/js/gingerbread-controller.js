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
var TYPE_RUNNER = 'runner';
var TYPE_WIGGLER = 'wiggler';

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

        minDelay: 400,
        maxDelay: 3000,

        minSpeed: 20,
        maxSpeed: 40,

        minBugs: 5,
        maxBugs: 8,

        mouseOver: 'nothing'
    };

    this.options = mergeOptions(this.options, gingerbreadOptions);
    this.wigglers = []; // Separate array for wigglers
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
        this.patchGingerbreadBehaviors(this.bugs[i], TYPE_RUNNER);
    }

    this.ensurePopulation();
    this.startPopulationMonitor();
    this.spawnWigglers();

    loadGingerbreadStats();
    setTimeout(function() {
        updateCounterDisplays();
    }, 100);

    window.resetStreakCounter = resetStreakCounter;
};

/**
 * Spawn wiggler gingerbread men that dance in place
 */
GingerbreadController.prototype.spawnWigglers = function() {
    var numWigglers = 2; // Number of wigglers to spawn
    var scale = GINGERBREAD_SCALE;
    var displayWidth = GINGERBREAD_FRAME_WIDTH * scale;
    var displayHeight = GINGERBREAD_FRAME_HEIGHT * scale;
    var sheetWidth = GINGERBREAD_FRAME_WIDTH * GINGERBREAD_COLS * scale;
    var sheetHeight = GINGERBREAD_FRAME_HEIGHT * GINGERBREAD_ROWS * scale;
    var controller = this;

    for (var i = 0; i < numWigglers; i++) {
        var wiggler = {
            alive: true,
            _type: TYPE_WIGGLER,
            _controller: controller,
            walkIndex: Math.floor(Math.random() * GINGERBREAD_COLS),
            animationSpeed: 150 + Math.random() * 100 // Vary wiggle speed
        };

        // Create DOM element
        var el = document.createElement('div');
        el.className = 'bug gingerbread-wiggler';
        el.style.position = 'fixed';
        el.style.width = displayWidth + 'px';
        el.style.height = displayHeight + 'px';
        el.style.overflow = 'hidden';
        el.style.imageRendering = 'pixelated';
        el.style.backgroundImage = 'url("' + GINGERBREAD_SPRITE + '")';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundColor = 'transparent';
        el.style.setProperty('background-size', sheetWidth + 'px ' + sheetHeight + 'px', 'important');
        el.style.zIndex = '9999';
        el.style.cursor = 'crosshair';
        el.style.pointerEvents = 'auto';

        // Position randomly along the bottom
        var viewportWidth = document.documentElement.clientWidth;
        var viewportHeight = document.documentElement.clientHeight;
        var x = Math.random() * (viewportWidth - displayWidth - 100) + 50;
        var y = viewportHeight - displayHeight - 30 - Math.random() * 50;

        el.style.left = x + 'px';
        el.style.top = y + 'px';

        wiggler.bug = el;
        wiggler.x = x;
        wiggler.y = y;

        // Apply initial frame (South row for facing user)
        var col = wiggler.walkIndex % GINGERBREAD_COLS;
        var posX = -(col * GINGERBREAD_FRAME_WIDTH * scale);
        var posY = -(DIR_SOUTH * GINGERBREAD_FRAME_HEIGHT * scale);
        el.style.backgroundPosition = posX + 'px ' + posY + 'px';

        document.body.appendChild(el);

        // Wiggle animation
        wiggler.animateWiggle = function() {
            if (!this.alive || !this.bug) return;

            this.walkIndex = (this.walkIndex + 1) % GINGERBREAD_COLS;
            var col = this.walkIndex;
            var posX = -(col * GINGERBREAD_FRAME_WIDTH * scale);
            var posY = -(DIR_SOUTH * GINGERBREAD_FRAME_HEIGHT * scale);
            this.bug.style.backgroundPosition = posX + 'px ' + posY + 'px';

            var self = this;
            this.wiggleTimer = setTimeout(function() {
                self.animateWiggle();
            }, self.animationSpeed);
        };

        // Die function for wigglers
        wiggler.die = function() {
            if (!this.alive) return;

            if (this.wiggleTimer) {
                clearTimeout(this.wiggleTimer);
                this.wiggleTimer = null;
            }

            this.alive = false;
            this.bug.classList.add('bug-dead');

            incrementGiftCounter();
            incrementStreakCounter();

            var currentTop = this.y;
            var groundLevel = document.documentElement.clientHeight - displayHeight - 20;
            var startTime = performance.now();
            var fallDuration = 600;
            var self = this;
            var rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * 360;

            var fall = function(timestamp) {
                var elapsed = timestamp - startTime;
                var progress = Math.min(elapsed / fallDuration, 1);
                var eased = 1 - Math.pow(1 - progress, 2.5);
                var newTop = currentTop + (groundLevel - currentTop) * eased;
                var rotation = rotationSpeed * progress;

                self.bug.style.transform = 'rotate(' + rotation + 'deg)';
                self.bug.style.top = newTop + 'px';

                if (progress < 1) {
                    self.dropTimer = requestAnimationFrame(fall);
                } else {
                    self.bug.style.transition = 'opacity 0.5s';
                    self.bug.style.opacity = '0';
                    setTimeout(function() {
                        if (self.bug && self.bug.parentNode) {
                            self.bug.parentNode.removeChild(self.bug);
                        }
                        // Respawn a new wiggler
                        if (self._controller) {
                            self._controller.respawnWiggler(self);
                        }
                    }, 500);
                }
            };

            self.dropTimer = requestAnimationFrame(fall);
        };

        // Click handler
        (function(w) {
            w.bug.addEventListener('click', function(e) {
                e.stopPropagation();
                if (w.alive) {
                    w.die();
                }
            });
        })(wiggler);

        wiggler.animateWiggle();
        this.wigglers.push(wiggler);
    }
};

/**
 * Respawn a wiggler after it dies
 */
GingerbreadController.prototype.respawnWiggler = function(oldWiggler) {
    var idx = this.wigglers.indexOf(oldWiggler);
    if (idx > -1) {
        this.wigglers.splice(idx, 1);
    }

    var controller = this;
    setTimeout(function() {
        controller.spawnSingleWiggler();
    }, 1000 + Math.random() * 2000);
};

/**
 * Spawn a single wiggler
 */
GingerbreadController.prototype.spawnSingleWiggler = function() {
    var scale = GINGERBREAD_SCALE;
    var displayWidth = GINGERBREAD_FRAME_WIDTH * scale;
    var displayHeight = GINGERBREAD_FRAME_HEIGHT * scale;
    var sheetWidth = GINGERBREAD_FRAME_WIDTH * GINGERBREAD_COLS * scale;
    var sheetHeight = GINGERBREAD_FRAME_HEIGHT * GINGERBREAD_ROWS * scale;
    var controller = this;

    var wiggler = {
        alive: true,
        _type: TYPE_WIGGLER,
        _controller: controller,
        walkIndex: Math.floor(Math.random() * GINGERBREAD_COLS),
        animationSpeed: 150 + Math.random() * 100
    };

    var el = document.createElement('div');
    el.className = 'bug gingerbread-wiggler';
    el.style.position = 'fixed';
    el.style.width = displayWidth + 'px';
    el.style.height = displayHeight + 'px';
    el.style.overflow = 'hidden';
    el.style.imageRendering = 'pixelated';
    el.style.backgroundImage = 'url("' + GINGERBREAD_SPRITE + '")';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundColor = 'transparent';
    el.style.setProperty('background-size', sheetWidth + 'px ' + sheetHeight + 'px', 'important');
    el.style.zIndex = '9999';
    el.style.cursor = 'crosshair';
    el.style.pointerEvents = 'auto';
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';

    var viewportWidth = document.documentElement.clientWidth;
    var viewportHeight = document.documentElement.clientHeight;
    var x = Math.random() * (viewportWidth - displayWidth - 100) + 50;
    var y = viewportHeight - displayHeight - 30 - Math.random() * 50;

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    wiggler.bug = el;
    wiggler.x = x;
    wiggler.y = y;

    var col = wiggler.walkIndex % GINGERBREAD_COLS;
    var posX = -(col * GINGERBREAD_FRAME_WIDTH * scale);
    var posY = -(DIR_SOUTH * GINGERBREAD_FRAME_HEIGHT * scale);
    el.style.backgroundPosition = posX + 'px ' + posY + 'px';

    document.body.appendChild(el);

    // Fade in
    setTimeout(function() {
        el.style.opacity = '1';
    }, 50);

    wiggler.animateWiggle = function() {
        if (!this.alive || !this.bug) return;

        this.walkIndex = (this.walkIndex + 1) % GINGERBREAD_COLS;
        var col = this.walkIndex;
        var posX = -(col * GINGERBREAD_FRAME_WIDTH * scale);
        var posY = -(DIR_SOUTH * GINGERBREAD_FRAME_HEIGHT * scale);
        this.bug.style.backgroundPosition = posX + 'px ' + posY + 'px';

        var self = this;
        this.wiggleTimer = setTimeout(function() {
            self.animateWiggle();
        }, self.animationSpeed);
    };

    wiggler.die = function() {
        if (!this.alive) return;

        if (this.wiggleTimer) {
            clearTimeout(this.wiggleTimer);
            this.wiggleTimer = null;
        }

        this.alive = false;
        this.bug.classList.add('bug-dead');

        incrementGiftCounter();
        incrementStreakCounter();

        var currentTop = this.y;
        var groundLevel = document.documentElement.clientHeight - displayHeight - 20;
        var startTime = performance.now();
        var fallDuration = 600;
        var self = this;
        var rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * 360;

        var fall = function(timestamp) {
            var elapsed = timestamp - startTime;
            var progress = Math.min(elapsed / fallDuration, 1);
            var eased = 1 - Math.pow(1 - progress, 2.5);
            var newTop = currentTop + (groundLevel - currentTop) * eased;
            var rotation = rotationSpeed * progress;

            self.bug.style.transform = 'rotate(' + rotation + 'deg)';
            self.bug.style.top = newTop + 'px';

            if (progress < 1) {
                self.dropTimer = requestAnimationFrame(fall);
            } else {
                self.bug.style.transition = 'opacity 0.5s';
                self.bug.style.opacity = '0';
                setTimeout(function() {
                    if (self.bug && self.bug.parentNode) {
                        self.bug.parentNode.removeChild(self.bug);
                    }
                    if (self._controller) {
                        self._controller.respawnWiggler(self);
                    }
                }, 500);
            }
        };

        self.dropTimer = requestAnimationFrame(fall);
    };

    (function(w) {
        w.bug.addEventListener('click', function(e) {
            e.stopPropagation();
            if (w.alive) {
                w.die();
            }
        });
    })(wiggler);

    wiggler.animateWiggle();
    this.wigglers.push(wiggler);
};

/**
 * Patch individual gingerbread instance (runners)
 */
GingerbreadController.prototype.patchGingerbreadBehaviors = function(gingerbread, type) {
    if (!gingerbread || !gingerbread.bug) return;

    var controller = this;
    var scale = GINGERBREAD_SCALE;

    if (gingerbread._gingerbreadPatched) {
        gingerbread.walkFrameCounter = 0;
        gingerbread.walkIndex = 0;
        gingerbread._lastX = undefined;
        gingerbread._movingRight = Math.random() > 0.5;
        gingerbread._currentRow = gingerbread._movingRight ? DIR_EAST : DIR_WEST;
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
    gingerbread._currentRow = gingerbread._movingRight ? DIR_EAST : DIR_WEST;
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
     * Uses proper East (row 2) or West (row 1) based on direction
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

    // Override walkFrame for animation
    gingerbread.walkFrame = function() {
        if (!this.bug) return;

        var currentX = this.bug.left || 0;
        var distance = Math.abs(this._lastX == null ? 0 : currentX - this._lastX);
        this._lastX = currentX;

        this.walkFrameCounter = (this.walkFrameCounter || 0) + distance;
        var frameThreshold = GINGERBREAD_FRAME_WIDTH;

        if (this.walkFrameCounter >= frameThreshold) {
            this.walkFrameCounter = 0;
            this.walkIndex = (this.walkIndex + 1) % GINGERBREAD_COLS;
        }

        this.applyFrame();
    };

    // Override moveBug for position and direction
    gingerbread.moveBug = function(x, y) {
        if (typeof this._lastX === 'number') {
            var deltaX = x - this._lastX;
            if (Math.abs(deltaX) > 0.5) {
                var wasMovingRight = this._movingRight;
                this._movingRight = deltaX > 0;

                // Update row when direction changes
                if (wasMovingRight !== this._movingRight) {
                    this._currentRow = this._movingRight ? DIR_EAST : DIR_WEST;
                }
            }
        }

        this.bug.left = x;
        this.bug.top = y;

        var translateX = Math.round(x);
        var translateY = Math.round(y);

        // No flipping needed - we use proper directional sprites
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
                    self._currentRow = self._movingRight ? DIR_EAST : DIR_WEST;
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
        this._currentRow = this._movingRight ? DIR_EAST : DIR_WEST;
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

    // Progressive difficulty
    var difficultyMultiplier = Math.min(1 + (GiftCounter / 50), 2);

    var clonedOptions = JSON.parse(JSON.stringify(this.options));
    clonedOptions.wingsOpen = true;
    var baseSpeed = this.random(this.options.minSpeed, this.options.maxSpeed);
    clonedOptions.walkSpeed = baseSpeed * difficultyMultiplier;

    var gingerbread = SpawnBug();
    gingerbread.initialize(this.transform, clonedOptions);
    this.patchGingerbreadBehaviors(gingerbread, TYPE_RUNNER);
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

    // Stop wigglers
    for (var i = 0; i < this.wigglers.length; i++) {
        if (this.wigglers[i].wiggleTimer) {
            clearTimeout(this.wigglers[i].wiggleTimer);
        }
    }

    if (typeof BugDispatch.stop === 'function') {
        BugDispatch.stop.call(this);
    }
};

GingerbreadController.prototype.end = function() {
    this.stopPopulationMonitor();

    // Remove wigglers
    for (var i = 0; i < this.wigglers.length; i++) {
        if (this.wigglers[i].wiggleTimer) {
            clearTimeout(this.wigglers[i].wiggleTimer);
        }
        if (this.wigglers[i].bug && this.wigglers[i].bug.parentNode) {
            this.wigglers[i].bug.parentNode.removeChild(this.wigglers[i].bug);
        }
    }
    this.wigglers = [];

    if (typeof BugDispatch.end === 'function') {
        BugDispatch.end.call(this);
    }
};

// Export to window
window.GingerbreadController = GingerbreadController;
