# Vibe-Coded-Apps

A collection of nine browser tools created with AI assistance for image editing, pattern design, flowcharts, file comparison, metadata cleanup, QR codes, 3D model inspection, and Factorio blueprints.

Each tool has its own folder and can be opened directly in a modern browser. No installation or build step is required.

## Explore the tools

| Tool | What you can do | Output |
| --- | --- | --- |
| [Factorio: Silhouette to Blueprint](factorio-silhouette-blueprint/) | Turn a silhouette image into a tile layout for Factorio. | Blueprint string, copied or saved as `.txt` |
| [FlowDiagDesigner](FlowDiagDesigner/) | Build flowcharts with shapes, text, images, and connectors. | Editable JSON or PNG |
| [Hash Check](hash-check/) | Compare two files by size and SHA-256, SHA-384, or SHA-512 hash. | Copyable hashes and printable HTML, TXT, or JSON reports |
| [Metadata Cleaner](metadata-cleaner/) | Inspect and remove selected metadata from JPEG, PNG, and WebP files. | Cleaned files or a batch ZIP |
| [Pattern Generator](pattern-generator/) | Create repeating patterns from an image with custom spacing, transforms, and colors. | PNG or SVG containing an embedded raster image |
| [QR Generator](qr-generator/) | Generate static QR codes from URLs or text, with adjustable colors and error correction. | PNG or vector SVG |
| [Quick Image Cut](quick-image-cut/) | Crop images with precise pixel dimensions and an interactive selection. | Cropped image |
| [SpriteLab](SpriteLab/dist/) | Paint, erase, and crop PNG sprites with pixel-level controls. | Full or cropped PNG |
| [Local STL Viewer](stl-viewer/) | Inspect ASCII or binary STL models with interactive 3D controls. | On-screen 3D preview and mesh statistics |

## Factorio: Silhouette to Blueprint

Convert a high-contrast silhouette into a Factorio tile blueprint for platform shapes or ground layouts.

- Upload or drag in an image and preview the resulting tile grid.
- Adjust the black threshold, in-game scale, maximum grid size, and smoothing.
- Use automatic or forced vertical symmetry, or disable it.
- Fill enclosed holes automatically.
- Choose Space platform foundation, Stone Brick, Concrete, or Refined concrete.
- Copy the blueprint string or download it as a text file, then import it into Factorio.

Black shapes on white or transparent backgrounds work best. Space platform foundation is intended for Factorio: Space Age.

[Usage and details](factorio-silhouette-blueprint/README.md)

## FlowDiagDesigner

Create flowcharts with shapes, text, images, and custom connection points. Style connectors and arrows, lock elements, and copy formatting between compatible elements. Save an editable JSON project to reopen later or export the full diagram as PNG.

[Usage and details](FlowDiagDesigner/README.md)

## Hash Check

Compare two files by size and content hash using SHA-256, SHA-384, or SHA-512. Copy the hashes or export a printable HTML, TXT, or JSON report. Each file can be up to 256 MiB. Hashing requires browser support for Web Crypto and workers.

[Usage and details](hash-check/README.md)

## Metadata Cleaner

Review metadata by category or field, then remove selected entries or all removable metadata. The tool preserves image data without recompression and supports individual downloads or batch ZIP exports. TXT files are copied byte for byte.

[Usage and details](metadata-cleaner/README.md)

## Pattern Generator

Build repeating artwork from an uploaded motif or reference image.

- Adjust rotation, scale, and horizontal or vertical skew.
- Control spacing, alternating row offsets, and repetition coverage through the density control.
- Customize motif and background colors, transparency, and opacity.
- Add a background-colored halo with adjustable size and softness to separate overlapping motifs.
- Export PNG or SVG.

Exports use a fixed 1600 × 1100 canvas. SVG exports embed a PNG rather than editable vector shapes. Transparent images use their alpha as a mask; opaque images use inverse luminance, making white areas transparent.

[Usage and details](pattern-generator/README.md)

## QR Generator

Create static QR codes that encode your URL or text directly.

- Encode URLs and UTF-8 text with QR versions 1 through 10.
- Choose from all four error-correction levels: L, M, Q, and H.
- Adjust image size, quiet-zone margin, foreground and background colors, and transparency.
- Preview the code and download PNG or crisp vector SVG.
- See warnings for low contrast, inverted colors, or transparent backgrounds that may affect scanning.

Include `https://` when encoding a web address. Payload capacity depends on text length and error correction. There is no redirect service or QR expiration service; availability of a linked website depends on that website.

[Usage and details](qr-generator/README.md)

## Quick Image Cut

Crop images locally while keeping control over the exported pixel dimensions.

- Upload an image using the file picker or drag and drop.
- Enter crop width and height in original image pixels, or enable square mode.
- Move the crop overlay and resize it with eight handles.
- Fine-tune its position with X/Y sliders, use size presets, or center the selection.
- Download the crop at its original pixel resolution.
- Reuse the current crop size and position when replacing an image during the same session.

PNG, JPEG, and WebP inputs export in their matching formats. Other browser-readable formats fall back to PNG data while retaining the original filename, so the extension may need correction. Metadata and animation are not preserved.

[Usage and details](quick-image-cut/README.md)

## SpriteLab

Open a PNG and edit it with a brush, rectangle, ellipse, eyedropper, and transparent eraser. Zoom and pan the canvas, preview the sprite against a reference background, and undo or redo edits. Export the full image or a selected crop as PNG. The reference background is only shown in the editor.

Open [`SpriteLab/dist/index.html`](SpriteLab/dist/index.html) from your local copy.

## Local STL Viewer

Inspect STL geometry in an interactive WebGL preview without uploading the model.

- Load ASCII or binary STL files with automatic centering and mesh statistics.
- Orbit, zoom, and pan using mouse or touch controls.
- Enable automatic orbit rotation and adjust its speed.
- Choose from five model colors.
- Rotate the model in 90-degree steps around the X, Y, or Z axis.
- Recenter the view when needed.

An internet connection is required to load Three.js and its controls from unpkg. A browser with WebGL support is required. STL dimensions are shown in the file's coordinate units; the format does not specify physical units. Large models may take longer to load and use significant memory.

[Usage and details](stl-viewer/README.md)

## Getting started

1. Download the repository using **Code → Download ZIP** and extract it, or clone it with Git.
2. Open the folder of the tool you want to use.
3. Open its `index.html` in a modern browser. For SpriteLab, open `SpriteLab/dist/index.html`.

For local development, you can also serve the repository from its root with Python:

```bash
python -m http.server 8765
```

Then open a tool at, for example, `http://localhost:8765/qr-generator/`.

GitHub's file preview shows the source code; download the files and open them locally to run the tools.

## Local processing and connectivity

The tools process files, diagrams, and QR payloads in your browser without uploading them to a processing server.

Eight tools can operate offline. Local STL Viewer fetches its 3D dependencies from a CDN. Optional external links, such as attribution or support links, require connectivity when followed. Language and theme preferences may be saved in browser storage.

## About and licensing

These tools are examples of applications created with AI assistance. Individual tools retain their own attribution, including MIMOmakers and the Factorio tool's project credit to `u/Pegaxsus`.

The repository includes an [Apache License 2.0](LICENSE). Individual tool documentation and attribution artwork also include Creative Commons notices, including CC BY-NC-SA. Review the relevant tool's README and included notices before reusing or redistributing it; the licensing information is not uniform across the collection.
