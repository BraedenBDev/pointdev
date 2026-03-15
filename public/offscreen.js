// Offscreen document for Web Speech API
// Chrome extension sidepanels can't trigger microphone permission prompts.
// Offscreen documents with reason USER_MEDIA can access the microphone.
// We must call getUserMedia first to trigger the permission dialog,
// then start SpeechRecognition after permission is granted.

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let captureStartedAt = 0;
let processedResults = 0;
let micPermissionGranted = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_SPEECH_START') {
    captureStartedAt = message.captureStartedAt;
    processedResults = 0;
    requestMicAndStart();
    sendResponse({ ok: true });
  } else if (message.type === 'OFFSCREEN_SPEECH_STOP') {
    stopRecognition();
    sendResponse({ ok: true });
  }
  return true;
});

async function requestMicAndStart() {
  if (!SpeechRecognitionAPI) {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_SPEECH_ERROR', error: 'Speech recognition not available' });
    return;
  }

  // Request microphone permission via getUserMedia if not already granted
  if (!micPermissionGranted) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted — stop the stream immediately (SpeechRecognition manages its own audio)
      stream.getTracks().forEach(track => track.stop());
      micPermissionGranted = true;
    } catch (err) {
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_SPEECH_ERROR',
        error: 'Microphone access denied. Click the puzzle icon > PointDev > allow microphone.',
      });
      return;
    }
  }

  startRecognition();
}

function startRecognition() {
  recognition = new SpeechRecognitionAPI();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language;

  recognition.onresult = (event) => {
    let interim = '';
    const segments = [];

    for (let i = processedResults; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        const text = result[0].transcript.trim();
        if (text) {
          const now = Date.now();
          segments.push({
            text,
            startMs: now - captureStartedAt - 1000,
            endMs: now - captureStartedAt,
          });
        }
        processedResults = i + 1;
      } else {
        interim += result[0].transcript;
      }
    }

    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_SPEECH_RESULT',
      segments,
      interim,
    });
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      micPermissionGranted = false;
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_SPEECH_ERROR',
        error: 'Microphone access denied. Click the puzzle icon > PointDev > allow microphone.',
      });
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_SPEECH_ERROR', error: 'Speech error: ' + event.error });
    }
  };

  recognition.onend = () => {
    if (recognition) {
      try { recognition.start(); } catch(e) { /* already stopped */ }
    }
  };

  recognition.start();
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_SPEECH_STARTED' });
}

function stopRecognition() {
  if (recognition) {
    const r = recognition;
    recognition = null;
    r.stop();
  }
}
