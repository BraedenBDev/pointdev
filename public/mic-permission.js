// Visible extension page that can trigger Chrome's microphone permission prompt.
// Offscreen documents and sidepanels cannot present permission dialogs.

const btn = document.getElementById('grant');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Requesting access...';
  status.className = 'status';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());

    status.textContent = 'Microphone access granted. You can close this tab.';
    status.className = 'status success';

    // Notify the extension that permission was granted
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });

    // Auto-close after a short delay
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    status.textContent = 'Permission denied. Please try again and click "Allow" when prompted.';
    status.className = 'status error';
    btn.disabled = false;
  }
});
