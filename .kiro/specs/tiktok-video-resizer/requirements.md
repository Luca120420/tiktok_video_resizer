# Requirements Document

## Introduction

A static, client-side web application hosted on GitHub Pages that allows users to upload a horizontal video, automatically crops the center rectangle to TikTok's 9:16 vertical aspect ratio, and provides the result as a downloadable MP4 file. All processing happens entirely in the browser with no backend or server involvement.

## Glossary

- **App**: The TikTok Video Resizer static web application
- **User**: A person using the App in a web browser
- **Input_Video**: A horizontal video file uploaded by the User
- **Output_Video**: The processed vertical video file in 9:16 aspect ratio
- **Processor**: The client-side video processing component (using browser APIs such as Canvas and MediaRecorder)
- **Progress_Bar**: The UI component that displays processing progress to the User
- **Center_Crop**: The operation of extracting the centered vertical rectangle from a horizontal frame to produce a 9:16 aspect ratio output

## Requirements

### Requirement 1: Video Upload

**User Story:** As a user, I want to upload a horizontal video from my device, so that I can convert it to TikTok's vertical format.

#### Acceptance Criteria

1. THE App SHALL provide a file input control that accepts video files.
2. WHEN the User selects a file that is not a video format, THE App SHALL display an error message indicating that only video files are accepted.
3. WHEN the User selects a valid video file, THE App SHALL display the filename and allow the User to proceed to processing.
4. THE App SHALL support at minimum the MP4, MOV, and WebM video formats as input.

---

### Requirement 2: Center Crop to 9:16 Aspect Ratio

**User Story:** As a user, I want the app to automatically crop the center of my horizontal video to a 9:16 vertical aspect ratio, so that the output is ready for TikTok without manual editing.

#### Acceptance Criteria

1. WHEN the User initiates processing, THE Processor SHALL compute the largest centered vertical rectangle with a 9:16 aspect ratio that fits within the Input_Video's frame dimensions.
2. THE Processor SHALL apply the Center_Crop to every frame of the Input_Video.
3. THE Processor SHALL preserve the original frame rate of the Input_Video in the Output_Video.
4. THE Processor SHALL preserve the original audio track of the Input_Video in the Output_Video.
5. WHEN the Input_Video has an aspect ratio that is already 9:16 or narrower, THE Processor SHALL use the full width of the Input_Video frame without cropping horizontally.

---

### Requirement 3: Client-Side Processing

**User Story:** As a user, I want all video processing to happen in my browser, so that my video files are never uploaded to any server.

#### Acceptance Criteria

1. THE App SHALL perform all video processing exclusively using browser-native APIs (Canvas API, MediaRecorder API, or WebAssembly-based libraries).
2. THE App SHALL NOT transmit the Input_Video or Output_Video to any external server or endpoint.
3. THE App SHALL function correctly when the User has no internet connection after the initial page load.

---

### Requirement 4: Progress Indication

**User Story:** As a user, I want to see a progress bar during processing, so that I know the app is working and how much time remains.

#### Acceptance Criteria

1. WHEN processing begins, THE App SHALL display the Progress_Bar with an initial value of 0%.
2. WHILE processing is in progress, THE Progress_Bar SHALL update to reflect the proportion of frames processed relative to the total frame count.
3. WHEN processing completes, THE Progress_Bar SHALL display 100% before transitioning to the download state.
4. WHILE processing is in progress, THE App SHALL prevent the User from initiating a new upload or processing operation.

---

### Requirement 5: Download Output

**User Story:** As a user, I want to download the processed video as an MP4 file, so that I can share it on TikTok.

#### Acceptance Criteria

1. WHEN processing completes, THE App SHALL present a download button that triggers saving the Output_Video to the User's device.
2. THE App SHALL name the downloaded file using the pattern `[original_filename]_tiktok.mp4`.
3. THE App SHALL encode the Output_Video in a format compatible with modern browsers and TikTok upload requirements (H.264 video codec where supported by the browser).
4. WHEN the User clicks the download button, THE App SHALL initiate the file download without navigating away from the page.

---

### Requirement 6: Error Handling

**User Story:** As a user, I want to be informed of any errors during processing, so that I can take corrective action.

#### Acceptance Criteria

1. IF the browser does not support the required APIs (Canvas, MediaRecorder), THEN THE App SHALL display a message informing the User that their browser is not supported and suggest a compatible browser.
2. IF an error occurs during video processing, THEN THE App SHALL display a descriptive error message and reset the UI to allow the User to retry.
3. IF the User's device runs out of memory during processing, THEN THE App SHALL display an error message indicating insufficient memory and suggest processing a shorter or lower-resolution video.

---

### Requirement 7: Static Hosting Compatibility

**User Story:** As a developer, I want the app to be deployable on GitHub Pages, so that no backend infrastructure is required.

#### Acceptance Criteria

1. THE App SHALL consist only of static assets (HTML, CSS, JavaScript) with no server-side runtime dependencies.
2. THE App SHALL load and function correctly when served from a GitHub Pages URL (a subdirectory path such as `https://[username].github.io/[repo]/`).
3. THE App SHALL NOT require any build step to deploy; all assets SHALL be directly servable as static files.
