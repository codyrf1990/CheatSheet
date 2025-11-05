# 🍂 Resize Leaf Images

## Current Situation:
You have 3 beautiful autumn leaf PNG files, but they're HUGE (3000-8000px each). The code expects small 40-60px leaf images.

## Leaf Files to Resize:
1. `assets/img/Autumn_Leaf_PNG_Clip_Art-2012.png` (7090×8000px)
2. `assets/img/Beautiful_Autumn_Leaf_PNG_Clipart_Image.png` (3274×3637px)
3. `assets/img/Yellow_Autumn_Leaf_PNG_Clipart_Image.png` (3977×3428px)

---

## ⚡ QUICK RESIZE OPTIONS:

### **Option 1: Online Tool** (EASIEST - 2 minutes)
1. Go to https://www.iloveimg.com/resize-image
2. Upload each leaf PNG
3. Resize to **50 pixels height** (keep aspect ratio)
4. Download resized images
5. Save as:
   - `leaf-1.png`
   - `leaf-2.png`
   - `leaf-3.png`
6. Copy to `/assets/thanksgiving/sprites/`

### **Option 2: Windows Paint / Mac Preview** (5 minutes)
1. Open leaf image in Paint (Windows) or Preview (Mac)
2. Resize → Set height to 50px
3. Save as PNG
4. Repeat for all 3 leaves

### **Option 3: Use ImageMagick** (if installed)
```bash
convert "assets/img/Autumn_Leaf_PNG_Clip_Art-2012.png" -resize x50 "assets/thanksgiving/sprites/leaf-1.png"
convert "assets/img/Beautiful_Autumn_Leaf_PNG_Clipart_Image.png" -resize x50 "assets/thanksgiving/sprites/leaf-2.png"
convert "assets/img/Yellow_Autumn_Leaf_PNG_Clipart_Image.png" -resize x50 "assets/thanksgiving/sprites/leaf-3.png"
```

---

## 📋 Create 5 Leaf Variations:

Once you have the 3 resized leaves:

**leaf-4.png:** Flip leaf-1 horizontally
**leaf-5.png:** Rotate leaf-2 by 180°

This gives variety to the falling leaves!

---

## ⏭️ TEMPORARY WORKAROUND:

**Want to test the turkey hunt NOW without leaves?**

1. Comment out the leaf rendering in `dom.js` (lines 909-939)
2. Or create 5 tiny placeholder images (even 10×10px colored squares work)
3. Turkey hunt will still work perfectly!

The theme works fine without leaves - they're just decorative background animation.
