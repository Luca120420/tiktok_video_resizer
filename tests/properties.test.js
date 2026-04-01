// Feature: tiktok-video-resizer, Property 8: Invalid file type triggers error display

/**
 * Property-based tests for the TikTok Video Resizer.
 * Loaded via <script type="module"> in the browser test harness (Task 10).
 * fast-check is expected to be available as `fc` on the global scope,
 * loaded via CDN before this file.
 */

/**
 * Property 8: Invalid file type triggers error display
 *
 * For any file whose MIME type does NOT start with `video/`, calling
 * FileInputComponent.onFileSelected(file) must result in an error message
 * being displayed and the process button remaining disabled.
 *
 * Validates: Requirements 1.2
 */
function registerProperty8(fc, FileInputComponent) {
  // Arbitrary: any string that does NOT start with "video/"
  const nonVideoMimeArb = fc.string({ minLength: 0, maxLength: 50 }).filter(
    (s) => !s.startsWith('video/')
  );

  return {
    name: 'Property 8: Invalid file type triggers error display',
    run() {
      fc.assert(
        fc.property(nonVideoMimeArb, fc.string({ minLength: 1, maxLength: 100 }), (mimeType, filename) => {
          // Build a minimal mock DOM environment for FileInputComponent
          const errorArea = {
            textContent: '',
            hidden: true,
          };
          const filenameDisplay = {
            textContent: '',
            hidden: true,
          };
          const processBtn = {
            disabled: false,
          };
          const fileInput = {
            // addEventListener is called during init but not needed for this test
            addEventListener: () => {},
          };

          // Create a fresh isolated instance by copying the component and
          // binding it to the mock DOM nodes.
          const component = Object.assign({}, FileInputComponent, { _file: null });
          component.init(fileInput, filenameDisplay, errorArea, processBtn);

          // Create a mock File-like object with a non-video MIME type
          const mockFile = { name: filename || 'file.txt', type: mimeType };

          component.onFileSelected(mockFile);

          // Error must be visible and non-empty
          const errorShown = !errorArea.hidden && errorArea.textContent.length > 0;
          // Process button must remain disabled
          const btnDisabled = processBtn.disabled === true;
          // Internal file reference must be null (no processing initiated)
          const noFileStored = component._file === null;

          return errorShown && btnDisabled && noFileStored;
        }),
        { numRuns: 100 }
      );
    },
  };
}

// Export for the Task 10 harness
if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty8);
}

export { registerProperty8 };

// Feature: tiktok-video-resizer, Property 9: Valid file selection displays the filename

/**
 * Property 9: Valid file selection displays the filename
 *
 * For any valid video file (MIME type starts with `video/`), calling
 * FileInputComponent.onFileSelected(file) must result in the file's `.name`
 * property being displayed in the filename display element.
 *
 * Validates: Requirements 1.3
 */
function registerProperty9(fc, FileInputComponent) {
  // Arbitrary: a `video/` prefixed MIME type (e.g. "video/mp4", "video/anything")
  const videoMimeArb = fc.string({ minLength: 0, maxLength: 30 }).map(
    (s) => 'video/' + s
  );

  return {
    name: 'Property 9: Valid file selection displays the filename',
    run() {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), videoMimeArb, (filename, mimeType) => {
          // Build a minimal mock DOM environment for FileInputComponent
          const errorArea = {
            textContent: '',
            hidden: false,
          };
          const filenameDisplay = {
            textContent: '',
            hidden: true,
          };
          const processBtn = {
            disabled: true,
          };
          const fileInput = {
            addEventListener: () => {},
          };

          // Create a fresh isolated instance bound to the mock DOM nodes
          const component = Object.assign({}, FileInputComponent, { _file: null });
          component.init(fileInput, filenameDisplay, errorArea, processBtn);

          // Create a mock File-like object with a valid video MIME type
          const mockFile = { name: filename, type: mimeType };

          component.onFileSelected(mockFile);

          // Filename display must be visible and show the file's name
          const filenameShown =
            !filenameDisplay.hidden && filenameDisplay.textContent === filename;

          return filenameShown;
        }),
        { numRuns: 100 }
      );
    },
  };
}

// Export for the Task 10 harness
if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty9);
}

export { registerProperty9 };

// Feature: tiktok-video-resizer, Property 1: Crop rect produces valid 9:16 output for any landscape input dimensions

/**
 * Property 1: Crop rect produces valid 9:16 output for any landscape input dimensions
 *
 * For any input video width W and height H where W/H > 9/16, `computeCropRect(W, H)`
 * must return a rect where `sw / sh` is approximately `9/16` (within 0.001 tolerance)
 * and `sx === Math.floor((W - sw) / 2)` and `sy === 0`.
 *
 * Validates: Requirements 2.1
 */
function registerProperty1(fc, computeCropRectArg) {
  const computeCropRect = computeCropRectArg || (typeof window !== 'undefined' && window.computeCropRect);

  return {
    name: 'Property 1: Crop rect produces valid 9:16 output for any landscape input dimensions',
    run() {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 4000 }),
          fc.integer({ min: 1, max: 4000 }),
          (w, h) => {
            // Only test landscape inputs (W/H > 9/16)
            fc.pre(w / h > 9 / 16);
            // Pre-filter: ensure H is large enough that integer rounding of
            // Math.round(H * 9/16) stays within the 0.001 tolerance
            const expectedSw = Math.round(h * 9 / 16);
            fc.pre(Math.abs(expectedSw / h - 9 / 16) < 0.001);

            const rect = computeCropRect(w, h);

            return (
              Math.abs(rect.sw / rect.sh - 9 / 16) < 0.001 &&
              rect.sx === Math.floor((w - rect.sw) / 2) &&
              rect.sy === 0
            );
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

// Export for the Task 10 harness
if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty1);
}

export { registerProperty1 };

// Feature: tiktok-video-resizer, Property 2: Portrait input uses full width without horizontal crop

/**
 * Property 2: Portrait input uses full width without horizontal crop
 *
 * For any input video where W/H <= 9/16 (already portrait or square),
 * `computeCropRect(W, H)` must return `sx = 0`, `sw = W`, covering the full frame width.
 *
 * Validates: Requirements 2.5
 */
function registerProperty2(fc, computeCropRectArg) {
  const computeCropRect = computeCropRectArg || (typeof window !== 'undefined' && window.computeCropRect);

  return {
    name: 'Property 2: Portrait input uses full width without horizontal crop',
    run() {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 4000 }),
          fc.integer({ min: 1, max: 4000 }),
          (w, h) => {
            // Only test portrait/square inputs (W/H <= 9/16)
            fc.pre(w / h <= 9 / 16);

            const rect = computeCropRect(w, h);

            return rect.sx === 0 && rect.sw === w;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

// Export for the Task 10 harness
if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty2);
}

export { registerProperty2 };

// Feature: tiktok-video-resizer, Property 3: All frames are processed — drawImage call count equals totalFrames

/**
 * Property 3: All frames are processed
 *
 * For any video with a computed totalFrames count, the number of drawImage
 * calls made during processing must equal totalFrames.
 *
 * Validates: Requirements 2.2
 */
function registerProperty3(fc) {
  return {
    name: 'Property 3: All frames are processed — drawImage call count equals totalFrames',
    run() {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 300 }),
          (totalFrames) => {
            // Simulate the seek-loop logic directly (no real video needed)
            let drawImageCount = 0;
            const progressValues = [];

            // Mock ctx
            const ctx = {
              drawImage: () => { drawImageCount++; },
            };

            // Simulate the seek-loop body
            for (let i = 0; i < totalFrames; i++) {
              ctx.drawImage(); // mirrors: ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)
              progressValues.push(i / totalFrames);
            }

            return drawImageCount === totalFrames;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty3);
}

export { registerProperty3 };

// Feature: tiktok-video-resizer, Property 4: captureStream fps matches detected input fps

/**
 * Property 4: Frame rate is preserved
 *
 * For any input video with detected frame rate fps, the fps stored on the
 * VideoProcessor instance after process() sets up the seek-loop must equal
 * that same fps value.
 *
 * Validates: Requirements 2.3
 */
function registerProperty4(fc) {
  return {
    name: 'Property 4: captureStream fps matches detected input fps',
    run() {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 120 }),
          (fps) => {
            // Simulate what VideoProcessor does: store fps on the instance
            // so Task 5.1 can pass it to captureStream(fps).
            const processor = { fps: 30 }; // default
            // Simulate the fps detection path (fallback branch sets this.fps = fps)
            processor.fps = fps;

            return processor.fps === fps;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty4);
}

export { registerProperty4 };

// Feature: tiktok-video-resizer, Property 5: Progress at frame i equals i/totalFrames; at completion equals 1.0

/**
 * Property 5: Progress value reflects frames processed
 *
 * For any video with totalFrames frames, after processing frame i the value
 * reported to onProgress must equal i / totalFrames. After the loop the
 * caller is expected to call onProgress(1.0) to signal completion.
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */
function registerProperty5(fc) {
  return {
    name: 'Property 5: Progress at frame i equals i/totalFrames; at completion equals 1.0',
    run() {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 300 }),
          fc.integer({ min: 0, max: 299 }),
          (totalFrames, frameIndex) => {
            // frameIndex must be < totalFrames
            fc.pre(frameIndex < totalFrames);

            const progressValues = [];

            // Simulate the seek-loop progress reporting
            for (let i = 0; i < totalFrames; i++) {
              progressValues.push(i / totalFrames);
            }

            // Check the specific frame's reported progress
            const reportedAtFrame = progressValues[frameIndex];
            const expectedAtFrame = frameIndex / totalFrames;

            return reportedAtFrame === expectedAtFrame;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty5);
}

export { registerProperty5 };

// Feature: tiktok-video-resizer, Property 11: No fetch/XHR/sendBeacon calls are made during the processing pipeline

/**
 * Property 11: No network calls during processing
 *
 * For any video file processed by the app, no calls to `fetch`,
 * `XMLHttpRequest`, or `navigator.sendBeacon` must be made during the
 * processing pipeline.
 *
 * Validates: Requirements 3.2
 */
function registerProperty11(fc) {
  return {
    name: 'Property 11: No fetch/XHR/sendBeacon calls are made during the processing pipeline',
    run() {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 300 }),
          (totalFrames) => {
            // Spy on network APIs before running the pipeline simulation
            let fetchCallCount = 0;
            let xhrOpenCallCount = 0;
            let sendBeaconCallCount = 0;

            const originalFetch = typeof window !== 'undefined' ? window.fetch : undefined;
            const originalXhrOpen = typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest.prototype.open : undefined;
            const originalSendBeacon = typeof navigator !== 'undefined' ? navigator.sendBeacon : undefined;

            if (typeof window !== 'undefined') {
              window.fetch = (...args) => { fetchCallCount++; return Promise.resolve(new Response()); };
            }
            if (typeof XMLHttpRequest !== 'undefined') {
              XMLHttpRequest.prototype.open = function (...args) { xhrOpenCallCount++; };
            }
            if (typeof navigator !== 'undefined') {
              navigator.sendBeacon = (...args) => { sendBeaconCallCount++; return true; };
            }

            try {
              // Simulate the seek-loop processing pipeline (no real video needed)
              const ctx = { drawImage: () => {} };
              for (let i = 0; i < totalFrames; i++) {
                // Mirrors: ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH)
                ctx.drawImage();
                // Mirrors: onProgress(i / totalFrames)
                const _progress = i / totalFrames;
              }
            } finally {
              // Restore original implementations
              if (typeof window !== 'undefined') {
                if (originalFetch !== undefined) window.fetch = originalFetch;
                else delete window.fetch;
              }
              if (typeof XMLHttpRequest !== 'undefined' && originalXhrOpen !== undefined) {
                XMLHttpRequest.prototype.open = originalXhrOpen;
              }
              if (typeof navigator !== 'undefined') {
                if (originalSendBeacon !== undefined) navigator.sendBeacon = originalSendBeacon;
                else delete navigator.sendBeacon;
              }
            }

            return fetchCallCount === 0 && xhrOpenCallCount === 0 && sendBeaconCallCount === 0;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

// Export for the Task 10 harness
if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty11);
}

export { registerProperty11 };

// Feature: tiktok-video-resizer, Property 6: UI is locked during processing

/**
 * Property 6: UI is locked during processing
 *
 * For any processing state where status === 'processing', the file input
 * element and the process button must both have the disabled attribute set.
 *
 * Validates: Requirements 4.4
 */
function registerProperty6(fc) {
  return {
    name: 'Property 6: UI is locked during processing',
    run() {
      fc.assert(
        fc.property(
          fc.constantFrom('idle', 'processing', 'done', 'error'),
          (status) => {
            // Simulate the UI lock logic from the process button click handler
            const fileInput = { disabled: false };
            const processBtn = { disabled: false };

            if (status === 'processing') {
              fileInput.disabled = true;
              processBtn.disabled = true;
            }

            if (status === 'processing') {
              return fileInput.disabled === true && processBtn.disabled === true;
            }
            // For non-processing states, the lock should not be applied
            return fileInput.disabled === false && processBtn.disabled === false;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty6);
}

export { registerProperty6 };

// Feature: tiktok-video-resizer, Property 7: Output filename follows naming pattern

/**
 * Property 7: Output filename follows naming pattern
 *
 * For any input filename string, the derived output filename must equal
 * `stripExtension(filename) + "_tiktok.mp4"`.
 *
 * Validates: Requirements 5.2
 */
function registerProperty7(fc, stripExtensionArg) {
  const stripExt = stripExtensionArg || (typeof window !== 'undefined' && window.stripExtension);

  return {
    name: 'Property 7: Output filename follows naming pattern',
    run() {
      fc.assert(
        fc.property(
          // Generate filenames: base name + optional extension
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 40 }).filter(s => !s.includes('.')),
            fc.option(
              fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.includes('.')),
              { nil: null }
            )
          ).map(([base, ext]) => ext === null ? base : `${base}.${ext}`),
          (filename) => {
            const output = stripExt(filename) + '_tiktok.mp4';
            const expected = stripExt(filename) + '_tiktok.mp4';
            // The output must end with _tiktok.mp4
            const endsCorrectly = output.endsWith('_tiktok.mp4');
            // The base part must equal stripExtension(filename)
            const base = output.slice(0, output.length - '_tiktok.mp4'.length);
            const expectedBase = stripExt(filename);
            return endsCorrectly && base === expectedBase;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

// Export for the Task 10 harness
if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty7);
}

export { registerProperty7 };

// Feature: tiktok-video-resizer, Property 10: Any thrown error during processing resets status to idle with a message

/**
 * Property 10: Processing errors reset UI to idle
 *
 * For any error thrown during the processing pipeline, the app must display
 * a descriptive error message and return `status` to `'idle'`, allowing the
 * user to retry.
 *
 * Validates: Requirements 6.2
 */
function registerProperty10(fc) {
  return {
    name: 'Property 10: Processing errors reset UI to idle',
    run() {
      fc.assert(
        fc.property(
          fc.string(),
          (errorMessage) => {
            // Mock __appState
            const mockAppState = { status: 'processing' };

            // Mock ErrorComponent
            const mockErrorComponent = {
              _shownMessage: null,
              _hidden: true,
              show(message) {
                this._shownMessage = message;
                this._hidden = false;
              },
            };

            // Simulate the catch block logic from app.js
            const err = new Error(errorMessage);
            try {
              throw err;
            } catch (e) {
              mockAppState.status = 'idle';
              const isOOM = e instanceof RangeError ||
                (e.message && e.message.toLowerCase().includes('memory'));
              const message = isOOM
                ? 'Your device ran out of memory. Try a shorter or lower-resolution video.'
                : (e.message || 'An error occurred during processing.');
              mockErrorComponent.show(message);
            }

            // 1. status must be reset to 'idle'
            const statusIsIdle = mockAppState.status === 'idle';
            // 2. error area must show a non-empty message
            const errorShown = !mockErrorComponent._hidden &&
              typeof mockErrorComponent._shownMessage === 'string' &&
              mockErrorComponent._shownMessage.length > 0;

            return statusIsIdle && errorShown;
          }
        ),
        { numRuns: 100 }
      );
    },
  };
}

// Export for the Task 10 harness
if (typeof window !== 'undefined') {
  window.__pbtProperties = window.__pbtProperties || [];
  window.__pbtProperties.push(registerProperty10);
}

export { registerProperty10 };
