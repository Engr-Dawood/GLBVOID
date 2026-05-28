# GLB Viewer 🧊

A browser-based, zero-dependency 3D model viewer for `.glb` files.
Drop any GLB onto the page — rotate it, zoom in/out, view it in wireframe, spin it 360°, and save a screenshot.

---

## Features

| Action | How |
|--------|-----|
| **Rotate** | Left-click and drag |
| **Zoom** | Scroll wheel / pinch (touch) |
| **Pan** | Right-click and drag / two-finger drag |
| **Auto-spin 360°** | Toolbar → *Auto Rotate* |
| **Wireframe mode** | Toolbar → *Wireframe* |
| **Ground grid** | Toolbar → *Grid* |
| **Re-fit camera** | Toolbar → *Fit View* |
| **Save PNG** | Toolbar → *Screenshot* |
| **Load new model** | Header → *Load Model* or drag & drop |

---

## File structure

```
glb-viewer/
├── index.html   ← page structure + Three.js import-map
├── style.css    ← all styling
├── app.js       ← Three.js viewer logic (ES module)
└── README.md    ← this file
```

No build step, no `node_modules`, no bundler required.
Everything is loaded from CDN at runtime.

---

## Running locally

You **cannot** open `index.html` directly as a `file://` URL because:
- ES module imports are blocked by CORS in most browsers.
- `URL.createObjectURL` behaves differently.

Use any static file server instead:

### Option A — VS Code Live Server (easiest)
1. Install the **Live Server** extension in VS Code.
2. Right-click `index.html` → **Open with Live Server**.
3. Browser opens at `http://127.0.0.1:5500`.

### Option B — Python (built-in)
```bash
# Python 3
cd glb-viewer
python -m http.server 8080
# then open http://localhost:8080
```

### Option C — Node.js `serve`
```bash
npx serve glb-viewer
```

---

## Publishing to GitHub Pages — Step-by-Step

### Step 1 — Create a GitHub account (skip if you have one)

Go to [https://github.com](https://github.com) and sign up for a free account.

---

### Step 2 — Create a new repository

1. Click the **+** icon in the top-right corner → **New repository**.
2. Fill in:
   - **Repository name**: `glb-viewer` (or any name you like — this becomes part of the URL)
   - **Description**: *(optional)*
   - **Public** ✅ ← GitHub Pages is free only for public repos on the free plan
   - **Add a README file**: leave it unchecked (we have our own)
3. Click **Create repository**.

---

### Step 3 — Upload the three files

**Method A — GitHub web interface (no Git required)**

1. On your new empty repository page, click **Add file → Upload files**.
2. Drag and drop (or click *choose your files* and select) these three files:
   - `index.html`
   - `style.css`
   - `app.js`
3. At the bottom, leave the commit message as-is or write something like `"Add GLB viewer"`.
4. Make sure **Commit directly to the `main` branch** is selected.
5. Click **Commit changes**.

**Method B — Git CLI (if you have Git installed)**

```bash
cd glb-viewer                          # your local folder with the 3 files

git init
git add index.html style.css app.js
git commit -m "Initial commit"

# replace YOUR_USERNAME and YOUR_REPO_NAME below
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

### Step 4 — Enable GitHub Pages

1. In your repository, click the **Settings** tab (top menu bar).
2. In the left sidebar, scroll down and click **Pages**.
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `(root)`  
     *(click the branch dropdown, select `main`, leave the folder as `/ (root)`)*
4. Click **Save**.

---

### Step 5 — Wait for deployment

GitHub will show a banner:

> *"Your site is being deployed to https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"*

Deployment usually takes **30 seconds to 2 minutes**.  
Refresh the Settings → Pages page; when it shows a green ✅ with the URL, it is live.

---

### Step 6 — Open your site

Visit:

```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

Replace `YOUR_USERNAME` with your GitHub username and `YOUR_REPO_NAME` with the
repository name you chose in Step 2.

**Bookmark it, share it, done!**

---

## Updating the site later

Just edit the files and push/upload again.
GitHub Pages redeploys automatically on every push to `main`.

---

## Technical notes

- **Three.js r169** is loaded via an `importmap` from jsDelivr CDN. No bundler needed.
- **DRACO decoder** (for compressed GLB) is loaded from the Google CDN (`gstatic.com`).
  If you are in an environment where gstatic is blocked, replace the decoder path in
  `app.js` with a self-hosted copy from the Three.js package (`examples/jsm/libs/draco/`).
- **`preserveDrawingBuffer: true`** is set on the renderer so that `canvas.toDataURL()`
  works correctly for the screenshot feature.
- The viewer automatically normalises every model to a ~2-unit bounding sphere so
  tiny or massive models both appear at a comfortable size.
- Embedded GLTF animations (if any) are automatically detected and played.

---

## Browser compatibility

Works in any modern browser that supports:
- ES modules + `<script type="importmap">` (Chrome 89+, Firefox 108+, Safari 16.4+, Edge 89+)
- WebGL 2 (all modern browsers)

---

## License

MIT — free to use, modify, and deploy.
