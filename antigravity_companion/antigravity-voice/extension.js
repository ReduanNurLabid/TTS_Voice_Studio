const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let statusBarItem;
let replayStatusBarItem;
let workerProcess = null;
let outputChannel;

const VOICE_LABELS = {
    'en-US-AndrewNeural': 'Andrew (Male - US) - Natural & Conversational',
    'en-US-AvaNeural': 'Ava (Female - US) - Expressive & Melodic',
    'en-US-EmmaNeural': 'Emma (Female - US) - Warm & Gentle',
    'en-US-JennyNeural': 'Jenny (Female - US) - Clear & Crisp',
    'en-US-AriaNeural': 'Aria (Female - US) - Engaging & Expressive',
    'en-US-BrianNeural': 'Brian (Male - US) - Deep & Authoritative',
    'en-US-GuyNeural': 'Guy (Male - US) - Casual & Friendly',
    'en-GB-RyanNeural': 'Ryan (British Male - UK) - Refined British',
    'en-GB-SoniaNeural': 'Sonia (British Female - UK) - Natural British',
    'en-US-AvaMultilingualNeural': 'Ava Multilingual (Female - US)',
    'en-US-AndrewMultilingualNeural': 'Andrew Multilingual (Male - US)',
    'en-US-EmmaMultilingualNeural': 'Emma Multilingual (Female - US)'
};

const SPEED_LABELS = {
    '-15%': '0.85x (Slower) - Easy to follow for complex explanations',
    '-5%': '0.95x (Relaxed) - Slightly slower than normal',
    '+0%': '1.0x (Normal) - Natural conversational pace',
    '+10%': '1.1x (Brisk) - Quick & productive',
    '+20%': '1.2x (Fast) - Rapid playback',
    '+35%': '1.35x (Very Fast) - High-speed reading'
};

function getConfigPath(context) {
    return path.join(context.extensionPath, 'voice_config.json');
}

function getCommandPath(context) {
    return path.join(context.extensionPath, 'command.json');
}

function sendCommand(context, action, extra = {}) {
    try {
        const cmdData = {
            action: action,
            timestamp: Date.now(),
            ...extra
        };
        fs.writeFileSync(getCommandPath(context), JSON.stringify(cmdData, null, 2), 'utf-8');
    } catch (e) {
        outputChannel.appendLine(`Failed to send command ${action}: ${e.message}`);
    }
}

function syncConfigFile(context) {
    const config = vscode.workspace.getConfiguration('antigravityVoice');
    const configData = {
        enabled: config.get('enabled', true),
        voice: config.get('voice', 'en-US-AndrewMultilingualNeural'),
        speed: config.get('speed', '+0%'),
        volume: config.get('volume', 100),
        progressiveChunking: config.get('progressiveChunking', true)
    };
    try {
        fs.writeFileSync(getConfigPath(context), JSON.stringify(configData, null, 2), 'utf-8');
    } catch (e) {
        outputChannel.appendLine(`Failed to sync config: ${e.message}`);
    }
}

function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('antigravityVoice');
    const enabled = config.get('enabled', true);
    const voice = config.get('voice', 'en-US-AndrewMultilingualNeural');
    const speed = config.get('speed', '+0%');

    const shortVoice = voice.split('-')[2] ? voice.split('-')[2].replace('Neural', '').replace('Multilingual', '') : 'Andrew';
    const speedLabel = speed === '+0%' ? '1.0x' : speed;

    if (enabled) {
        statusBarItem.text = `$(megaphone) Voice: ${shortVoice} (${speedLabel})`;
        statusBarItem.tooltip = `Antigravity Voice Companion: Active\nVoice: ${shortVoice}\nSpeed: ${speedLabel}\nClick to customize or mute.`;
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    } else {
        statusBarItem.text = `$(mute) Voice: Muted`;
        statusBarItem.tooltip = `Antigravity Voice Companion: Muted\nClick to unmute.`;
        statusBarItem.color = new vscode.ThemeColor('descriptionForeground');
    }
    statusBarItem.show();

    if (replayStatusBarItem) {
        replayStatusBarItem.show();
    }
}

function startWorker(context) {
    if (workerProcess) {
        return;
    }

    syncConfigFile(context);
    const scriptPath = path.join(context.extensionPath, 'voice_worker.py');

    outputChannel.appendLine(`Starting voice worker: python -u "${scriptPath}"`);

    workerProcess = spawn('python', ['-u', scriptPath], {
        cwd: context.extensionPath,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    workerProcess.stdout.on('data', (data) => {
        outputChannel.append(data.toString());
    });

    workerProcess.stderr.on('data', (data) => {
        outputChannel.appendLine(`[Error] ${data.toString()}`);
    });

    workerProcess.on('exit', (code, signal) => {
        outputChannel.appendLine(`Voice worker exited with code ${code} signal ${signal}`);
        workerProcess = null;
    });
}

function stopWorker() {
    if (workerProcess) {
        outputChannel.appendLine('Stopping voice worker...');
        try {
            workerProcess.kill('SIGTERM');
        } catch (e) {}
        workerProcess = null;
    }
}

async function showMenu(context) {
    const config = vscode.workspace.getConfiguration('antigravityVoice');
    const enabled = config.get('enabled', true);
    const currentVoice = config.get('voice', 'en-US-AndrewMultilingualNeural');
    const currentSpeed = config.get('speed', '+0%');

    const currentVolume = config.get('volume', 100);

    const toggleLabel = enabled ? '$(mute) Mute Voice Companion' : '$(megaphone) Enable Voice Companion';
    const toggleDetail = enabled ? 'Temporarily silence spoken responses' : 'Start reading responses aloud';

    const items = [
        {
            label: toggleLabel,
            detail: toggleDetail,
            action: 'toggle'
        },
        {
            label: '$(play) Read Last Response Aloud',
            detail: 'Replays the latest assistant response from this chat (Ctrl+Alt+R)',
            action: 'replay'
        },
        {
            label: '$(primitive-square) Stop Current Speech',
            detail: 'Immediately cuts off any currently playing audio',
            action: 'stop'
        },
        {
            label: '$(mic) Select Voice...',
            detail: `Current: ${VOICE_LABELS[currentVoice] || currentVoice}`,
            action: 'voice'
        },
        {
            label: '$(dashboard) Adjust Speech Speed...',
            detail: `Current: ${SPEED_LABELS[currentSpeed] || currentSpeed}`,
            action: 'speed'
        },
        {
            label: '$(unmute) Adjust Volume...',
            detail: `Current: ${currentVolume}%`,
            action: 'volume'
        },
        {
            label: '$(settings-gear) Open Extension Settings',
            detail: 'Configure advanced voice options in IDE Settings',
            action: 'settings'
        }
    ];

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Antigravity Voice Companion Settings'
    });

    if (!pick) return;

    if (pick.action === 'toggle') {
        await config.update('enabled', !enabled, vscode.ConfigurationTarget.Global);
        updateStatusBar();
        syncConfigFile(context);
        vscode.window.showInformationMessage(`Antigravity Voice is now ${!enabled ? 'Enabled' : 'Muted'}.`);
    } else if (pick.action === 'replay') {
        sendCommand(context, 'replay');
        vscode.window.setStatusBarMessage('$(play) Reading last response aloud...', 3000);
    } else if (pick.action === 'stop') {
        sendCommand(context, 'stop');
        vscode.window.setStatusBarMessage('$(mute) Speech stopped.', 2000);
    } else if (pick.action === 'voice') {
        await selectVoice(context);
    } else if (pick.action === 'speed') {
        await selectSpeed(context);
    } else if (pick.action === 'volume') {
        await selectVolume(context);
    } else if (pick.action === 'settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'antigravityVoice');
    }
}

async function selectVolume(context) {
    const config = vscode.workspace.getConfiguration('antigravityVoice');
    const currentVolume = config.get('volume', 100);

    const volumeOptions = [
        { label: '100% (Maximum)', val: 100, desc: 'Full audio volume' },
        { label: '80% (High)', val: 80, desc: 'Loud and clear' },
        { label: '60% (Medium)', val: 60, desc: 'Balanced for background listening' },
        { label: '40% (Quiet)', val: 40, desc: 'Soft speech playback' },
        { label: '20% (Very Soft)', val: 20, desc: 'Whisper level' }
    ];

    const items = volumeOptions.map(opt => ({
        label: opt.val === currentVolume ? `$(check) ${opt.label}` : opt.label,
        detail: opt.desc,
        volumeVal: opt.val
    }));

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select playback volume percentage'
    });

    if (pick) {
        await config.update('volume', pick.volumeVal, vscode.ConfigurationTarget.Global);
        syncConfigFile(context);
        updateStatusBar();
        vscode.window.showInformationMessage(`Playback volume set to: ${pick.volumeVal}%`);
    }
}

async function selectVoice(context) {
    const config = vscode.workspace.getConfiguration('antigravityVoice');
    const currentVoice = config.get('voice', 'en-US-AndrewMultilingualNeural');

    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = 'Choose a voice (Click ▶ for instant companion intro)';

    quickPick.items = Object.entries(VOICE_LABELS).map(([key, label]) => ({
        label: key === currentVoice ? `$(check) ${label}` : label,
        description: key === currentVoice ? 'Active' : '',
        voiceKey: key,
        buttons: [
            {
                iconPath: new vscode.ThemeIcon('play'),
                tooltip: 'Listen to instant companion preview'
            }
        ]
    }));

    quickPick.onDidTriggerItemButton((e) => {
        const voiceKey = e.item.voiceKey;
        const shortName = voiceKey.split('-')[2] ? voiceKey.split('-')[2].replace('Neural', '').replace('Multilingual', '') : 'Voice';
        sendCommand(context, 'preview', { voice: voiceKey });
        vscode.window.setStatusBarMessage(`$(play) Playing companion intro: "Hi, I am ${shortName}!"`, 3000);
    });

    quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
            await config.update('voice', selected.voiceKey, vscode.ConfigurationTarget.Global);
            syncConfigFile(context);
            updateStatusBar();
            sendCommand(context, 'preview', { voice: selected.voiceKey });
            vscode.window.showInformationMessage(`Voice set to: ${VOICE_LABELS[selected.voiceKey]}`);
        }
        quickPick.dispose();
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
}

async function selectSpeed(context) {
    const config = vscode.workspace.getConfiguration('antigravityVoice');
    const currentSpeed = config.get('speed', '+0%');

    const speedItems = Object.entries(SPEED_LABELS).map(([key, label]) => ({
        label: key === currentSpeed ? `$(check) ${label}` : label,
        speedKey: key
    }));

    const pick = await vscode.window.showQuickPick(speedItems, {
        placeHolder: 'Select speaking speed rate'
    });

    if (pick) {
        await config.update('speed', pick.speedKey, vscode.ConfigurationTarget.Global);
        syncConfigFile(context);
        updateStatusBar();
        vscode.window.showInformationMessage(`Speech speed set to: ${SPEED_LABELS[pick.speedKey]}`);
    }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Antigravity Voice');
    outputChannel.appendLine('Antigravity Voice Extension Activating...');

    // Main Status Bar Item (Voice Status & Menu)
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'antigravityVoice.openMenu';
    context.subscriptions.push(statusBarItem);

    // Secondary Status Bar Button: Read Last Response
    replayStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    replayStatusBarItem.text = '$(play) Read Last';
    replayStatusBarItem.tooltip = 'Read aloud the last response (Ctrl+Alt+R)';
    replayStatusBarItem.command = 'antigravityVoice.replayLast';
    context.subscriptions.push(replayStatusBarItem);

    updateStatusBar();

    // Start background Python worker
    startWorker(context);

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravityVoice.openMenu', () => showMenu(context)),
        vscode.commands.registerCommand('antigravityVoice.toggle', async () => {
            const config = vscode.workspace.getConfiguration('antigravityVoice');
            const cur = config.get('enabled', true);
            await config.update('enabled', !cur, vscode.ConfigurationTarget.Global);
            updateStatusBar();
            syncConfigFile(context);
        }),
        vscode.commands.registerCommand('antigravityVoice.replayLast', () => {
            sendCommand(context, 'replay');
            vscode.window.setStatusBarMessage('$(play) Reading last response aloud...', 3000);
        }),
        vscode.commands.registerCommand('antigravityVoice.stop', () => {
            sendCommand(context, 'stop');
            vscode.window.setStatusBarMessage('$(mute) Speech stopped.', 2000);
        }),
        vscode.commands.registerCommand('antigravityVoice.changeVoice', () => selectVoice(context)),
        vscode.commands.registerCommand('antigravityVoice.changeSpeed', () => selectSpeed(context)),
        vscode.commands.registerCommand('antigravityVoice.changeVolume', () => selectVolume(context))
    );

    // Watch for setting changes in Settings UI
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('antigravityVoice')) {
                updateStatusBar();
                syncConfigFile(context);
            }
        })
    );

    outputChannel.appendLine('Antigravity Voice Extension Activated successfully.');
}

function deactivate() {
    stopWorker();
}

module.exports = {
    activate,
    deactivate
};
