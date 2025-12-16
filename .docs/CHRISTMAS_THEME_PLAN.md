# Christmas Theme Implementation Plan

## Overview
Replace the Thanksgiving theme (turkeys + falling leaves) with a Christmas theme featuring:
- **Gingerbread men** walking across the screen
- **Click to throw snowballs** at them
- **Hit gingerbread → transforms into present** that falls to ground
- **Falling snowflakes** background effect
- **Cozy fireplace** background (user-provided)
- **Keep red/gold color scheme** (works for Christmas!)

---

## Game Mechanics

### Current (Thanksgiving)
- Turkeys walk across screen
- Click turkey → turns into cooked turkey → falls
- Tracks: Feasts, Streak, Highest Streak

### New (Christmas)
- Gingerbread men run across screen
- Click gingerbread → snowball thrown → turns into wrapped present → falls
- Tracks: **Gifts Wrapped**, **Streak**, **Highest Streak**

### Visual Flow
```
[Gingerbread running] → [Click/Hit] → [Snowball splash effect] → [Present appears] → [Falls to ground] → [Fades out]
```

---

## Assets Needed

### 1. Gingerbread Man Sprites
**Source:** [OpenGameArt - Gingerbread Man](https://opengameart.org/content/gingerbread-man-0)
- **Size:** 48x64 pixels
- **Animations:** 4 directions (N/E/S/W), 3 frames each = 12 frames
- **License:** CC-BY 4.0 (free, attribution required)
- **Download:** ZIP file ~40KB

**Files to create:**
```
assets/christmas/sprites/
├── gingerbread_walk_1.png
├── gingerbread_walk_2.png
├── gingerbread_walk_3.png
├── gingerbread_walk_4.png
├── gingerbread_walk_5.png
├── gingerbread_walk_6.png
└── gingerbread_sheet.png (optional combined)
```

### 2. Present/Gift Sprites
**Sources:**
- [itch.io Christmas Assets](https://itch.io/game-assets/tag-christmas)
- [CleanPNG Gift Box](https://www.cleanpng.com/free/gift-box.html)
- [PNGitem Christmas Gift Sprite](https://www.pngitem.com/middle/iombmmb_christmas-gift-sprite-hd-png-download/)

**Files to create:**
```
assets/christmas/sprites/
├── present_red.png
├── present_green.png
├── present_gold.png (variety)
└── present_unwrap.png (optional animation)
```

### 3. Snowball Effect (Optional)
Simple white circle with blur, or splash effect sprite

```
assets/christmas/sprites/
├── snowball.png
└── snowball_splash.png
```

### 4. Background
**User will provide:** Cozy fireplace/Christmas background
```
assets/christmas/images/
└── fireplace_bg.jpg (or .png)
```

### 5. Snowflake Images (Optional - can use CSS unicode)
```
assets/christmas/images/
└── snowflake.png (optional, can use ❄ ❅ ❆ unicode)
```

### 6. Sounds (User will find)
```
assets/christmas/sounds/
├── snowball_throw.mp3
├── snowball_hit.mp3
├── gift_wrap.mp3 (present appears)
├── jingle.mp3 (streak bonus)
└── ambient_fireplace.mp3 (optional background)
```

---

## Files to Modify

### 1. Rename/Create Controller
| Current | New |
|---------|-----|
| `assets/js/turkey-controller.js` | `assets/js/gingerbread-controller.js` |

### 2. Update DOM References
**File:** `assets/js/dom.js`
- Change `THANKSGIVING_MODE` → `CHRISTMAS_MODE`
- Update overlay class names
- Update counter labels ("Feasts" → "Gifts")
- Update sprite paths

### 3. Update CSS Styles
**File:** `assets/css/main.css`
- Rename `.thanksgiving-overlay` → `.christmas-overlay`
- Rename `.autumn-leaf` → `.snowflake`
- Update `@keyframes fallLeaf` → `@keyframes snowfall`
- Keep color scheme (red/gold works!)
- Update `.feast-counter` → `.gift-counter`

### 4. Update HTML
**File:** `index.html`
- Update any static Thanksgiving references

### 5. Asset Folders
| Current | New |
|---------|-----|
| `assets/thanksgiving/` | `assets/christmas/` |

---

## CSS Snowflake Animation

Based on [CSSnowflakes](https://pajasevi.github.io/CSSnowflakes/):

```css
/* Snowflake base */
.snowflake {
  color: #fff;
  font-size: 1em;
  font-family: Arial, sans-serif;
  text-shadow: 0 0 5px rgba(255,255,255,0.5);
  position: fixed;
  top: -10%;
  z-index: 9999;
  user-select: none;
  cursor: default;
  pointer-events: none;
  animation: snowflake-shake 3s ease-in-out infinite;
}

.snowflake .inner {
  animation: snowflake-fall 10s linear infinite;
}

@keyframes snowflake-fall {
  0% { transform: translateY(0); }
  100% { transform: translateY(110vh); }
}

@keyframes snowflake-shake {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(80px); }
}
```

```html
<!-- Repeat with different positions/delays -->
<div class="snowflake" style="left: 10%; animation-delay: 0s;">
  <div class="inner">❄</div>
</div>
<div class="snowflake" style="left: 20%; animation-delay: 1s;">
  <div class="inner">❅</div>
</div>
<!-- ... more snowflakes ... -->
```

---

## Implementation Checklist

### Phase 1: Assets Setup
- [ ] Create `assets/christmas/` folder structure
- [ ] Download gingerbread man sprites from OpenGameArt
- [ ] Extract/crop individual walk frames
- [ ] Find/create present sprite(s)
- [ ] Create snowball sprite (simple white circle)
- [ ] User provides: fireplace background
- [ ] User provides: sound effects

### Phase 2: Controller Refactor
- [ ] Copy `turkey-controller.js` → `gingerbread-controller.js`
- [ ] Rename all Turkey references → Gingerbread
- [ ] Update sprite paths
- [ ] Update frame counts/dimensions (48x64 vs turkey size)
- [ ] Modify die() function:
  - Add snowball throw animation
  - Transform to present sprite
  - Keep fall animation
- [ ] Update counter variable names (Feast → Gift)
- [ ] Update localStorage key (`christmas-gift-stats`)

### Phase 3: CSS Updates
- [ ] Add `.christmas-overlay` styles
- [ ] Add snowflake animation CSS
- [ ] Update/rename counter styles
- [ ] Add snowball splash effect CSS
- [ ] Keep `.bug` cursor as crosshair (or change to snowball cursor?)

### Phase 4: DOM Integration
- [ ] Add `CHRISTMAS_MODE` flag
- [ ] Update `renderApp()` to inject Christmas overlay
- [ ] Update counter HTML (Gifts Wrapped, Streak, Best)
- [ ] Generate snowflake elements dynamically
- [ ] Load `gingerbread-controller.js` instead of turkey

### Phase 5: Polish
- [ ] Add sound effects integration
- [ ] Test animations
- [ ] Adjust timing/speeds
- [ ] Mobile responsiveness check
- [ ] Performance optimization

---

## Counter Display Update

### Current (Thanksgiving)
```
🦃 Feasts: 12 | 🔥 Streak: 3 | 👑 Best: 8
```

### New (Christmas)
```
🎁 Gifts: 12 | ❄ Streak: 3 | ⭐ Best: 8
```

---

## Sprite Specifications

### Gingerbread Man
- **Original:** 48x64 pixels per frame
- **Display size:** Scale up 2-3x for visibility (~144x192 or ~96x128)
- **Animation:** 3 frames walk cycle
- **Direction:** Horizontal movement only (use E/W frames)
- **Flip:** Mirror sprite based on movement direction

### Present
- **Size:** ~60x60 to 80x80 pixels
- **Animation:** Static (or optional unwrap animation)
- **Variety:** 2-3 color variants for visual interest

### Snowball
- **Size:** ~20x20 pixels
- **Effect:** Quick throw animation + splash on hit

---

## Color Palette (Keep Current)
```css
--solidcam-red: #C8102E;    /* Christmas red ✓ */
--solidcam-gold: #D4AF37;   /* Gold/star color ✓ */
--text-primary: #ffffff;    /* Snow white ✓ */
```

Optional additions:
```css
--christmas-green: #165B33;  /* Tree green */
--christmas-white: #F8F8F8;  /* Snow */
```

---

## Resources & Credits

### Sprites
- **Gingerbread Man:** [OpenGameArt](https://opengameart.org/content/gingerbread-man-0) by Jordan Irwin (AntumDeluge) - CC-BY 4.0

### CSS Animations
- **Snowflakes:** [CSSnowflakes](https://pajasevi.github.io/CSSnowflakes/) - Pure CSS solution
- **More effects:** [FreeFrontend CSS Snow Effects](https://freefrontend.com/css-snow-effects/)

### Additional Asset Sources
- [itch.io Christmas Assets](https://itch.io/game-assets/tag-christmas)
- [CraftPix Free Assets](https://craftpix.net/freebies/)
- [Game Art 2D](https://www.gameart2d.com/freebies.html)

---

## Timeline Estimate
This is a medium-complexity feature involving:
1. Asset preparation (sprites, sounds)
2. JavaScript controller refactor
3. CSS animations
4. Integration & testing

Ready to implement once assets are gathered!
