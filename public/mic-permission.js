// Permission-only page. Acquires microphone permission for the extension origin,
// then auto-closes. Speech recognition runs in the sidepanel.

const btn = document.getElementById('grant');
const status = document.getElementById('status');

(async function init() {
  try {
    const permStatus = await navigator.permissions.query({ name: 'microphone' });
    if (permStatus.state === 'granted') {
      chrome.storage.local.set({ pointdev_mic_granted: true });
      chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
      status.textContent = 'Microphone permission granted. You can close this tab.';
      status.className = 'status success';
      btn.style.display = 'none';
      // Auto-close after a brief delay so user sees confirmation
      setTimeout(() => window.close(), 1500);
      return;
    }
  } catch { /* permissions.query not available — show button */ }

  chrome.runtime.sendMessage({ type: 'MIC_TAB_READY' });
})();

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Requesting access...';
  status.className = 'status';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());

    btn.style.display = 'none';
    status.textContent = 'Microphone permission granted. Closing this tab...';
    status.className = 'status success';

    chrome.storage.local.set({ pointdev_mic_granted: true });
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
    // Auto-close
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    status.textContent = 'Permission denied. Please try again and click "Allow" when prompted.';
    status.className = 'status error';
    btn.disabled = false;
  }
});

// Respond to ping from sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'MIC_TAB_PING') {
    sendResponse({ alive: true });
  }
  return false;
});
