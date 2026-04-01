# Implementation Plan: TikTok Video Resizer

## Overview

Implement a zero-dependency static web app (HTML/CSS/JS) that center-crops horizontal video to 9:16 using the Canvas API and MediaRecorder seek-loop, with progress indication and a downloadable MP4 output. All code runs client-side with no build step.

## Tasks

- [x] 1. Create static file structure and browser compatibility guard
  - Create `index.html` with semantic layout: file input zone, progress bar, download button, error area
  - Create `style.css` with minimal styling for all UI states (idle, processing, done, error)
  - Create `app.js` as the main entry point
  - Implement `BrowserCompatibilityGuard`: on page load check for `HTMLCanvasElement`, `MediaRecorder`, and `URL.createObjectURL`; if any missing, replace app UI with a compatibility warning
  - All asset paths must be relative (no absolute URLs)
  - _Requirements: 6.1, 7.1, 7.2, 7.3_

- [x] 2. Implement file input and validation
  - [x] 2.1 Implement `FileInputComponent`
    - Render `<input type="file" accept="video/mp4,video/quicktime,video/webm,video/*">`
    - On file selected: check `file.type.startsWith('video/')`, show error if not, display filename if valid
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Write property test for invalid file type triggers error (Property 8)
    - **Property 8: Invalid file type triggers error display**
    - **Validates: Requirements 1.2**

  - [x] 2.3 Write property test for valid file selection displays filename (Property 9)
    - **Property 9: Valid file selection displays the filename**
    - **Validates: Requirements 1.3**

- [x] 3. Implement `computeCropRect` pure function
  - [x] 3.1 Implement `computeCropRect(videoWidth, videoHeight)`
    - If `W/H > 9/16`: `sh = H`, `sw = Math.round(H * 9/16)`, `sx = Math.floor((W - sw) / 2)`, `sy = 0`
    - If `W/H <= 9/16`: `sx = 0`, `sy = 0`, `sw = W`, `sh = H`
    - Return `{ sx, sy, sw, sh }`
    - _Requirements: 2.1, 2.5_

  - [x] 3.2 Write property test for landscape crop produces 9:16 rect (Property 1)
    - **Property 1: Crop rect produces valid 9:16 output for any landscape input dimensions**
    - **Validates: Requirements 2.1**

  - [x] 3.3 Write property test for portrait input uses full width (Property 2)
    - **Property 2: Portrait input uses full width without horizontal crop**
    - **Validates: Requirements 2.5**

- [x] 4. Implement `VideoProcessor` — seek-loop and frame rendering
  - [x] 4.1 Implement the seek-loop frame processor
    - Load `File` into hidden `<video>` via `URL.createObjectURL`
    - On `loadedmetadata`: read `duration`, `videoWidth`, `videoHeight`, detect `fps` (fallback 30)
    - Compute `totalFrames = Math.round(duration * fps)`
    - Create offscreen `<canvas>` sized to `sw × sh` from `computeCropRect`
    - For each frame `i`: set `video.currentTime = i / fps`, await `seeked`, call `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH)`, call `onProgress(i / totalFrames)`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.2 Write property test for all frames are processed (Property 3)
    - **Property 3: All frames are processed — drawImage call count equals totalFrames**
    - **Validates: Requirements 2.2**

  - [x] 4.3 Write property test for frame rate is preserved (Property 4)
    - **Property 4: captureStream fps matches detected input fps**
    - **Validates: Requirements 2.3**

  - [x] 4.4 Write property test for progress value reflects frames processed (Property 5)
    - **Property 5: Progress at frame i equals i/totalFrames; at completion equals 1.0**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 5. Implement audio capture and MediaRecorder encoding
  - [x] 5.1 Wire audio + canvas streams into MediaRecorder
    - Capture canvas video stream via `canvas.captureStream(fps)`
    - Capture audio track from source `video.captureStream()` and merge into a combined `MediaStream`
    - Instantiate `MediaRecorder` with the combined stream; prefer `video/mp4` MIME, fallback to `video/webm`
    - Collect `ondataavailable` chunks; on `stop`, assemble final `Blob`
    - _Requirements: 2.4, 5.3_

  - [x] 5.2 Write property test for no network calls during processing (Property 11)
    - **Property 11: No fetch/XHR/sendBeacon calls are made during the processing pipeline**
    - **Validates: Requirements 3.2**

- [x] 6. Implement `ProgressBarComponent` and UI lock
  - [x] 6.1 Implement `ProgressBarComponent` and processing UI lock
    - Wrap a `<progress>` element with `update(ratio)`, `complete()`, and `reset()` methods
    - On processing start: set progress to 0, disable file input and process button
    - On `onProgress` callback: call `update(ratio)`
    - On completion: call `complete()` (sets to 1.0), re-enable controls
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Write property test for UI is locked during processing (Property 6)
    - **Property 6: File input and process button are disabled when status is 'processing'**
    - **Validates: Requirements 4.4**

- [x] 7. Implement `DownloadComponent` and output filename derivation
  - [x] 7.1 Implement `DownloadComponent` and `stripExtension` helper
    - `stripExtension(filename)`: remove everything after the last `.`
    - `show(blob, originalFilename)`: derive `stripExtension(originalFilename) + "_tiktok.mp4"`, create object URL, set on `<a download="...">`, trigger `.click()`, do not change `window.location`
    - Show download button only after processing completes
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 7.2 Write property test for output filename naming pattern (Property 7)
    - **Property 7: Output filename equals stripExtension(name) + "_tiktok.mp4" for any input filename**
    - **Validates: Requirements 5.2**

- [x] 8. Implement error handling and UI reset
  - [x] 8.1 Implement `ErrorComponent` and error recovery flow
    - Wrap `try/catch` around the entire frame-loop pipeline
    - Detect OOM-like errors (`RangeError` or messages containing "memory") and show a specific memory error message
    - All other errors: show descriptive message
    - On any error: set `status = 'idle'`, re-enable controls, show "Try Again" affordance
    - _Requirements: 6.2, 6.3_

  - [x] 8.2 Write property test for processing errors reset UI to idle (Property 10)
    - **Property 10: Any thrown error during processing resets status to idle with a message**
    - **Validates: Requirements 6.2**

- [x] 9. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 10. Set up fast-check property test harness
  - Create `tests/properties.test.js` (or inline `<script>` in `tests/index.html`) that loads fast-check via CDN
  - Each test must include the comment tag `// Feature: tiktok-video-resizer, Property N: <property text>`
  - Each property must run a minimum of 100 iterations (`{ numRuns: 100 }`)
  - Wire all 11 property sub-tasks (3.2, 3.3, 2.2, 2.3, 4.2, 4.3, 4.4, 5.2, 6.2, 7.2, 8.2) into this file
  - _Requirements: 3.1, 3.2_

- [x] 11. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All code is plain ES6+ JavaScript — no build step, no bundler, no npm
- fast-check is loaded via CDN in the test harness; no `package.json` needed
- Each task references specific requirements for traceability
- Property tests validate universal correctness; unit tests cover specific examples and edge cases
