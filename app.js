/**
 * TikTok Video Resizer — main entry point
 * Zero-dependency, no build step required.
 */

// ---------------------------------------------------------------------------
// BrowserCompatibilityGuard
// Checks for required APIs on page load. If any are missing, replaces the
// app UI with a compatibility warning.
// ---------------------------------------------------------------------------
const BrowserCompatibilityGuard = {
  /**
   * Returns an array of missing feature names, or an empty array if all
   * required APIs are present.
   */
  getMissingFeatures() {
    const missing = [];
    if (typeof HTMLCanvasElement === 'undefined') missing.push('Canvas API');
    if (typeof MediaRecorder === 'undefined') missing.push('MediaRecorder API');
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      missing.push('URL.createObjectURL');
    }
    return missing;
  },

  /**
   * Runs the compatibility check. If any required feature is missing,
   * replaces the #app element with a warning message and returns false.
   * Returns true when the browser is fully supported.
   */
  check() {
    const missing = this.getMissingFeatures();
    if (missing.length === 0) return true;

    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '';
      app.className = '';

      const warning = document.createElement('div');
      warning.className = 'compat-warning';
      warning.innerHTML = `
        <h2>Browser Not Supported</h2>
        <p>
          Your browser is missing the following required features:<br />
          <strong>${missing.join(', ')}</strong>
        </p>
        <p>
          Please use a recent version of Chrome, Edge, or Firefox to use
          this app.
        </p>
      `;
      app.appendChild(warning);
    }

    return false;
  },
};

// ---------------------------------------------------------------------------
// FileInputComponent
// Handles file selection, validation, and UI feedback.
// ---------------------------------------------------------------------------
const FileInputComponent = {
  _file: null,

  init(fileInput, filenameDisplay, errorArea, processBtn) {
    this._fileInput = fileInput;
    this._filenameDisplay = filenameDisplay;
    this._errorArea = errorArea;
    this._processBtn = processBtn;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      this.onFileSelected(file);
    });
  },

  onFileSelected(file) {
    if (!file.type.startsWith('video/')) {
      this.showError('Only video files are accepted. Please select an MP4, MOV, or WebM file.');
      this._filenameDisplay.hidden = true;
      this._processBtn.disabled = true;
      this._file = null;
      return;
    }
    this.clearError();
    this.showFilename(file.name);
    this._file = file;
    this._processBtn.disabled = false;
  },

  showError(message) {
    this._errorArea.textContent = message;
    this._errorArea.hidden = false;
  },

  clearError() {
    this._errorArea.textContent = '';
    this._errorArea.hidden = true;
  },

  showFilename(name) {
    this._filenameDisplay.textContent = name;
    this._filenameDisplay.hidden = false;
  },

  getFile() {
    return this._file;
  },
};

// ---------------------------------------------------------------------------
// computeCropRect
// Pure function: computes the source crop rectangle for a 9:16 output.
// ---------------------------------------------------------------------------
function computeCropRect(videoWidth, videoHeight) {
  const W = videoWidth;
  const H = videoHeight;

  if (W / H > 9 / 16) {
    // Landscape: center-crop horizontally
    const sh = H;
    const sw = Math.round(H * 9 / 16);
    const sx = Math.floor((W - sw) / 2);
    const sy = 0;
    return { sx, sy, sw, sh };
  } else {
    // Portrait or square: use full frame
    return { sx: 0, sy: 0, sw: W, sh: H };
  }
}

// Expose as a global so browser-based property tests can access it
if (typeof window !== 'undefined') {
  window.computeCropRect = computeCropRect;
}

// ---------------------------------------------------------------------------
// stripExtension
// Removes everything after (and including) the last '.' in a filename.
// e.g. "clip.MOV" → "clip", "my video.mp4" → "my video"
// ---------------------------------------------------------------------------
function stripExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.slice(0, lastDot);
}

if (typeof window !== 'undefined') {
  window.stripExtension = stripExtension;
}

// ---------------------------------------------------------------------------
// DownloadComponent
// Creates a temporary object URL from the output Blob and triggers a download.
// ---------------------------------------------------------------------------
const DownloadComponent = {
  _section: null,
  _link: null,

  init(section, link) {
    this._section = section;
    this._link = link;
  },

  /** Derives output filename, sets up the anchor, shows the section, and clicks. */
  show(blob, originalFilename) {
    const outputName = stripExtension(originalFilename) + '_tiktok.mp4';
    this._link.href = URL.createObjectURL(blob);
    this._link.download = outputName;
    this._section.hidden = false;
    this._link.click();
  },

  hide() {
    this._section.hidden = true;
    this._link.href = '';
    this._link.download = '';
  },
};

if (typeof window !== 'undefined') {
  window.DownloadComponent = DownloadComponent;
}

// ---------------------------------------------------------------------------
// VideoProcessor
// Plays the source video at normal speed, draws each frame onto a cropped
// canvas via requestVideoFrameCallback (rVFC), and records the canvas stream
// with MediaRecorder. This ensures the full duration is captured correctly.
// ---------------------------------------------------------------------------
class VideoProcessor {
  constructor() {
    this._cancelled = false;
    this.canvas = null;
    this.fps = 30;
  }

  /**
   * @param {File} file
   * @param {(ratio: number) => void} onProgress
   * @returns {Promise<Blob>}
   */
  process(file, onProgress) {
    this._cancelled = false;

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      // Do NOT mute — we need audio. playsInline for mobile.
      video.playsInline = true;
      video.preload = 'auto';

      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.addEventListener('loadedmetadata', () => {
        try {
          const duration = video.duration;
          const { sx, sy, sw, sh } = computeCropRect(video.videoWidth, video.videoHeight);

          // Output canvas sized to the crop rect
          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          this.canvas = canvas;
          const ctx = canvas.getContext('2d');

          // Draw one frame immediately so the canvas stream has content before
          // MediaRecorder starts (avoids a blank first frame).
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

          // High-quality canvas stream — use detected or fallback fps
          // captureStream(0) lets the browser decide the frame rate naturally.
          const canvasStream = canvas.captureStream(0);

          // Merge audio from the source video
          const combinedTracks = [...canvasStream.getVideoTracks()];
          if (typeof video.captureStream === 'function') {
            video.captureStream().getAudioTracks().forEach(t => combinedTracks.push(t));
          }
          const combinedStream = new MediaStream(combinedTracks);

          // Pick the best supported MIME type and use a high bitrate for quality
          const mimeType = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4',
          ].find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

          // ~8 Mbps video + ~192 kbps audio — high quality
          const recorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 8_000_000,
            audioBitsPerSecond: 192_000,
          });
          const chunks = [];
          recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

          const cleanup = () => URL.revokeObjectURL(objectUrl);

          // Use requestVideoFrameCallback if available (Chrome/Edge), otherwise
          // fall back to timeupdate which fires ~4× per second — good enough for
          // progress but rVFC gives per-frame accuracy.
          const useRVFC = typeof video.requestVideoFrameCallback === 'function';

          const drawFrame = () => {
            if (this._cancelled) {
              recorder.stop();
              video.pause();
              cleanup();
              reject(new Error('Processing cancelled'));
              return;
            }
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            onProgress(Math.min(video.currentTime / duration, 1));
            if (!video.ended && !video.paused) {
              if (useRVFC) video.requestVideoFrameCallback(drawFrame);
            }
          };

          video.addEventListener('ended', async () => {
            // Draw the very last frame
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            onProgress(1);

            await new Promise(res => { recorder.onstop = res; recorder.stop(); });
            cleanup();
            resolve(new Blob(chunks, { type: mimeType }));
          });

          if (!useRVFC) {
            // Fallback: draw on every timeupdate event
            video.addEventListener('timeupdate', drawFrame);
          }

          recorder.start();

          if (useRVFC) video.requestVideoFrameCallback(drawFrame);
          video.play().catch(err => { cleanup(); reject(err); });

        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load video file'));
      });
    });
  }

  cancel() {
    this._cancelled = true;
  }
}

// Expose for testability
if (typeof window !== 'undefined') {
  window.VideoProcessor = VideoProcessor;
}

// ---------------------------------------------------------------------------
// ProgressBarComponent
// Wraps the <progress> element with update/complete/reset helpers.
// ---------------------------------------------------------------------------
const ProgressBarComponent = {
  _bar: null,
  _label: null,
  _section: null,

  init(bar, label, section) {
    this._bar = bar;
    this._label = label;
    this._section = section;
  },

  /** @param {number} ratio - 0.0 to 1.0 */
  update(ratio) {
    const clamped = Math.min(1, Math.max(0, ratio));
    this._bar.value = clamped;
    this._label.textContent = Math.round(clamped * 100) + '%';
  },

  complete() {
    this.update(1.0);
  },

  reset() {
    this.update(0);
    this._section.hidden = true;
  },
};

// Expose for testability
if (typeof window !== 'undefined') {
  window.ProgressBarComponent = ProgressBarComponent;
}

// ---------------------------------------------------------------------------
// ErrorComponent
// Displays error messages in #error-area and provides a clear() method.
// ---------------------------------------------------------------------------
const ErrorComponent = {
  _errorArea: null,

  init(errorArea) {
    this._errorArea = errorArea;
  },

  show(message) {
    this._errorArea.textContent = message;
    this._errorArea.hidden = false;
  },

  clear() {
    this._errorArea.textContent = '';
    this._errorArea.hidden = true;
  },
};

if (typeof window !== 'undefined') {
  window.ErrorComponent = ErrorComponent;
}

// ---------------------------------------------------------------------------
// App state — inspectable by property tests
// ---------------------------------------------------------------------------
const __appState = { status: 'idle' };
if (typeof window !== 'undefined') {
  window.__appState = __appState;
}

// ---------------------------------------------------------------------------
// Bootstrap — run compatibility check before anything else
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (!BrowserCompatibilityGuard.check()) return;

  const fileInput = document.getElementById('file-input');
  const processBtn = document.getElementById('process-btn');

  ErrorComponent.init(document.getElementById('error-area'));

  FileInputComponent.init(
    fileInput,
    document.getElementById('filename-display'),
    document.getElementById('error-area'),
    processBtn,
  );

  ProgressBarComponent.init(
    document.getElementById('progress-bar'),
    document.getElementById('progress-label'),
    document.getElementById('progress-section'),
  );

  DownloadComponent.init(
    document.getElementById('download-section'),
    document.getElementById('download-link'),
  );

  const processor = new VideoProcessor();

  processBtn.addEventListener('click', async () => {
    const file = FileInputComponent.getFile();
    if (!file) return;

    // Lock UI
    __appState.status = 'processing';
    fileInput.disabled = true;
    processBtn.disabled = true;
    ProgressBarComponent.reset();
    document.getElementById('progress-section').hidden = false;
    ProgressBarComponent.update(0);

    try {
      const blob = await processor.process(file, (ratio) => {
        ProgressBarComponent.update(ratio);
      });

      ProgressBarComponent.complete();
      __appState.status = 'done';

      // Show download
      DownloadComponent.show(blob, file.name);
    } catch (err) {
      __appState.status = 'idle';
      const isOOM = err instanceof RangeError ||
        (err.message && err.message.toLowerCase().includes('memory'));
      const message = isOOM
        ? 'Your device ran out of memory. Try a shorter or lower-resolution video.'
        : (err.message || 'An error occurred during processing.');
      ErrorComponent.show(message);
    } finally {
      // Re-enable controls
      fileInput.disabled = false;
      processBtn.disabled = false;
    }
  });
});
