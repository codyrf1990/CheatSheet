
# SolidCAM Packages & Maintenance Cheat Sheet

## Overview
This web app provides a fast reference for SolidCAM package details, maintenance options, and includes a built-in calculator. It is built with HTML, CSS, and JavaScript, and is easy to customize for your workflow.

## Features
- View SolidCAM package and maintenance information
- Use a calculator for quick math operations
- Copy data to clipboard with one click
- Drag-and-drop interface for organizing items
- Persistent data storage in browser

## Project Structure
```
CheatSheet/
├── index.html                # Main HTML file
├── assets/
│   ├── css/
│   │   └── main.css          # Stylesheet
│   ├── img/
│   │   ├── icons8-minus-64.png
│   │   ├── icons8-plus-64.png
│   │   ├── profile-icon.png
│   │   └── solidcam-logo.svg
│   └── js/
│       ├── app.js            # App initialization and logic
│       ├── calculator.js     # Calculator functionality
│       ├── copy.js           # Copy-to-clipboard logic
│       ├── data.js           # Data definitions
│       ├── dom.js            # DOM manipulation helpers
│       ├── drag-and-drop.js  # Drag-and-drop support
│       └── persistence.js    # Local storage helpers
```

## Getting Started
1. **Clone the repository:**
   ```bash
   git clone https://github.com/codyrf1990/CheatSheet.git
   cd CheatSheet
   ```
2. **Open the app:**
   - Open `index.html` directly in your browser, or
   - Serve the folder with a local web server (recommended for full functionality):
     ```bash
     python3 -m http.server
     # or
     npx serve
     ```
   - Visit `http://localhost:8000` in your browser.

## Usage

### Calculator
- Enter numbers and operations using the calculator interface.
- Use `C` to clear, `⌫` to delete, and `=` to calculate results.


### Cheat Sheet
- Browse SolidCAM package and maintenance details.
- Use drag-and-drop to organize or group items as needed.
- Click any code button to copy its information to your clipboard instantly.

### Data Persistence
- Your changes and organization are saved automatically in your browser.

## Customization
- **Images:** Replace or add images in `assets/img/` for your own branding.
- **Styles:** Edit `assets/css/main.css` to change colors, layout, or button styles.
- **Functionality:** Extend or modify JavaScript files in `assets/js/` to add new features or change behavior.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License
MIT

## Author
[codyrf1990](https://github.com/codyrf1990)
