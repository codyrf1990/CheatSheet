/**
 * Turkey Controller for Thanksgiving Theme
 * Extends BugDispatch and patches individual bug instances for:
 * - Slow, natural walking animation (frame throttling)
 * - Click-to-shoot mechanics (no hover death)
 * - Cooked turkey death animation
 */

var COOKED_TURKEY_SPRITE = 'assets/thanksgiving/sprites/turkey-cooked.png';
var TURKEY_FRAME_COUNT = 6;
var TurkeyFrameCache = null;
var TurkeyFrameCachePromise = null;
var TurkeyCookedFrame = null;

// Feast counter and streak tracking
var FeastCounter = 0;
var StreakCounter = 0;
var TurkeyStatsKey = 'thanksgiving-turkey-stats';

function loadTurkeyFrames(basePath, frameCount) {
    return new Promise(function(resolve, reject) {
        var frames = [];
        var loadedCount = 0;
        var totalToLoad = frameCount + 1;
        var hasError = false;

        function checkComplete() {
            if (hasError) return;
            if (loadedCount === totalToLoad) {
                resolve(frames);
            }
        }

        // Load each walking frame (sprite_1.png through sprite_6.png)
        for (var i = 1; i <= frameCount; i++) {
            (function(frameNum) {
                var img = new Image();
                img.onload = function() {
                    console.log('Loaded turkey frame ' + frameNum);
                    loadedCount++;
                    checkComplete();
                };
                img.onerror = function() {
                    if (!hasError) {
                        hasError = true;
                        reject(new Error('Failed to load turkey frame ' + frameNum));
                    }
                };
                img.src = basePath + '/sprite_' + frameNum + '.png';
                frames[frameNum - 1] = img.src;
            })(i);
        }

        // Load cooked turkey
        var cookedImg = new Image();
        cookedImg.onload = function() {
            console.log('Loaded cooked turkey');
            TurkeyCookedFrame = cookedImg.src;
            loadedCount++;
            checkComplete();
        };
        cookedImg.onerror = function() {
            if (!hasError) {
                hasError = true;
                reject(new Error('Failed to load cooked turkey'));
            }
        };
        cookedImg.src = basePath + '/turkey-cooked.png';
    });
}

function ensureTurkeyFrameCache(basePath, frameCount) {
    if (TurkeyFrameCache) {
        return Promise.resolve(TurkeyFrameCache);
    }

    if (!TurkeyFrameCachePromise) {
        TurkeyFrameCachePromise = loadTurkeyFrames(basePath, frameCount)
            .then(function(frames) {
                TurkeyFrameCache = frames;
                console.log('Turkey frame cache ready with ' + frames.length + ' frames');
                return frames;
            })
            .catch(function(err) {
                console.error('Turkey frame cache failed to load:', err);
                TurkeyFrameCachePromise = null;
                throw err;
            });
    }

    return TurkeyFrameCachePromise;
}

/**
 * Load saved turkey stats from localStorage
 */
function loadTurkeyStats() {
    try {
        var saved = localStorage.getItem(TurkeyStatsKey);
        if (saved) {
            var stats = JSON.parse(saved);
            FeastCounter = stats.feasts || 0;
            console.log('Loaded turkey stats - Feasts:', FeastCounter);
            return stats;
        }
    } catch (e) {
        console.warn('Could not load turkey stats:', e);
    }
    return { feasts: 0 };
}

/**
 * Save turkey stats to localStorage
 */
function saveTurkeyStats() {
    try {
        var stats = {
            feasts: FeastCounter,
            lastPlayed: new Date().toISOString()
        };
        localStorage.setItem(TurkeyStatsKey, JSON.stringify(stats));
        console.log('Saved turkey stats - Feasts:', FeastCounter);
    } catch (e) {
        console.warn('Could not save turkey stats:', e);
    }
}

/**
 * Increment feast counter and update display
 */
function incrementFeastCounter() {
    FeastCounter++;
    saveTurkeyStats();

    var countEl = document.getElementById('feast-count');
    if (countEl) {
        countEl.textContent = FeastCounter;
        // Pulse animation
        countEl.classList.remove('pulse');
        void countEl.offsetWidth; // Force reflow
        countEl.classList.add('pulse');
        setTimeout(function() {
            countEl.classList.remove('pulse');
        }, 400);
    }
}

/**
 * Increment streak counter and update display
 */
function incrementStreakCounter() {
    StreakCounter++;

    var streakEl = document.getElementById('streak-count');
    if (streakEl) {
        streakEl.textContent = StreakCounter;
        // Pulse animation
        streakEl.classList.remove('pulse');
        void streakEl.offsetWidth;
        streakEl.classList.add('pulse');
        setTimeout(function() {
            streakEl.classList.remove('pulse');
        }, 400);
    }
}

/**
 * Reset streak counter (miss or timeout)
 */
function resetStreakCounter() {
    if (StreakCounter === 0) return; // Already at 0

    StreakCounter = 0;

    var streakEl = document.getElementById('streak-count');
    if (streakEl) {
        streakEl.textContent = '0';
        // Shake animation
        streakEl.classList.remove('streak-broken');
        void streakEl.offsetWidth;
        streakEl.classList.add('streak-broken');
        setTimeout(function() {
            streakEl.classList.remove('streak-broken');
        }, 500);
    }
}

/**
 * Update counter displays
 */
function updateCounterDisplays() {
    var feastEl = document.getElementById('feast-count');
    if (feastEl) {
        feastEl.textContent = FeastCounter;
    }

    var streakEl = document.getElementById('streak-count');
    if (streakEl) {
        streakEl.textContent = StreakCounter;
    }
}

function applyTurkeyFrame(turkey, frameIndex) {
    if (!TurkeyFrameCache || !turkey || !turkey.bug) {
        return false;
    }

    // TurkeyFrameCache is now a flat array of image URLs: [url1, url2, url3, url4, url5, url6]
    var frameUrl = TurkeyFrameCache[frameIndex % TurkeyFrameCache.length];
    if (!frameUrl) return false;

    // Apply the pre-cropped individual frame
    turkey.bug.style.backgroundColor = 'transparent';
    turkey.bug.style.backgroundImage = 'url("' + frameUrl + '")';
    turkey.bug.style.backgroundRepeat = 'no-repeat';
    turkey.bug.style.backgroundPosition = 'center center';  // Center the turkey
    turkey.bug.style.imageRendering = 'pixelated';
    // Use contain to fit the turkey naturally within the element
    turkey.bug.style.setProperty('background-size', 'contain', 'important');

    return true;
}

var TurkeyController = function() {
    var turkeyOptions = {
        // Sprite configuration
        imageSprite: 'assets/thanksgiving/sprites/turkey-sprite.png',
        bugWidth: 156,             // Width of each turkey frame
        bugHeight: 132,            // Height of each turkey frame
        num_frames: 6,             // 6-frame walk cycle animation (individual sprites)

        // Movement behavior
        canFly: false,             // Turkeys walk on ground, don't fly
        canDie: true,              // Can be killed when clicked
        numDeathTypes: 1,          // 1 death type: cooked turkey!

        // Visual settings
        zoom: 6,                   // Size variation (6 = slightly smaller, turkeys are bigger sprites)

        // Spawn timing
        minDelay: 500,             // Minimum delay before spawning (ms)
        maxDelay: 4000,            // Maximum delay before spawning (ms)

        // Movement speed
        minSpeed: 16,              // Minimum walking speed (2x faster)
        maxSpeed: 32,              // Maximum walking speed (2x faster)

        // Turkey population
        minBugs: 5,                // Minimum number of turkeys on screen
        maxBugs: 8,                // Maximum number of turkeys on screen

        // Interaction mode - NOTHING! We handle clicks manually
        mouseOver: 'nothing'       // No hover interaction - click only!
    };

    // Merge turkey options with base options
    this.options = mergeOptions(this.options, turkeyOptions);

    ensureTurkeyFrameCache('assets/thanksgiving/sprites', TURKEY_FRAME_COUNT);

    // Initialize the turkey controller (calls our overridden initialize)
    this.initialize.apply(this, arguments);
};

// Extend BugDispatch prototype
TurkeyController.prototype = Object.create(BugDispatch);
TurkeyController.prototype.constructor = TurkeyController;

/**
 * OVERRIDE: initialize() - Patch each turkey bug instance after creation
 * This intercepts the bug creation process to modify individual turkey behaviors
 */
TurkeyController.prototype.initialize = function(options) {
    // Call parent initialize to create bug instances
    BugDispatch.initialize.call(this, options);

    // Patch each created turkey instance with custom behaviors
    for (var i = 0; i < this.bugs.length; i++) {
        this.patchTurkeyBehaviors(this.bugs[i]);
    }

    this.ensurePopulation();
    this.startPopulationMonitor();

    // Load saved stats and initialize displays
    loadTurkeyStats();
    setTimeout(function() {
        updateCounterDisplays();
    }, 100);

    // Expose streak reset function globally
    window.resetStreakCounter = resetStreakCounter;
};

/**
 * Patch individual turkey bug instance with custom behaviors
 * This modifies the bug instance directly (not the prototype)
 *
 * @param {Object} turkey - Individual bug instance created by SpawnBug()
 */
TurkeyController.prototype.patchTurkeyBehaviors = function(turkey) {
    if (!turkey || !turkey.bug) {
        return;
    }

    var controller = this;
    var framePromise = ensureTurkeyFrameCache('assets/thanksgiving/sprites', TURKEY_FRAME_COUNT);
    turkey._frameReadyPromise = framePromise;
    if (framePromise && typeof framePromise.catch === 'function' && !turkey._framePromiseLogged) {
        framePromise.catch(function(err) {
            console.error('Turkey sprite frames failed to prepare:', err);
        });
        turkey._framePromiseLogged = true;
    }

    if (turkey._turkeyPatched) {
        // Turkey already patched, just reset state
        turkey.walkFrameCounter = 0;
        turkey.walkIndex = 0;
        turkey._lastX = undefined;
        turkey._lastWalkX = undefined;
        turkey._movingRight = true;
        turkey.alive = true;

        // Restore sprite from frame 0
        if (turkey.forceWalkFrame) {
            turkey.forceWalkFrame(true);
        }
        return;
    }

    turkey._turkeyPatched = true;
    turkey._controller = controller;

    var bugEl = turkey.bug;
    turkey.options.wingsOpen = true;
    turkey.wingsOpen = true;
    turkey.stationary = false;
    turkey.toggle_stationary_counter = 9999;

    bugEl.style.transformOrigin = 'center center';
    bugEl.style.width = controller.options.bugWidth + 'px';
    bugEl.style.height = controller.options.bugHeight + 'px';

    // CRITICAL: Force background-size to prevent Bug.js shorthand from resetting it
    function lockBackgroundSize(bug) {
        if (!bug) return;
        bug.style.setProperty('background-size', controller.options.bugWidth + 'px ' + controller.options.bugHeight + 'px', 'important');
    }

    // Force walk frame to reassert all background properties every tick
    // This prevents Bug.js from overwriting our sprite settings
    turkey.forceWalkFrame = function(resetIndex) {
        if (!this.bug) return;

        if (resetIndex) this.walkIndex = 0;

        var self = this;

        if (!TurkeyFrameCache) {
            if (this._frameReadyPromise && typeof this._frameReadyPromise.then === 'function') {
                this._frameReadyPromise.then(function() {
                    if (self.bug) {
                        applyTurkeyFrame(self, self.walkIndex);
                        lockBackgroundSize(self.bug);
                        self.bug.style.visibility = '';
                    }
                }).catch(function() {
                    applySpriteSheetFallback(self);
                    lockBackgroundSize(self.bug);
                });
            } else {
                applySpriteSheetFallback(self);
                lockBackgroundSize(self.bug);
            }
            return;
        }

        applyTurkeyFrame(this, this.walkIndex);
        lockBackgroundSize(this.bug);
        this.bug.style.visibility = '';
    };

    // Initialize animation state
    turkey.walkFrameCounter = 0;
    turkey.walkIndex = 0;
    turkey._movingRight = true;
    turkey._lastX = undefined;

    // Set initial sprite and size
    turkey.zoom = 0.5;  // Half size (50% of original)
    bugEl.style.width = '260px';
    bugEl.style.height = '215px';
    bugEl.style.overflow = 'hidden';  // Prevent sprite sheet overflow

    turkey.bug.style.visibility = 'hidden';
    if (turkey._frameReadyPromise && typeof turkey._frameReadyPromise.then === 'function') {
        turkey._frameReadyPromise.then(function() {
            if (turkey.bug) {
                turkey.forceWalkFrame(true);
            }
        }).catch(function() {});
    } else {
        turkey.forceWalkFrame(true);  // Set initial frame
    }

    var originalMakeBug = turkey.makeBug;
    turkey.makeBug = function() {
        // Don't call original - we'll create the element ourselves to avoid Bug.js shorthand
        if (!this.bug && this.active) {
            var bug = document.createElement('div');
            bug.className = 'bug';

            // Set individual properties instead of shorthand to prevent background-size reset
            bug.style.backgroundImage = 'url(' + this.options.imageSprite + ')';
            bug.style.backgroundRepeat = 'no-repeat';
            bug.style.backgroundPosition = '0 0';
            bug.style.backgroundColor = 'transparent';
            bug.style.width = this.options.bugWidth + 'px';
            bug.style.height = this.options.bugHeight + 'px';
            bug.style.position = 'fixed';
            bug.style.top = '0';
            bug.style.left = '0';
            bug.style.zIndex = '9999999';

            this.bug = bug;
            lockBackgroundSize(this.bug);

            // setPos is called by Bug.js after makeBug
        }

        if (this.bug) {
            this.bug.style.visibility = 'hidden';
            lockBackgroundSize(this.bug);
            var self = this;
            if (this._frameReadyPromise && typeof this._frameReadyPromise.then === 'function') {
                this._frameReadyPromise.then(function() {
                    if (self.bug) {
                        self.forceWalkFrame(true);
                    }
                }).catch(function() {});
            } else {
                this.forceWalkFrame(true);
            }
        }
    };

    var originalDrawBug = turkey.drawBug;
    turkey.drawBug = function(top, left) {
        if (typeof originalDrawBug === 'function') {
            originalDrawBug.apply(this, arguments);
        }
        this.forceWalkFrame(false);
    };

    var originalWalkIn = turkey.walkIn;
    turkey.walkIn = function() {
        if (typeof originalWalkIn === 'function') {
            originalWalkIn.apply(this, arguments);
        }
        this.stationary = false;
        this.toggle_stationary_counter = 9999;
        this.walkFrameCounter = 0;
        this.walkIndex = 0;
        this.forceWalkFrame(true);
    };

    var originalGo = turkey.go;
    turkey.go = function() {
        this.stationary = false;
        this.toggle_stationary_counter = 9999;
        if (typeof originalGo === 'function') {
            originalGo.apply(this, arguments);
        }
    };

    turkey.toggleStationary = function() {
        this.stationary = false;
        this.toggle_stationary_counter = 9999;
        if (typeof this.next_stationary === 'function') {
            this.next_stationary();
        } else {
            this.toggle_stationary_counter = 240;
        }
        this.forceWalkFrame(false);
    };

    var originalReset = turkey.reset;

    turkey.walkFrame = function() {
        if (!this.bug) return;

        // Calculate distance traveled since last frame
        var currentX = this.bug.left || 0;
        var distance = Math.abs(this._lastWalkX == null ? 0 : currentX - this._lastWalkX);
        this._lastWalkX = currentX;

        // Accumulate distance - advance frame every 1/6 of body width (2x faster animation)
        this.walkFrameCounter = (this.walkFrameCounter || 0) + distance;
        var frameThreshold = this.options.bugWidth / 6;  // ~26px for 156px turkey

        if (this.walkFrameCounter >= frameThreshold) {
            this.walkFrameCounter = 0;
            this.walkIndex = (this.walkIndex + 1) % this.options.num_frames;
            this.forceWalkFrame(false);
        } else {
            // Reassert every tick to prevent Bug.js from overwriting
            this.forceWalkFrame(false);
        }

        // Always lock background-size after any frame update
        lockBackgroundSize(this.bug);
    };

    turkey.moveBug = function(x, y) {
        // Track direction based on movement
        if (typeof this._lastX === 'number') {
            var deltaX = x - this._lastX;
            if (Math.abs(deltaX) > 0.2) {
                this._movingRight = deltaX > 0;
            }
        }

        this._lastX = x;

        // Update bug position
        this.bug.left = x;
        this.bug.top = y;

        // Use integer coordinates and flip only with scaleX
        var translateX = Math.round(x);
        var translateY = Math.round(y);
        var baseScale = typeof this.zoom === 'number' ? this.zoom : 1;
        var scaleX = (this._movingRight ? -baseScale : baseScale);
        var transformValue = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scaleX + ', ' + baseScale + ')';
        this.transform(transformValue);
    };

    turkey.die = function() {
        if (!this.alive) return;

        if (this.dropTimer) {
            cancelAnimationFrame(this.dropTimer);
            this.dropTimer = null;
        }

        this.stop();
        this.alive = false;
        this.bug.classList.add('bug-dead');

        // Track feast and streak
        incrementFeastCounter();
        incrementStreakCounter();

        this.walkFrameCounter = 0;
        this.walkIndex = 0;

        // Apply cooked turkey sprite
        this.bug.style.backgroundColor = 'transparent';
        if (TurkeyCookedFrame) {
            this.bug.style.backgroundImage = 'url("' + TurkeyCookedFrame + '")';
        } else {
            this.bug.style.backgroundImage = 'url("' + COOKED_TURKEY_SPRITE.replace(/"/g, '\\"') + '")';
        }
        this.bug.style.backgroundRepeat = 'no-repeat';
        this.bug.style.backgroundPosition = 'center center';
        this.bug.style.imageRendering = 'pixelated';
        this.bug.style.setProperty('background-size', 'contain', 'important');

        var currentTop = this.bug.top;
        var groundLevel = document.documentElement.clientHeight - this.options.bugHeight - 20;
        var startTime = performance.now();
        var fallDuration = 800;
        var self = this;

        var fall = function(timestamp) {
            var elapsed = timestamp - startTime;
            var progress = Math.min(elapsed / fallDuration, 1);
            var eased = 1 - Math.pow(1 - progress, 2.5);
            var newTop = currentTop + (groundLevel - currentTop) * eased;

            self.moveBug(self.bug.left, newTop, 0);

            if (progress < 1) {
                self.dropTimer = requestAnimationFrame(fall);
            } else {
                setTimeout(function() {
                    // Reset turkey state before removal
                    self.walkFrameCounter = 0;
                    self.walkIndex = 0;
                    self._lastWalkX = undefined;

                    // Restore sprite before removal
                    if (self.forceWalkFrame) {
                        self.forceWalkFrame(true);
                    }

                    self.remove();
                    if (self._controller) {
                        self._controller.ensurePopulation();
                    }
                }, 2000);
            }
        };

        self.dropTimer = requestAnimationFrame(fall);
    };

    turkey.reset = function() {
        if (typeof originalReset === 'function') {
            originalReset.apply(this, arguments);
        }

        // Reset animation state
        this.walkFrameCounter = 0;
        this.walkIndex = 0;
        this._lastX = undefined;
        this._lastWalkX = undefined;
        this._movingRight = true;
        this.alive = true;
        this.stationary = false;
        this.toggle_stationary_counter = 9999;

        // Restore sprite from frame 0
        if (this.bug) {
            this.bug.style.visibility = 'hidden';
        }
        this.forceWalkFrame(true);
    };
};

TurkeyController.prototype.spawnTurkeyBug = function() {
    if (!this.transform) return;

    // Progressive difficulty: speed increases with feast count
    // Every 5 feasts = +10% speed, caps at 2x at 50 feasts
    var difficultyMultiplier = Math.min(1 + (FeastCounter / 50), 2);

    var aliveCount = 0;
    for (var i = 0; i < this.bugs.length; i++) {
        if (this.bugs[i].alive) {
            aliveCount++;
        }
    }

    if (aliveCount >= this.options.maxBugs) {
        return;
    }

    var clonedOptions = JSON.parse(JSON.stringify(this.options));
    clonedOptions.wingsOpen = !this.options.canFly || Math.random() >= 0.5;
    var baseSpeed = this.random(this.options.minSpeed, this.options.maxSpeed);
    clonedOptions.walkSpeed = baseSpeed * difficultyMultiplier;

    var turkey = SpawnBug();
    turkey.initialize(this.transform, clonedOptions);
    this.patchTurkeyBehaviors(turkey);
    this.bugs.push(turkey);
    turkey.walkIn();
    this.add_events_to_bug(turkey);
};

TurkeyController.prototype.ensurePopulation = function() {
    var alive = 0;
    for (var i = 0; i < this.bugs.length; i++) {
        if (this.bugs[i].alive) {
            alive++;
        }
    }

    var desired = Math.min(this.options.minBugs, this.options.maxBugs);
    while (alive < desired) {
        this.spawnTurkeyBug();
        alive++;
    }
};

TurkeyController.prototype.startPopulationMonitor = function() {
    var self = this;
    this.stopPopulationMonitor();
    this.populationTimer = setInterval(function() {
        self.ensurePopulation();
    }, 1500);
};

TurkeyController.prototype.stopPopulationMonitor = function() {
    if (this.populationTimer) {
        clearInterval(this.populationTimer);
        this.populationTimer = null;
    }
};

TurkeyController.prototype.stop = function() {
    this.stopPopulationMonitor();
    if (typeof BugDispatch.stop === 'function') {
        BugDispatch.stop.call(this);
    }
};

TurkeyController.prototype.end = function() {
    this.stopPopulationMonitor();
    if (typeof BugDispatch.end === 'function') {
        BugDispatch.end.call(this);
    }
};

// Export to window for global access
window.TurkeyController = TurkeyController;
