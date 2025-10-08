# SolidCAM Cheat Sheet - Project Context

## Project Overview
Interactive HTML cheat sheet for SolidCAM packages, maintenance SKUs, and module information. Features drag-and-drop reordering, click-to-copy functionality, and persistent storage.

## Current File
**Main file:** `dongle-cheatsheet v4.html` (1543 lines)
**Logo file:** `SolidCAM_TheEcosystemForDigitalManufacturing.svg`

## Design Theme
- **Colors:** SolidCAM red (#C8102E), dark red (#A51008), gold (#D4AF37)
- **Background:** Dark theme (#1a1a1a) with gradient panels
- **Typography:** System fonts, monospace for code elements
- **Layout:** CSS Grid responsive layout with dark theme styling
## Key Features

### 1. Interactive Package Table
- **Structure:** HTML table with Package, Maintenance, and Included Bits columns
- **Packages:** SC-Mill, SC-Turn, SC-Mill-Adv, SC-Mill-3D, SC-Mill-5Axis
- **Interactive Elements:** Clickable code elements, checkbox grids for each package's included bits

### 2. Side Panels
Three right-side panels containing:
- **Standalone Modules:** Convert5X, EdgeBreak, EdgeTrim, G-Code Simulation, iMach2d, MachSim, MTS, Multiaxis, Multiblade, Port, Probe, Sim4x, Sim5x, Swiss, Vericut
- **Maintenance SKUs:** All corresponding -Maint versions of modules plus package maintenance items
- **SolidWorks Maintenance:** SW-P-Maint, SW-PA-Maint, SW-Pro-Maint, SW-Pro-Net-Maint, SW-Std-Maint, SW-Std-Net-Maint

### 3. Click-to-Copy Functionality
- **Implementation:** JavaScript event listeners on all `<code>` elements
- **Behavior:** Copies text content to clipboard using Clipboard API
- **Visual Feedback:** CSS animation with `.copied` class (golden glow effect)
- **Restriction:** Disabled during Edit Mode to prevent interference with drag operations

### 4. Drag-and-Drop Reordering
- **Toggle:** "Edit Order" button toggles edit mode on/off
- **Technology:** Native HTML5 Drag and Drop API
- **Implementation:** Swap-based approach using `dragstart`, `dragend`, `dragover`, `dragenter`, `dragleave` events
- **Persistence:** Order saved to localStorage as JSON structure
- **Reset:** "Reset Order" clears localStorage and reloads page

### 5. Reset Functionality
- **Reset Checks:** Clears all bit checkboxes via `document.querySelectorAll('.bit-checkbox')`
- **Reset Order:** Removes `solidcam-cheatsheet-order` from localStorage with page reload

### 6. External Resource Integration
Header buttons linking to:
- **Support Sites:** https://solidcam.com/subscription/technical-support/, https://solidcamsupport.com/
- **Educational Resources:** https://www.youtube.com/c/SolidCAMUniversity, https://elearning-solidcam.talentlms.com/
- **AI Assistance:** https://www.solidcamchat.com/

## Technical Implementation

### HTML Structure
- **Document Type:** HTML5 with proper meta tags and responsive viewport
- **CSS Location:** Embedded `<style>` block with CSS custom properties (variables)
- **JavaScript Location:** Embedded `<script>` with IIFE pattern
- **Logo:** Inline SVG embedded directly in HTML

### CSS Architecture
- **CSS Variables:** Custom properties for consistent theming
- **Layout:** CSS Grid for main structure, Flexbox for component layouts
- **Responsive:** Mobile breakpoint at 768px with single-column layout
- **Interactive States:** Separate classes for edit mode, drag states, copy feedback

### JavaScript Functionality
- **Event Listeners:** Attached to code elements for click-to-copy
- **Drag & Drop:** HTML5 API implementation with swap-based reordering
- **State Management:** localStorage for order persistence
- **Edit Mode:** Toggle functionality with visual state changes

### Data Persistence
- **Storage Key:** `solidcam-cheatsheet-order`
- **Format:** JSON structure with panel names and item arrays
- **Scope:** Preserves both panel item order and checkbox states

### Browser Requirements
- **Clipboard API:** `navigator.clipboard.writeText()` for copy functionality
- **HTML5 Drag & Drop:** Native API for reordering features
- **localStorage:** For persistent order storage
- **CSS Grid & Flexbox:** For layout implementation

## Package Information

### Core Packages
1. **SC-Mill** - Core milling bundle for indexed rotary work
2. **SC-Turn** - Turning foundation with back spindle support
3. **SC-Mill-Adv** - Advanced milling add-on (iMachining 2D, Edge Breaking, Machine Simulation)
4. **SC-Mill-3D** - 3D iMachining and HSM (requires iMach2D)
5. **SC-Mill-5Axis** - Full simultaneous 4/5 axis toolkit

### Maintenance Codes
- **SC-Mill-Maint** - Maintenance for SC-Mill package
- **SC-Turn-Maint** - Maintenance for SC-Turn package
- **SC-Mill-Adv-Maint** - Maintenance for SC-Mill-Adv package
- **SC-Mill-3D-Maint** - Maintenance for SC-Mill-3D package
- **SC-Mill-5Axis-Maint** - Maintenance for SC-Mill-5Axis package

## Module Information

### Standalone Modules
Convert5X, EdgeBreak, EdgeTrim, G-Code Simulation, iMach2d, MachSim, MTS, Multiaxis, Multiblade, Port, Probe, Sim4x, Sim5x, Swiss, Vericut

### Module Maintenance
All modules have corresponding maintenance SKUs with "-Maint" suffix

## SolidWorks Maintenance
SW-P-Maint, SW-PA-Maint, SW-Pro-Maint, SW-Pro-Net-Maint, SW-Std-Maint, SW-Std-Net-Maint

## External Resources
- **Main Support Site:** https://solidcam.com/subscription/technical-support/
- **Support Ticket Site:** https://solidcamsupport.com/
- **SolidCAM University:** https://www.youtube.com/c/SolidCAMUniversity
- **SolidCAM Academy:** https://elearning-solidcam.talentlms.com/
- **SolidCAM ChatBot:** https://www.solidcamchat.com/