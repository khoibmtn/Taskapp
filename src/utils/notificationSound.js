/**
 * Play a short notification beep using Web Audio API.
 * No external audio file needed.
 */
let audioContext = null;

export function playNotificationSound() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume context if suspended (mobile browsers require user gesture first)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const now = audioContext.currentTime;

        // Create a pleasant two-tone notification beep
        // Tone 1: 880Hz (A5)
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 880;
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Tone 2: 1100Hz (C#6) — slightly delayed
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1100;
        gain2.gain.setValueAtTime(0.12, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.3);
    } catch (e) {
        // Silently fail — audio is non-critical
    }
}
