# 🦃 Thanksgiving Theme - Assets Needed

## Current Status
✅ Code implementation complete
✅ Folder structure created
✅ Background image in place (tgiving background.png)
❌ Need: Turkey sprite sheet
❌ Need: Leaf images (5 PNG files)
❌ Need: Sound effects (2-3 MP3 files)

---

## 🎨 **REQUIRED ASSETS**

### 1. Turkey Sprite Sheet ⭐ CRITICAL

**File:** `assets/thanksgiving/sprites/turkey-sprite.png`

**Specifications:**
- Dimensions: 480×100px (6 frames total)
- Layout: Horizontal sprite sheet
  - Frames 1-4: Walking animation (80×100px each)
  - Frames 5-6: Death animation (80×100px each)
- Format: PNG with transparency
- Turkey should face RIGHT (walking direction)

**Where to get it:**
1. **OpenGameArt.org - LPC Turkey** (RECOMMENDED)
   - URL: https://opengameart.org/content/4-frame-walk-cycles
   - Search for "turkey" or "chicken" sprites
   - Download and resize to 80×100px per frame
   - License: CC0 / Open Source

2. **Alternative: Create your own**
   - Use https://www.piskelapp.com/ (free pixel art tool)
   - Create 4-frame walk cycle + 2-frame death animation
   - Export as sprite sheet

3. **Alternative: Commission**
   - Fiverr: Search "pixel art sprite" ($15-50)
   - Specify: Turkey, 4-frame walk + 2-frame death, 80×100px frames

4. **Temporary Placeholder:**
   - Use chicken or bird sprites from OpenGameArt
   - Replace later with actual turkey

---

### 2. Autumn Leaf Images

**Files needed:**
- `assets/thanksgiving/sprites/leaf-1.png` (Orange)
- `assets/thanksgiving/sprites/leaf-2.png` (Red)
- `assets/thanksgiving/sprites/leaf-3.png` (Gold)
- `assets/thanksgiving/sprites/leaf-4.png` (Brown)
- `assets/thanksgiving/sprites/leaf-5.png` (Mixed/Yellow-Green)

**Specifications:**
- Dimensions: 30-60px each (varied sizes for natural effect)
- Format: PNG with transparency
- Autumn colors: Orange (#FF7518), Red (#C94B4B), Gold (#D4AF37), Brown (#8B4513)

**Where to get them:**

**Option 1: Free SVG → PNG Conversion** (RECOMMENDED - 10 minutes)
1. Download free autumn leaf SVG from:
   - https://www.svgrepo.com/collection/autumn-leaves/
   - https://www.vecteezy.com/free-vector/autumn-leaves
2. Open in any image editor (even MS Paint can open SVG)
3. Change colors to match autumn palette
4. Export as PNG at 40-50px size
5. Save 5 variations with different colors

**Option 2: Use Emoji** (QUICKEST - 2 minutes)
1. Go to https://emojipedia.org/fallen-leaf/
2. Download leaf emoji as PNG
3. Tint to different autumn colors in any image editor
4. Save 5 color variations

**Option 3: OpenGameArt** (5 minutes)
- Search "autumn leaves" or "fall leaves"
- Download PNG sprites
- Resize to 30-60px

**Quick placeholder:** Use any small colorful circle or square PNGs until you get proper leaves

---

### 3. Sound Effects

#### **A. Turkey Gobble Sound** ⭐ HIGH PRIORITY

**File:** `assets/thanksgiving/sounds/turkey-gobble.mp3`

**Where to download (FREE):**

1. **SoundBible.com** (RECOMMENDED)
   - URL: https://soundbible.com/tags-turkey-gobble.html
   - Click "Turkey Gobble"
   - Download as MP3
   - License: Public Domain / Attribution

2. **Pixabay**
   - URL: https://pixabay.com/sound-effects/search/turkey/
   - Filter by "Free" license
   - Download MP3 format

3. **Quick Sounds**
   - URL: https://quicksounds.com/sound/5405/turkey-gobble
   - Click download button
   - Free MP3

**Specifications:**
- Duration: 1-3 seconds
- Format: MP3
- Size: < 100KB preferred
- Volume: Will be set to 60% in code

#### **B. Gunshot Sound** ⭐ HIGH PRIORITY

**File:** `assets/thanksgiving/sounds/gunshot.mp3`

**Where to download (FREE):**

1. **SoundBible.com**
   - URL: https://soundbible.com/
   - Search: "rifle shot" or "gunshot"
   - Download as MP3
   - Recommended: "Gun Shot.wav" (convert to MP3)

2. **Zapsplat** (Free account required)
   - URL: https://www.zapsplat.com/
   - Search: "gunshot"
   - Download MP3

3. **FreeSFX**
   - URL: https://www.freesfx.co.uk/
   - Category: Weapons → Gun Shots
   - Download MP3

**Specifications:**
- Duration: 0.5-1 second
- Format: MP3
- Quick, sharp sound (not too loud)
- Volume: Will be set to 40% in code

#### **C. Hit Sound** (OPTIONAL)

**File:** `assets/thanksgiving/sounds/hit.mp3`

**Where to download:**
- Same sources as above
- Search: "impact" or "hit" or "thud"
- Quick impact sound (< 0.5 seconds)

---

## 📋 **QUICK START CHECKLIST**

### Minimum to test the theme (30 minutes):
- [ ] Download 1 turkey sprite OR use placeholder bird sprite
- [ ] Create/download 5 leaf PNG images (can be simple colored circles)
- [ ] Download turkey gobble MP3 from SoundBible
- [ ] Download gunshot MP3 from SoundBible
- [ ] Refresh browser and test!

### For full experience (1-2 hours):
- [ ] Get proper pixel art turkey sprite (4-frame walk + 2-frame death)
- [ ] Get 5 detailed autumn leaf PNG images
- [ ] Download both sound effects
- [ ] Optional: Download hit sound
- [ ] Test all interactions

---

## 🎯 **TESTING CHECKLIST**

Once assets are in place:

1. **Falling Leaves Test:**
   - [ ] Refresh page
   - [ ] See leaves falling continuously
   - [ ] Leaves rotate and sway naturally
   - [ ] 5 different leaf colors visible

2. **Turkey Hunt Test:**
   - [ ] Cursor changes to crosshair
   - [ ] Turkeys appear and walk across screen
   - [ ] Click turkey → gunshot sound plays
   - [ ] Turkey disappears after being shot
   - [ ] New turkeys spawn to replace shot ones
   - [ ] Random turkey gobbles every few seconds

3. **Interactive Text Test:**
   - [ ] Add "Happy Thanksgiving!" to a maintenance panel item
   - [ ] Click the text
   - [ ] Screen shakes
   - [ ] Loud gobble plays
   - [ ] Extra turkeys spawn

---

## 🔧 **TEMPORARY PLACEHOLDERS**

### If you can't get assets immediately:

**For Turkey Sprite:**
```
Use any small animal sprite temporarily. Code will work with:
- Bug sprites (already on your site)
- Bird sprites
- Even colored rectangle PNG
```

**For Leaves:**
```
Create 5 simple colored circle PNGs:
- leaf-1.png: Orange circle
- leaf-2.png: Red circle
- leaf-3.png: Gold circle
- leaf-4.png: Brown circle
- leaf-5.png: Yellow circle
```

**For Sounds:**
```
Can comment out sound code temporarily:
- In dom.js, comment out lines 1078-1152 (sound initialization)
- Theme will work silently
```

---

## 📞 **NEED HELP?**

### Can't find turkey sprite?
- Try searching "chicken sprite" or "bird sprite" as temporary
- Use the bug sprites your site already has
- Commission on Fiverr for $15-30

### Can't download sounds?
- Check spam folder for download emails
- Try incognito mode if site blocks downloads
- Use YouTube to MP3 converter for turkey sounds

### Images too large?
- Use https://tinypng.com/ to compress
- Resize at https://www.iloveimg.com/resize-image

---

## ✅ **DONE!**

Once all assets are in place:
1. Clear browser cache (Ctrl+F5)
2. Refresh page
3. Enjoy your Thanksgiving theme! 🦃🍂

**Remember:** Set `THANKSGIVING_MODE = true` in `assets/js/dom.js` line 12
