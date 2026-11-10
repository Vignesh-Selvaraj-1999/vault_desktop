// Starts Electron for this project. Removes ELECTRON_RUN_AS_NODE, which VS Code's
// integrated terminal sets and which would make Electron run as plain Node (no window).
const { spawn } = require('child_process');
const path = require('path');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [path.join(__dirname, '..')], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
