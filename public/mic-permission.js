// Visible extension page that handles microphone permission AND runs
// SpeechRecognition. Offscreen documents can't reliably get mic access,
// but this page (as a visible extension tab) can.

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const btn = document.getElementById('grant');
const status = document.getElementById('status');

let recognition = null;
let captureStartedAt = 0;
let processedResults = 0;

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Requesting access...';
  status.className = 'status';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());

    status.textContent = 'Microphone access granted. Keep this tab open during capture.';
    status.className = 'status success';

    // Persist the grant flag and notify the extension
    chrome.storage.local.set({ pointdev_mic_granted: true });
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
  } catch (err) {
    status.textContent = 'Permission denied. Please try again and click "Allow" when prompted.';
    status.className = 'status error';
    btn.disabled = false;
  }
});

// Listen for speech start/stop commands from the sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SPEECH_START') {
    captureStartedAt = message.captureStartedAt;
    processedResults = 0;
    startRecognition();
    sendResponse({ ok: true });
  } else if (message.type === 'SPEECH_STOP') {
    stopRecognition();
    sendResponse({ ok: true });
  } else {
    return false;
  }
});

function startRecognition() {
  if (!SpeechRecognitionAPI) {
    chrome.runtime.sendMessage({ type: 'SPEECH_ERROR', error: 'Speech recognition not available in this browser.' });
    return;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language;

  recognition.onstart = () => {
    status.textContent = 'Listening... Keep this tab open.';
    status.className = 'status listening';
    chrome.runtime.sendMessage({ type: 'SPEECH_STARTED' });
  };

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
      type: 'SPEECH_RESULT',
      segments,
      interim,
    });
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      chrome.runtime.sendMessage({
        type: 'SPEECH_ERROR',
        error: 'Microphone access denied. Reload this tab and click Allow.',
      });
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      chrome.runtime.sendMessage({ type: 'SPEECH_ERROR', error: 'Speech error: ' + event.error });
    }
  };

  recognition.onend = () => {
    // Auto-restart if still supposed to be listening
    if (recognition) {
      try { recognition.start(); } catch (e) { /* already stopped */ }
    }
  };

  recognition.start();
}

function stopRecognition() {
  if (recognition) {
    const r = recognition;
    recognition = null;
    r.stop();
  }
  status.textContent = 'Microphone access granted. Keep this tab open during capture.';
  status.className = 'status success';
}
