// Voice Companion Studio Client Engine (Layered Progressive Streaming & Centered Breathing)

const PRESETS = {
    book: `I have always considered myself an observant soul. In a restless world, I find solace in quiet moments—watching the subtle details that slip past most eyes: the frail moth navigating the twilight air, or the quiet geometry of dust resting in the groove of an automatic train door.

During my evening commutes, with ambient music flowing through my headphones, I gaze through the glass as Jakarta transforms under the night sky. The towering skyscrapers glow like constellations of glass and steel, framed by the warm, amber hum of streetlights below.

It is breathtaking.

In those fleeting moments between stations, I am struck by how many quiet miracles surround us. Years ago, fresh out of university, I nurtured a humble dream: to work amidst the pulse of this city and witness its evening silhouette from high above. Standing on the eighteenth floor today, watching the distant headlights trace golden rivers through the avenues, I feel an immense, quiet gratitude.

Life ceases to be mundane the moment we learn to appreciate its smallest whispers.`,

    code: `Modern neural speech synthesis represents a profound convergence of acoustic modeling and real-time streaming architectures. Rather than waiting for full-document synthesis, our progressive delivery pipeline divides textual content into semantic respiratory layers.

Layer one initiates playback within two hundred milliseconds, generating the opening sentence with crisp articulation. Concurrently, layer two buffers subsequent phrases in the background, preserving continuous prosody, natural intonation, and melodic cadence across sentence boundaries.

By synchronizing millisecond-level word boundaries with dynamic phoneme mapping, the system delivers an effortless, distraction-free reading experience that feels genuinely alive.`,

    bangla: `বৃষ্টিভেজা এক শান্ত বিকেলে জানালার কাঁচ ঘেঁষে বসে এক কাপ ধোঁয়া ওঠা চা নিয়ে ভাবছিলাম... জীবনটা সত্যিই কত অপূর্ব আর বিষ্ময়কর! 

প্রতিদিনের এই ইট-পাথরের ব্যস্ত শহরে ছুটে চলতে চলতে আমরা কত শত ছোট ছোট আনন্দ আর মায়াবী অনুভূতি ভুলে যাই। অথচ একটুখানি থমকে দাঁড়িয়ে যদি ভেজা বাতাসের সুবাস নেওয়া যায়, পাতার ডগায় জমে থাকা বৃষ্টির ফোঁটার দিকে তাকানো যায়—তবে মনটা এক নিমেষেই এক অপার্থিব প্রশান্তিতে ভরে ওঠে।

ক্লান্তি ভুলে নিজেকে ভালোবাসুন; জীবনের প্রতিটি মুহূর্তকে গভীর মায়ায় জড়িয়ে রাখুন।`,

    reflection: `Take a slow, conscious breath and let the silence settle around you.

In the relentless tempo of our daily lives, we are conditioned to rush—moving from one ambition to the next without pausing to inhabit the present moment. Yet, true clarity is never found in haste; it reveals itself in stillness.

Notice how the quality of a conversation transforms when speech is permitted to breathe. When we honor the pauses between our words, each sentence gains weight, resonance, and genuine intention.

We do not read merely to reach the final period on the page. We read to savor the rhythm of the journey, one deliberate word at a time.`
};

let voicesList = [];
let currentAudioUrl = null;
let currentWords = [];
let wordSpans = [];
let animFrameId = null;

// Progressive Live Reading Engine State
let isLiveReadingActive = false;
let liveReadingToken = 0; // cancellation token
let prefetchCache = new Map(); // chunk_idx -> Promise<{ audio, words, duration }>

// Base API URL: Automatically detects localhost/Render or routes to Render when on GitHub Pages
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname || window.location.hostname.includes('onrender.com'))
    ? ''
    : (window.SPEECH_API_BASE || 'https://tts-voice-studio-4yxi.onrender.com');

// Audio Context for Beat Visualizer
let audioCtx = null;
let analyser = null;
let audioSourceNode = null;
let previewAudioInstance = null;

// DOM Elements
const textInput = document.getElementById('text-input');
const teleprompterView = document.getElementById('teleprompter-view');
const teleprompterContent = document.getElementById('teleprompter-content');
const tabEdit = document.getElementById('tab-edit');
const tabTeleprompter = document.getElementById('tab-teleprompter');
const readingStatusChip = document.getElementById('reading-status-chip');
const readingStatusText = document.getElementById('reading-status-text');

const wordCountEl = document.getElementById('word-count');
const readTimeEl = document.getElementById('read-time');
const modeSelect = document.getElementById('mode-select');
const tabModeLive = document.getElementById('tab-mode-live');
const tabModeAudio = document.getElementById('tab-mode-audio');
const voiceSelect = document.getElementById('voice-select');
const voiceTagDisplay = document.getElementById('voice-tag-display');
const btnPreviewVoice = document.getElementById('btn-preview-voice');
const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');
const pitchSlider = document.getElementById('pitch-slider');
const pitchVal = document.getElementById('pitch-val');
const pauseToggle = document.getElementById('pause-toggle');
const btnSpeak = document.getElementById('btn-speak');
const speakBtnText = document.getElementById('speak-btn-text');

const playerContainer = document.getElementById('player-container');
const audioElement = document.getElementById('audio-element');
const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const seekBar = document.getElementById('seek-bar');
const currentTimeEl = document.getElementById('current-time');
const totalDurationEl = document.getElementById('total-duration');
const btnDownload = document.getElementById('btn-download');
const btnClipboard = document.getElementById('btn-clipboard');
const btnClear = document.getElementById('btn-clear');
const btnResetDefaults = document.getElementById('btn-reset-defaults');
const toast = document.getElementById('toast');

// Canvas
const canvas = document.getElementById('visualizer-canvas');
const canvasCtx = canvas.getContext('2d');

// Preset Buttons
const btnPresetBook = document.getElementById('btn-preset-book');
const btnPresetCode = document.getElementById('btn-preset-code');
const btnPresetBangla = document.getElementById('btn-preset-bangla');
const btnPresetReflection = document.getElementById('btn-preset-reflection');

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Load Book Preset by default
    textInput.value = PRESETS.book;
    updateTextStats();
    buildTeleprompterTokens(textInput.value);

    // Fetch voices
    await loadVoices();

    // Default voice: Emma
    if (voiceSelect.querySelector('option[value="en-US-EmmaNeural"]')) {
        voiceSelect.value = "en-US-EmmaNeural";
    } else if (voiceSelect.options.length > 0) {
        voiceSelect.selectedIndex = 0;
    }
    updateVoiceTag();
    updateSpeedUI(1.0);
    updatePitchUI(0);
    setReadingMode('live');

    // Start ambient canvas loop
    startVisualizerLoop();
});

// Toast Helper
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2800);
}

// Reading Mode Switcher (Read As You Go vs Generate Audio File)
function setReadingMode(mode) {
    modeSelect.value = mode;
    if (mode === 'live') {
        tabModeLive.classList.add('active');
        tabModeAudio.classList.remove('active');
        // Live reading mode hides the audio player controls, showing only the breathing visualizer
        playerContainer.classList.add('hidden');
    } else {
        tabModeAudio.classList.add('active');
        tabModeLive.classList.remove('active');
        if (currentAudioUrl) {
            playerContainer.classList.remove('hidden');
        } else {
            playerContainer.classList.add('hidden');
        }
    }
    updateModeButtonText();
}

tabModeLive.addEventListener('click', () => {
    stopLiveReading();
    setReadingMode('live');
});

tabModeAudio.addEventListener('click', () => {
    stopLiveReading();
    setReadingMode('audio');
});

// Reset Defaults
btnResetDefaults.addEventListener('click', () => {
    stopLiveReading();
    textInput.value = PRESETS.book;
    updateTextStats();
    buildTeleprompterTokens(textInput.value);

    setReadingMode('live');

    if (voiceSelect.querySelector('option[value="en-US-EmmaNeural"]')) {
        voiceSelect.value = "en-US-EmmaNeural";
    }
    updateVoiceTag();
    updateSpeedUI(1.0);
    updatePitchUI(0);
    pauseToggle.checked = true;

    setActiveTab("edit");
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btnPresetBook.classList.add('active');

    showToast("Settings reset to defaults!");
});

// Word Count & Read Time
function updateTextStats() {
    const text = textInput.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const minutes = Math.ceil(words / 140);
    wordCountEl.textContent = `${words} words`;
    readTimeEl.textContent = `~${minutes} min read`;

    // Auto-detect Bengali
    if (/[\u0980-\u09FF]/.test(text)) {
        if (!voiceSelect.value.startsWith('bn-')) {
            const bnVoice = voicesList.find(v => v.id === 'bn-BD-NabanitaNeural' || v.id.startsWith('bn-'));
            if (bnVoice) {
                voiceSelect.value = bnVoice.id;
                updateVoiceTag();
            }
        }
    }
}

textInput.addEventListener('input', () => {
    updateTextStats();
    buildTeleprompterTokens(textInput.value);
});

// Mode Switcher UI
function updateModeButtonText() {
    if (isLiveReadingActive) {
        speakBtnText.textContent = 'Stop Reading';
    } else if (modeSelect.value === 'live') {
        speakBtnText.textContent = 'Read As You Go';
    } else {
        speakBtnText.textContent = 'Generate Audio File';
    }
}

modeSelect.addEventListener('change', () => setReadingMode(modeSelect.value));

// Tabs Switcher (Edit vs Teleprompter)
function setActiveTab(tab) {
    if (tab === 'edit') {
        tabEdit.classList.add('active');
        tabTeleprompter.classList.remove('active');
        textInput.classList.remove('hidden');
        teleprompterView.classList.add('hidden');
    } else {
        tabTeleprompter.classList.add('active');
        tabEdit.classList.remove('active');
        textInput.classList.add('hidden');
        teleprompterView.classList.remove('hidden');
    }
}

tabEdit.addEventListener('click', () => setActiveTab('edit'));
tabTeleprompter.addEventListener('click', () => setActiveTab('teleprompter'));

// Build Teleprompter Word Spans
function buildTeleprompterTokens(text) {
    teleprompterContent.innerHTML = '';
    wordSpans = [];

    const lines = text.split('\n');
    let wordIdx = 0;

    lines.forEach((line) => {
        if (!line.trim()) {
            const br = document.createElement('br');
            teleprompterContent.appendChild(br);
            return;
        }

        const p = document.createElement('p');
        p.style.margin = '0.5rem 0';
        const words = line.trim().split(/\s+/);

        words.forEach((w) => {
            const span = document.createElement('span');
            span.className = 'word-span';
            span.textContent = w;
            span.dataset.idx = wordIdx;
            span.dataset.word = w.toLowerCase().replace(/[^a-z\u0980-\u09FF]/g, '');
            p.appendChild(span);
            wordSpans.push(span);
            wordIdx++;
        });

        teleprompterContent.appendChild(p);
    });
}

// Preset Switching
function setPreset(key, btn) {
    stopLiveReading();
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    textInput.value = PRESETS[key];
    updateTextStats();
    buildTeleprompterTokens(textInput.value);

    // Auto-select voice for Bengali
    if (key === 'bangla') {
        voiceSelect.value = 'bn-BD-NabanitaNeural';
        updateVoiceTag();
    } else if (voiceSelect.value.startsWith('bn-')) {
        voiceSelect.value = 'en-US-EmmaNeural';
        updateVoiceTag();
    }
}

btnPresetBook.addEventListener('click', () => setPreset('book', btnPresetBook));
btnPresetCode.addEventListener('click', () => setPreset('code', btnPresetCode));
btnPresetBangla.addEventListener('click', () => setPreset('bangla', btnPresetBangla));
btnPresetReflection.addEventListener('click', () => setPreset('reflection', btnPresetReflection));

// Fetch Voices from Server
async function loadVoices() {
    try {
        const res = await fetch(`${API_BASE}/api/voices`);
        voicesList = await res.json();
        voiceSelect.innerHTML = '';
        voicesList.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.name} (${v.region}) - ${v.tag}`;
            voiceSelect.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to load voices:', e);
    }
}

function updateVoiceTag() {
    const selectedId = voiceSelect.value;
    const voice = voicesList.find(v => v.id === selectedId);
    if (voice) {
        voiceTagDisplay.textContent = `${voice.gender} • ${voice.region} • ${voice.language || 'English'} • ${voice.tag}`;
    }
}

voiceSelect.addEventListener('change', updateVoiceTag);

// Sliders with Dynamic Track Fill & Sync
function updateSpeedUI(val) {
    let speedNum = parseFloat(val);
    if (Math.abs(speedNum - 1.0) < 0.015) {
        speedNum = 1.0;
    }
    speedSlider.value = speedNum;

    let label = `${speedNum.toFixed(2)}x`;
    if (speedNum === 1.0) label = "1.00x (Normal)";
    else if (speedNum < 1.0) label += " (Relaxed)";
    else label += " (Brisk)";
    speedVal.textContent = label;

    const pct = ((speedNum - 0.5) / (1.5 - 0.5)) * 100;
    speedSlider.style.background = `linear-gradient(to right, #6366f1 0%, #a855f7 ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`;
}

function updatePitchUI(val) {
    const pitchNum = parseInt(val);
    pitchSlider.value = pitchNum;

    let label = `${pitchNum >= 0 ? '+' : ''}${pitchNum} Hz`;
    if (pitchNum === 0) label = "0 Hz (Natural)";
    else if (pitchNum <= -20) label += " (Deep)";
    else if (pitchNum < 0) label += " (Slightly Lower)";
    else if (pitchNum >= 20) label += " (High)";
    else label += " (Slightly Higher)";
    pitchVal.textContent = label;

    const pct = ((pitchNum - (-50)) / (50 - (-50))) * 100;
    if (pitchNum >= 0) {
        pitchSlider.style.background = `linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.12) 50%, #c084fc 50%, #c084fc ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`;
    } else {
        pitchSlider.style.background = `linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.12) ${pct}%, #818cf8 ${pct}%, #818cf8 50%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.12) 100%)`;
    }
}

speedSlider.addEventListener('input', (e) => updateSpeedUI(e.target.value));
pitchSlider.addEventListener('input', (e) => updatePitchUI(e.target.value));

// Clickable Marks
document.getElementById('mark-speed-low')?.addEventListener('click', () => updateSpeedUI(0.5));
document.getElementById('mark-speed-norm')?.addEventListener('click', () => updateSpeedUI(1.0));
document.getElementById('mark-speed-high')?.addEventListener('click', () => updateSpeedUI(1.5));

document.getElementById('mark-pitch-low')?.addEventListener('click', () => updatePitchUI(-50));
document.getElementById('mark-pitch-norm')?.addEventListener('click', () => updatePitchUI(0));
document.getElementById('mark-pitch-high')?.addEventListener('click', () => updatePitchUI(50));

// Clipboard
btnClipboard.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            stopLiveReading();
            textInput.value = text;
            updateTextStats();
            buildTeleprompterTokens(text);
        }
    } catch (err) {
        alert('Clipboard access denied or unsupported in browser.');
    }
});

btnClear.addEventListener('click', () => {
    stopLiveReading();
    textInput.value = '';
    updateTextStats();
    buildTeleprompterTokens('');
});

// Audition Preview (Live with selected speed and pitch!)
btnPreviewVoice.addEventListener('click', async () => {
    const voiceId = voiceSelect.value;
    const speed = parseFloat(speedSlider.value);
    const pitch = parseInt(pitchSlider.value);

    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateStr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
    const pitchStr = `${pitch >= 0 ? '+' : ''}${pitch}Hz`;

    const voiceObj = voicesList.find(v => v.id === voiceId);
    const name = voiceObj ? voiceObj.name : 'Companion';
    const isBn = voiceId.startsWith('bn-');
    const previewText = isBn
        ? `হ্যালো! আমি ${name}। এই গতি এবং পিচে আমার কণ্ঠ শোনা যাচ্ছে।`
        : `Hello! I am ${name}. This is how I sound at this speed and pitch.`;

    btnPreviewVoice.innerHTML = `
        <svg class="icon-sm" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
        </svg>
        Auditioning...
    `;
    btnPreviewVoice.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: previewText,
                voice: voiceId,
                rate: rateStr,
                pitch: pitchStr,
                natural_pauses: true,
                format: 'audio'
            })
        });
        if (!res.ok) throw new Error('Preview synthesis failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (previewAudioInstance) {
            previewAudioInstance.pause();
        }
        previewAudioInstance = new Audio(url);
        initWebAudioSource(previewAudioInstance);
        await previewAudioInstance.play();
        previewAudioInstance.onended = () => {
            btnPreviewVoice.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Preview
            `;
            btnPreviewVoice.disabled = false;
        };
    } catch (e) {
        console.error('Preview error:', e);
        btnPreviewVoice.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Preview
        `;
        btnPreviewVoice.disabled = false;
    }
});

// Web Audio API Frequency Analyser for Polished Canvas Beat Animation
function initWebAudioSource(mediaEl) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.8;
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (mediaEl && !mediaEl._hasSource) {
            audioSourceNode = audioCtx.createMediaElementSource(mediaEl);
            audioSourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            mediaEl._hasSource = true;
        }
    } catch (err) {
        console.log("AudioContext note:", err);
    }
}

// Centered Audio Beat & Breathing Visualizer Loop
function startVisualizerLoop() {
    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);
    let phase = 0;

    function render() {
        requestAnimationFrame(render);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        const isPlaying = audioElement && !audioElement.paused;
        const isPreviewing = previewAudioInstance && !previewAudioInstance.paused;

        // Visualizer bar parameters
        const barWidth = 4;
        const barGap = 3;
        const totalBarStep = barWidth + barGap;
        // Number of mirrored bars on each side of center:
        const halfBars = Math.floor((cx - 8) / totalBarStep); // ~26 pairs

        phase += 0.04;

        if (analyser && (isPlaying || isPreviewing)) {
            analyser.getByteFrequencyData(dataArray);

            // Compute overall speech volume/energy for ambient center glow
            let sumEnergy = 0;
            const sampleCount = Math.min(16, dataArray.length);
            for (let i = 0; i < sampleCount; i++) sumEnergy += (dataArray[i] || 0);
            const avgEnergy = sumEnergy / (sampleCount * 255); // 0 to 1

            // Dynamic breathing expansion stretch (breathing pulse)
            const breathScale = 1.0 + 0.16 * Math.sin(phase * 1.4);

            // Radiant center breathing glow
            const centerGlow = canvasCtx.createRadialGradient(cx, cy, 2, cx, cy, 65 + avgEnergy * 85);
            centerGlow.addColorStop(0, `rgba(129, 140, 248, ${0.3 + avgEnergy * 0.45})`);
            centerGlow.addColorStop(0.5, `rgba(168, 85, 247, ${0.15 + avgEnergy * 0.25})`);
            centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            canvasCtx.fillStyle = centerGlow;
            canvasCtx.fillRect(0, 0, width, height);

            const step = Math.max(1, Math.floor(dataArray.length / halfBars));

            // Symmetrical expansion from center outward
            for (let i = 0; i < halfBars; i++) {
                const rawVal = dataArray[i * step] || 15;
                const percent = rawVal / 255;

                // Center has highest response, stretching outward with Gaussian bell curve
                const normDist = i / (halfBars * 0.72);
                const bellDecay = Math.exp(-Math.pow(normDist, 2));

                // Stretch vertically centered
                const barHeight = Math.max(5, percent * (height - 8) * bellDecay * breathScale);
                const y = cy - (barHeight / 2);

                // Outward X coordinates from dead center
                const xRight = cx + (i * totalBarStep) + (barGap / 2);
                const xLeft = cx - ((i + 1) * totalBarStep) + (barGap / 2);

                // Color palette radiating from center (cyan/indigo -> violet -> rose pink)
                const colorRatio = i / halfBars;
                let barColor;
                if (colorRatio < 0.3) {
                    barColor = '#818cf8'; // Bright indigo at center
                } else if (colorRatio < 0.65) {
                    barColor = '#c084fc'; // Warm purple mid-way
                } else {
                    barColor = '#f472b6'; // Rose pink at edges
                }

                canvasCtx.fillStyle = barColor;

                // Right bar
                canvasCtx.beginPath();
                canvasCtx.roundRect(xRight, y, barWidth, barHeight, 2.5);
                canvasCtx.fill();

                // Left bar (mirrored symmetry)
                canvasCtx.beginPath();
                canvasCtx.roundRect(xLeft, y, barWidth, barHeight, 2.5);
                canvasCtx.fill();
            }

            // Center respiratory pulse pip
            const pipHeight = Math.max(8, (dataArray[0] / 255) * (height - 6));
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.beginPath();
            canvasCtx.roundRect(cx - 1.5, cy - (pipHeight / 2), 3, pipHeight, 1.5);
            canvasCtx.fill();

        } else {
            // Organic Resting Breathing Rhythm (Lungs inhaling & exhaling)
            // Symmetrical gentle respiratory wave pulsing from center
            const breathWave = Math.sin(phase); // -1 to 1
            const breathExpansion = (breathWave + 1) / 2; // 0 to 1

            // Center calm breathing glow
            const idleGlow = canvasCtx.createRadialGradient(cx, cy, 0, cx, cy, 40 + breathExpansion * 40);
            idleGlow.addColorStop(0, `rgba(99, 102, 241, ${0.12 + breathExpansion * 0.2})`);
            idleGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            canvasCtx.fillStyle = idleGlow;
            canvasCtx.fillRect(0, 0, width, height);

            for (let i = 0; i < halfBars; i++) {
                const normDist = i / halfBars;
                // Wave propagation delay from center outward like an organic respiratory ripple
                const ripple = Math.sin(phase - normDist * 2.4);
                const localExpansion = Math.max(0, (ripple + 1) / 2);

                const bellDecay = Math.exp(-Math.pow(normDist / 0.62, 2));
                const barHeight = Math.max(3.5, 4 + (localExpansion * bellDecay * (height * 0.54)));
                const y = cy - (barHeight / 2);

                const xRight = cx + (i * totalBarStep) + (barGap / 2);
                const xLeft = cx - ((i + 1) * totalBarStep) + (barGap / 2);

                // Calming translucent indigo-violet tone
                const alpha = 0.16 + 0.38 * bellDecay * localExpansion;
                canvasCtx.fillStyle = `rgba(129, 140, 248, ${alpha})`;

                // Right bar
                canvasCtx.beginPath();
                canvasCtx.roundRect(xRight, y, barWidth, barHeight, 2);
                canvasCtx.fill();

                // Left bar
                canvasCtx.beginPath();
                canvasCtx.roundRect(xLeft, y, barWidth, barHeight, 2);
                canvasCtx.fill();
            }
        }
    }

    render();
}

// Split text into paragraph-bounded chunks (One paragraph at most per chunk, max 1-2 sentences)
function splitIntoParagraphChunks(text) {
    const paragraphs = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    const chunks = [];
    let globalWordCounter = 0;

    paragraphs.forEach((para) => {
        // Split this paragraph into clean sentences:
        // Respects . ! ? and Bengali dāri \u0964
        const sentences = para.split(/(?<=[.!?\u0964])\s+/).map(s => s.trim()).filter(Boolean);
        if (sentences.length === 0) return;

        // Break sentences of this paragraph into small 1-to-2 sentence chunks.
        // Rule 1: NEVER combine text from different paragraphs (one paragraph at most).
        // Rule 2: In any paragraph:
        //   - 1st chunk: exactly 1 sentence (immediate speech start ~200ms)
        //   - Subsequent chunks: 1 to 2 sentences max (never large blocks)
        let sIdx = 0;
        let pChunkIdx = 0;

        while (sIdx < sentences.length) {
            const isFirstInPara = (sIdx === 0);
            let groupCount = 1;
            if (!isFirstInPara) {
                // Take 1 or 2 sentences max
                const remaining = sentences.length - sIdx;
                groupCount = (remaining === 3) ? 1 : Math.min(2, remaining);
            }

            const currentGroup = [];
            for (let k = 0; k < groupCount && sIdx < sentences.length; k++) {
                currentGroup.push(sentences[sIdx]);
                sIdx++;
            }

            const isLastInPara = (sIdx >= sentences.length);
            const chunkText = currentGroup.join(' ');
            const wordsInChunk = chunkText.split(/\s+/).filter(w => w.length > 0);

            chunks.push({
                text: chunkText,
                words: wordsInChunk,
                startWordIdx: globalWordCounter,
                wordCount: wordsInChunk.length,
                isParagraphEnd: isLastInPara
            });

            globalWordCounter += wordsInChunk.length;
            pChunkIdx++;
        }
    });

    return chunks;
}

// Pre-fetch a chunk from /api/stream_unit
async function fetchUnitAudio(chunkText, voice, rateStr, pitchStr) {
    const res = await fetch(`${API_BASE}/api/stream_unit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: chunkText,
            voice: voice,
            rate: rateStr,
            pitch: pitchStr,
            natural_pauses: false,
            format: 'json'
        })
    });
    if (!res.ok) throw new Error('Unit synthesis failed');
    return await res.json();
}

// Stop Live Reading cleanly
function stopLiveReading() {
    isLiveReadingActive = false;
    liveReadingToken++;
    if (audioElement) {
        audioElement.pause();
    }
    prefetchCache.clear();
    readingStatusChip.classList.add('hidden');
    wordSpans.forEach(s => s.classList.remove('active'));
    updateModeButtonText();
    updatePlayPauseUI(false);
}

// Speak Button Router (Read As You Go vs Generate Audio)
btnSpeak.addEventListener('click', async () => {
    // If currently reading in Live mode, Stop reading
    if (isLiveReadingActive) {
        stopLiveReading();
        return;
    }

    const text = textInput.value.trim();
    if (!text) {
        alert('Please enter some text to read aloud.');
        return;
    }

    const mode = modeSelect.value;
    if (mode === 'live') {
        startLiveProgressiveReading();
    } else {
        generateFullAudio();
    }
});

// 🚀 Mode 1: Real-Time Human "Read As You Go" Layered Streaming Engine
async function startLiveProgressiveReading() {
    const text = textInput.value.trim();
    const voice = voiceSelect.value;
    const speed = parseFloat(speedSlider.value);
    const pitch = parseInt(pitchSlider.value);
    const naturalBreathingOn = pauseToggle.checked;

    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateStr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
    const pitchStr = `${pitch >= 0 ? '+' : ''}${pitch}Hz`;

    const chunks = splitIntoParagraphChunks(text);
    if (chunks.length === 0) return;

    isLiveReadingActive = true;
    const currentToken = ++liveReadingToken;
    prefetchCache.clear();

    // Switch to Teleprompter view immediately
    setActiveTab('teleprompter');
    buildTeleprompterTokens(text);

    // Read As You Go hides the bottom audio player timeline, displaying only the breathing visualizer
    playerContainer.classList.add('hidden');

    btnSpeak.classList.remove('loading');
    speakBtnText.textContent = 'Stop Reading';
    readingStatusChip.classList.remove('hidden');
    readingStatusText.textContent = 'Reading As You Go...';

    // Helper to queue prefetch into memory cache
    function ensurePrefetch(idx) {
        if (idx < chunks.length && !prefetchCache.has(idx)) {
            prefetchCache.set(idx, fetchUnitAudio(chunks[idx].text, voice, rateStr, pitchStr));
        }
    }

    // Immediately pre-fetch the first 3 chunks to prime the pipeline
    ensurePrefetch(0);
    ensurePrefetch(1);
    ensurePrefetch(2);

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        if (!isLiveReadingActive || liveReadingToken !== currentToken) break;

        const chunk = chunks[cIdx];

        // Trigger background prefetch for upcoming chunks ahead of time
        ensurePrefetch(cIdx + 1);
        ensurePrefetch(cIdx + 2);

        readingStatusText.textContent = `Reading chunk ${cIdx + 1} of ${chunks.length}`;

        try {
            // Await this chunk's audio (already downloaded or downloading in prefetch)
            const chunkPromise = prefetchCache.get(cIdx) || fetchUnitAudio(chunk.text, voice, rateStr, pitchStr);
            const data = await chunkPromise;

            if (!isLiveReadingActive || liveReadingToken !== currentToken) break;

            // Load and play this chunk
            audioElement.src = data.audio;
            initWebAudioSource(audioElement);
            await audioElement.play();
            updatePlayPauseUI(true);

            // Run word-by-word synchronization until chunk actually finishes
            await runUnitWordHighlighting(data.words || [], chunk.startWordIdx, chunk.wordCount, currentToken);

            if (!isLiveReadingActive || liveReadingToken !== currentToken) break;

            // When the next chunk is ready, it should NOT sit idle!
            // Only at paragraph ends, if natural breathing is enabled, take a brief breath pause (280ms)
            if (cIdx < chunks.length - 1) {
                if (chunk.isParagraphEnd && naturalBreathingOn) {
                    readingStatusText.textContent = "Paragraph breath... 🍃";
                    await new Promise(res => setTimeout(res, 280));
                }
                // Within the same paragraph: zero pause! Next chunk begins instantly!
            }

        } catch (err) {
            console.error(`Error reading chunk ${cIdx}:`, err);
        }
    }

    if (liveReadingToken === currentToken) {
        stopLiveReading();
        readingStatusChip.classList.remove('hidden');
        readingStatusText.textContent = 'Finished Reading 🎉';
        setTimeout(() => readingStatusChip.classList.add('hidden'), 3500);
    }
}

// Word-by-word karaoke highlighting for a chunk
function runUnitWordHighlighting(unitWords, startGlobalIdx, chunkWordCount, token) {
    return new Promise((resolve) => {
        let isDone = false;

        function finishChunk() {
            if (isDone) return;
            isDone = true;
            audioElement.removeEventListener('ended', finishChunk);
            audioElement.removeEventListener('timeupdate', onTimeUpdate);

            // Mark all words of this chunk as completed/past
            const endIdx = startGlobalIdx + chunkWordCount;
            for (let idx = startGlobalIdx; idx < endIdx && idx < wordSpans.length; idx++) {
                wordSpans[idx].classList.remove('active');
                wordSpans[idx].classList.add('past');
            }
            resolve();
        }

        let lastActiveOffset = -1;

        function onTimeUpdate() {
            if (!isLiveReadingActive || liveReadingToken !== token) {
                finishChunk();
                return;
            }

            const curTime = audioElement.currentTime;
            let currentOffset = -1;

            for (let i = 0; i < unitWords.length; i++) {
                const w = unitWords[i];
                if (curTime >= w.start && curTime <= w.end) {
                    currentOffset = i;
                    break;
                }
            }

            if (currentOffset !== -1 && currentOffset !== lastActiveOffset) {
                lastActiveOffset = currentOffset;
                const globalIdx = startGlobalIdx + currentOffset;

                wordSpans.forEach((span, idx) => {
                    if (idx === globalIdx) {
                        span.classList.add('active');
                        span.classList.remove('past');
                        span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                    } else if (idx < globalIdx) {
                        span.classList.remove('active');
                        span.classList.add('past');
                    } else {
                        span.classList.remove('active');
                    }
                });
            }

            // Near-end check: if within 40ms of duration, finish immediately
            if (audioElement.duration > 0 && curTime >= audioElement.duration - 0.04) {
                finishChunk();
            }
        }

        audioElement.addEventListener('ended', finishChunk);
        audioElement.addEventListener('timeupdate', onTimeUpdate);

        // Periodic watchdog in case ended event is missed by browser
        const checkTimer = setInterval(() => {
            if (!isLiveReadingActive || liveReadingToken !== token || isDone) {
                clearInterval(checkTimer);
                finishChunk();
            } else if (audioElement.ended || (audioElement.duration > 0 && audioElement.currentTime >= audioElement.duration - 0.04)) {
                clearInterval(checkTimer);
                finishChunk();
            }
        }, 80);
    });
}

// 🎧 Mode 2: Generate Full Audio Studio Export
async function generateFullAudio() {
    stopLiveReading();
    const text = textInput.value.trim();
    const voice = voiceSelect.value;
    const speed = parseFloat(speedSlider.value);
    const pitch = parseInt(pitchSlider.value);
    const naturalPauses = pauseToggle.checked;

    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateStr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
    const pitchStr = `${pitch >= 0 ? '+' : ''}${pitch}Hz`;

    btnSpeak.classList.add('loading');
    speakBtnText.textContent = 'Generating Full Audio...';

    try {
        const res = await fetch(`${API_BASE}/api/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                voice: voice,
                rate: rateStr,
                pitch: pitchStr,
                natural_pauses: naturalPauses,
                format: 'json'
            })
        });

        if (!res.ok) throw new Error(`Server error: ${res.statusText}`);

        const data = await res.json();
        currentAudioUrl = data.audio;
        currentWords = data.words || [];

        audioElement.src = currentAudioUrl;
        initWebAudioSource(audioElement);

        playerContainer.classList.remove('hidden');
        await audioElement.play();
        updatePlayPauseUI(true);

    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btnSpeak.classList.remove('loading');
        updateModeButtonText();
    }
}

// Audio Player UI
function updatePlayPauseUI(isPlaying) {
    if (isPlaying) {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
    } else {
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
    }
}

btnPlayPause.addEventListener('click', () => {
    if (isLiveReadingActive) {
        if (audioElement.paused) {
            audioElement.play();
            updatePlayPauseUI(true);
        } else {
            audioElement.pause();
            updatePlayPauseUI(false);
        }
    } else {
        if (audioElement.paused) {
            audioElement.play();
            updatePlayPauseUI(true);
        } else {
            audioElement.pause();
            updatePlayPauseUI(false);
        }
    }
});

audioElement.addEventListener('play', () => updatePlayPauseUI(true));
audioElement.addEventListener('pause', () => updatePlayPauseUI(false));

audioElement.addEventListener('timeupdate', () => {
    if (audioElement.duration) {
        const current = audioElement.currentTime;
        const total = audioElement.duration;
        seekBar.value = (current / total) * 100;
        currentTimeEl.textContent = formatTime(current);
        totalDurationEl.textContent = formatTime(total);

        // Sync words during full audio mode if currentWords is populated
        if (!isLiveReadingActive && currentWords && currentWords.length > 0) {
            for (let i = 0; i < currentWords.length; i++) {
                const w = currentWords[i];
                if (current >= w.start && current <= w.end) {
                    wordSpans.forEach((span, idx) => {
                        if (idx === i) {
                            span.classList.add('active');
                            span.classList.remove('past');
                            span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                        } else if (idx < i) {
                            span.classList.remove('active');
                            span.classList.add('past');
                        } else {
                            span.classList.remove('active');
                        }
                    });
                    break;
                }
            }
        }
    }
});

seekBar.addEventListener('input', () => {
    if (audioElement.duration) {
        audioElement.currentTime = (seekBar.value / 100) * audioElement.duration;
    }
});

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Download MP3
btnDownload.addEventListener('click', () => {
    if (!currentAudioUrl) return;
    const a = document.createElement('a');
    a.href = currentAudioUrl;
    const voiceName = voiceSelect.options[voiceSelect.selectedIndex].text.split(' ')[0] || 'Speech';
    a.download = `voice_companion_${voiceName.toLowerCase()}.mp3`;
    a.click();
});
