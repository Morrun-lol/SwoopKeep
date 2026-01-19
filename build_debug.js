const { spawn } = require('child_process');
const fs = require('fs');

const logStream = fs.createWriteStream('build_debug.log');

console.log('Starting build --dir...');
const child = spawn('npx.cmd', ['electron-builder', '--win', '--x64', '--dir'], { shell: true });

child.stdout.pipe(logStream);
child.stderr.pipe(logStream);

child.on('close', (code) => {
    console.log(`Child exited with code ${code}`);
    fs.appendFileSync('build_debug.log', `\nEXIT CODE: ${code}`);
});
