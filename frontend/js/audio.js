// Web Audio API Synthesizer with Master Volume & Seekbar for Greedy Game
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.volume = 0.8; // 0.0 to 1.0 (default 80%)

        // Restore saved volume settings from localStorage
        const savedVol = localStorage.getItem('greedy_volume');
        if (savedVol !== null) {
            this.volume = Math.max(0, Math.min(100, parseInt(savedVol, 10))) / 100;
        }
        const savedMute = localStorage.getItem('greedy_muted');
        if (savedMute !== null) {
            this.isMuted = savedMute === 'true';
        }

        this.init();
    }

    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.updateMasterGain();
            this.masterGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn('Web Audio API not supported in this browser.');
        }
    }

    ensureContext() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    updateMasterGain() {
        if (this.masterGain && this.ctx) {
            const effectiveGain = this.isMuted ? 0 : this.volume;
            this.masterGain.gain.setValueAtTime(effectiveGain, this.ctx.currentTime);
        }
    }

    // Set volume between 0 and 100
    setVolume(percent) {
        this.ensureContext();
        this.volume = Math.max(0, Math.min(100, percent)) / 100;
        if (this.volume > 0 && this.isMuted) {
            this.isMuted = false; // un-mute if user raises volume slider
            localStorage.setItem('greedy_muted', 'false');
        }
        this.updateMasterGain();
        localStorage.setItem('greedy_volume', Math.round(this.volume * 100));
        return Math.round(this.volume * 100);
    }

    getVolume() {
        return Math.round(this.volume * 100);
    }

    toggleMute() {
        this.ensureContext();
        this.isMuted = !this.isMuted;
        this.updateMasterGain();
        localStorage.setItem('greedy_muted', this.isMuted.toString());
        return this.isMuted;
    }

    setMuted(muted) {
        this.ensureContext();
        this.isMuted = !!muted;
        this.updateMasterGain();
        localStorage.setItem('greedy_muted', this.isMuted.toString());
        return this.isMuted;
    }

    // Target node for audio output (routes through master gain)
    get outputNode() {
        return this.masterGain || this.ctx.destination;
    }

    // Chip select click sound
    playChipSelect() {
        if (this.isMuted || !this.ctx) return;
        this.ensureContext();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.outputNode);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // Placing bet / coin drop sound
    playCoinDrop() {
        if (this.isMuted || !this.ctx) return;
        this.ensureContext();
        const now = this.ctx.currentTime;
        [987.77, 1318.51].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);
            gain.gain.setValueAtTime(0.25, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.12);

            osc.connect(gain);
            gain.connect(this.outputNode);
            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.12);
        });
    }

    // Wheel ticking sound during spin
    playWheelTick() {
        if (this.isMuted || !this.ctx) return;
        this.ensureContext();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.02);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.02);

        osc.connect(gain);
        gain.connect(this.outputNode);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.02);
    }

    // Countdown tick sound
    playCountdownTick() {
        if (this.isMuted || !this.ctx) return;
        this.ensureContext();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(this.outputNode);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    // Glorious Win Celebration Fanfare!
    playWinFanfare() {
        if (this.isMuted || !this.ctx) return;
        this.ensureContext();
        const now = this.ctx.currentTime;
        const notes = [
            { freq: 523.25, time: 0 },    // C5
            { freq: 659.25, time: 0.12 }, // E5
            { freq: 783.99, time: 0.24 }, // G5
            { freq: 1046.50, time: 0.36 } // C6
        ];

        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.freq, now + n.time);
            gain.gain.setValueAtTime(0.3, now + n.time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + 0.35);

            osc.connect(gain);
            gain.connect(this.outputNode);
            osc.start(now + n.time);
            osc.stop(now + n.time + 0.35);
        });
    }
}

window.soundFx = new SoundEffects();
