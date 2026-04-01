# Design Document: TikTok Video Resizer

## Overview

A zero-dependency, single-page static web application that runs entirely in the browser. The user uploads a horizontal video, the app center-crops every frame to a 9:16 aspect ratio using the Canvas API, re-encodes the result with the MediaRecorder API, and offers the output as a downloadable MP4. No build step, no backend, no network calls after initial page load.

The app is a single `index.html` file (with optional companion `style.css` and `app.js`) that can be dropped into any GitHub Pages repository and served as-is.

---

## Architecture

The entire application is a client-side pipeline with four logical stages:

```mermaid
flowchart LR
    A[User selects file] --> B[File Validation]
    B --> C[Frame Processor\nCanvas API]
    C --> D[MediaRecorder\nEncoder]
    D --> E[Blob URL\nDownload]
```

All stages run in the browser's main thread (or a Web Worker for frame processing if performance requires). No external services are contacted at any point.

### Key Browser APIs

| API | Role |
|---|---|
| `<input type="file">` | File selection |
| `FileReader` / `URL.createObjectURL` | Load video into memory |
| `<video>` element | Decode source frames |
| `<canvas>` | Draw and crop each frame |
| `MediaRecorder` | Encode canvas stream to WebM/MP4 |
| `HTMLAnchorElement.download` | Trigger file save |

### Hosting

A flat file layout works directly on GitHub Pages:

```
/
├── index.html   ← entire app (or references style.css + app.js)
├── style.css
└── app.js
```

No `_config.yml`, no build pipeline, no `package.json` required.

---

## Components and Interfaces

### 1. FileInputComponent

Renders the file `<input>` and drag-and-drop zone.

```
FileInputComponent
  - accepts: "video/mp4, video/quicktime, video/webm, video/*"
  - onFileSelected(file: File) → void
  - showError(message: string) → void
  - showFilename(name: string) → void
```

### 2. VideoProcessor

Core processing logic. Decodes the source video frame-by-frame by seeking a hidden `<video>` element, draws each frame onto a `<canvas>` with the crop transform applied, and feeds the canvas stream into a `MediaRecorder`.

```
VideoProcessor
  - process(file: File, onProgress: (ratio: number) => void): Promise<Blob>
  - computeCropRect(videoWidth, videoHeight): { sx, sy, sw, sh }
  - cancel(): void
```

**`computeCropRect` logic:**

Given input dimensions `W × H`:
- Target aspect ratio is `9:16`, so `targetAspect = 9/16 = 0.5625`
- If `W/H <= 9/16` (already portrait or square): no horizontal crop, `sw = W`, `sh = H`
- Otherwise (landscape): `sh = H`, `sw = H * 9/16`, `sx = (W - sw) / 2`, `sy = 0`

Output canvas is always `sw × sh` (the cropped dimensions).

### 3. ProgressBarComponent

A standard `<progress>` element wrapper.

```
ProgressBarComponent
  - update(ratio: number): void   // 0.0 – 1.0
  - complete(): void              // sets to 1.0, triggers transition
  - reset(): void
```

### 4. DownloadComponent

Creates a temporary object URL from the output `Blob` and triggers a download.

```
DownloadComponent
  - show(blob: Blob, originalFilename: string): void
    // derives output name: stripExtension(originalFilename) + "_tiktok.mp4"
  - hide(): void
```

### 5. ErrorComponent

Displays error messages and resets UI state.

```
ErrorComponent
  - show(message: string): void
  - clear(): void
```

### 6. BrowserCompatibilityGuard

Runs once on page load. Checks for `HTMLCanvasElement`, `MediaRecorder`, and `URL.createObjectURL`. If any are missing, replaces the app UI with a compatibility warning.

---

## Data Models

### CropRect

```js
{
  sx: number,  // source x offset (pixels)
  sy: number,  // source y offset (pixels, always 0 for center-crop)
  sw: number,  // source width to read from input frame
  sh: number,  // source height to read from input frame
}
```

### ProcessingState

```js
{
  status: 'idle' | 'processing' | 'done' | 'error',
  progress: number,       // 0.0 – 1.0
  outputBlob: Blob | null,
  errorMessage: string | null,
}
```

### OutputFilename derivation

```
input:  "my video.mp4"   → output: "my video_tiktok.mp4"
input:  "clip.MOV"       → output: "clip_tiktok.mp4"
input:  "recording.webm" → output: "recording_tiktok.mp4"
```

Strip the last extension (everything after the final `.`), append `_tiktok.mp4`.

---

## Frame-by-Frame Processing Strategy

`MediaRecorder` records a live `canvas.captureStream(fps)` stream. To drive it frame-by-frame:

1. Load the source `File` into a hidden `<video>` via `URL.createObjectURL`.
2. Once `loadedmetadata` fires, read `video.duration` and `video.videoWidth/Height`.
3. Compute `totalFrames = Math.round(duration * fps)` where `fps` is read from the video (fallback: 30).
4. For each frame `i` from `0` to `totalFrames - 1`:
   a. Set `video.currentTime = i / fps`
   b. Await the `seeked` event
   c. Call `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH)`
   d. Call `onProgress(i / totalFrames)`
5. Stop the `MediaRecorder`, collect the recorded `Blob`.

Audio is handled separately: the source `<video>` element's audio track is captured via `video.captureStream()` and merged with the canvas video stream using the `MediaStream` constructor before passing to `MediaRecorder`.

> Note: `HTMLVideoElement.requestVideoFrameCallback` can be used as a more accurate alternative where supported, with the seek-loop as fallback.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Crop rect produces valid 9:16 output for any input dimensions

*For any* input video width and height where the video is landscape (W/H > 9/16), `computeCropRect` must return a rect where `sw / sh === 9 / 16` and `sx === (W - sw) / 2` and `sy === 0`.

**Validates: Requirements 2.1**

### Property 2: Portrait input uses full width without horizontal crop

*For any* input video where `W / H <= 9 / 16` (already portrait or square), `computeCropRect` must return `sx = 0`, `sw = W`, covering the full frame width.

**Validates: Requirements 2.5**

> Note: Properties 1 and 2 together fully specify `computeCropRect` for all valid inputs.

### Property 3: All frames are processed

*For any* video with a computed `totalFrames` count, the number of `drawImage` calls made during processing must equal `totalFrames`.

**Validates: Requirements 2.2**

### Property 4: Frame rate is preserved

*For any* input video with detected frame rate `fps`, the `captureStream` call on the output canvas must use that same `fps` value.

**Validates: Requirements 2.3**

### Property 5: Progress value reflects frames processed

*For any* video with `totalFrames` frames, after processing frame `i`, the value reported to `onProgress` must equal `i / totalFrames`. At completion, the value must be `1.0`.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: UI is locked during processing

*For any* processing state where `status === 'processing'`, the file input element and the process button must both have the `disabled` attribute set.

**Validates: Requirements 4.4**

### Property 7: Output filename follows naming pattern

*For any* input filename string, the derived output filename must equal `stripExtension(filename) + "_tiktok.mp4"`.

**Validates: Requirements 5.2**

### Property 8: Invalid file type triggers error display

*For any* file whose MIME type does not start with `video/`, selecting it must result in an error message being displayed and no processing being initiated.

**Validates: Requirements 1.2**

### Property 9: Valid file selection displays the filename

*For any* valid video file, after selection the UI must display the file's `.name` property.

**Validates: Requirements 1.3**

### Property 10: Processing errors reset UI to idle

*For any* error thrown during the processing pipeline, the app must display a descriptive error message and return `status` to `'idle'`, allowing the user to retry.

**Validates: Requirements 6.2**

### Property 11: No network calls during processing

*For any* video file processed by the app, no calls to `fetch`, `XMLHttpRequest`, or `navigator.sendBeacon` must be made during the processing pipeline.

**Validates: Requirements 3.2**

---

## Error Handling

| Condition | Detection | Response |
|---|---|---|
| Unsupported browser | Check `window.MediaRecorder`, `HTMLCanvasElement.prototype.captureStream` on load | Replace app UI with compatibility warning (Req 6.1) |
| Non-video file selected | Check `file.type.startsWith('video/')` | Show inline error, do not proceed (Req 1.2) |
| Processing exception | `try/catch` around the frame loop | Show error message, reset state to `idle` (Req 6.2) |
| Out-of-memory | Catch `RangeError` or generic errors with OOM-like messages | Show specific memory error message (Req 6.3) |
| MediaRecorder not producing data | `ondataavailable` never fires / empty blob | Show processing error, reset (Req 6.2) |

All errors set `ProcessingState.status = 'error'` and populate `errorMessage`. The UI observes this state and renders accordingly. A "Try Again" action resets state to `idle`.

---

## Testing Strategy

### Dual Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests cover specific examples, integration points, and error conditions.
- Property tests verify universal correctness across randomized inputs.

### Unit Tests (specific examples and integration)

- File input renders with correct `accept` attribute (Req 1.1)
- MP4, MOV, WebM files are accepted; `.txt`, `.jpg` are rejected (Req 1.4)
- Audio tracks from source stream are included in MediaRecorder input (Req 2.4)
- Progress bar initializes at 0% and shows 100% on completion (Req 4.1, 4.3)
- Download button appears after processing completes (Req 5.1)
- Download uses blob URL anchor click, does not change `window.location` (Req 5.4)
- Compatibility guard shows warning when `MediaRecorder` is undefined (Req 6.1)
- OOM-like error shows memory-specific message (Req 6.3)
- App HTML uses only relative paths (Req 7.2)

### Property-Based Tests

Use a property-based testing library appropriate for the target language. For plain JavaScript, **fast-check** is the recommended choice (no build step required via CDN or inline bundle).

Each property test must run a minimum of **100 iterations**.

Each test must include a comment tag in the format:
`// Feature: tiktok-video-resizer, Property N: <property text>`

| Property | Test Description | fast-check Arbitraries |
|---|---|---|
| P1 | `computeCropRect` returns 9:16 rect for landscape inputs | `fc.integer({min:1001,max:4000})` for W, derive H so W/H > 9/16 |
| P2 | `computeCropRect` returns full-width rect for portrait inputs | W, H where W/H ≤ 9/16 |
| P3 | Frame count equals `drawImage` call count | `fc.integer({min:1,max:300})` for totalFrames |
| P4 | `captureStream` fps matches detected input fps | `fc.integer({min:1,max:120})` for fps |
| P5 | Progress at frame i equals i/totalFrames | `fc.integer({min:1,max:300})` for totalFrames, `fc.integer` for i |
| P6 | File input + button disabled when status is 'processing' | Simulate processing state |
| P7 | Output filename = `stripExtension(name) + "_tiktok.mp4"` | `fc.string()` for filename with random extensions |
| P8 | Non-video MIME type always triggers error | `fc.string()` filtered to non-`video/` prefixes |
| P9 | Valid video file selection displays `.name` | `fc.string()` for filename with `video/` MIME |
| P10 | Any thrown error resets status to idle with message | `fc.string()` for error message |
| P11 | No fetch/XHR calls during processing | Spy on `window.fetch` and `XMLHttpRequest.prototype.open` |

### Notes on `computeCropRect` (P1 + P2)

`computeCropRect` is a pure function with no side effects, making it the highest-value target for property testing. The two properties together form a complete specification:

```js
// Feature: tiktok-video-resizer, Property 1: crop rect produces valid 9:16 output
fc.assert(fc.property(
  fc.integer({min: 1, max: 4000}),
  fc.integer({min: 1, max: 4000}),
  (w, h) => {
    const rect = computeCropRect(w, h);
    if (w / h > 9 / 16) {
      return Math.abs(rect.sw / rect.sh - 9 / 16) < 0.001
          && rect.sx === Math.floor((w - rect.sw) / 2);
    } else {
      return rect.sw === w && rect.sx === 0;
    }
  }
), { numRuns: 100 });
```
