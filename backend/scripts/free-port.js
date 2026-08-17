/**
 * Frees port 5000 before nodemon starts.
 *
 * The server is pinned to port 5000 (see src/index.js) because every frontend
 * call targets http://localhost:5000/api. A dev run that dies without releasing
 * the port blocks every later run, so clear out our own stale listener first.
 * Only processes named `node` are killed - anything else is reported and left
 * alone, so the server's own EADDRINUSE message explains the real conflict.
 */
const { execSync } = require('child_process');

const PORT = 5000;
const isWindows = process.platform === 'win32';

// netstat/lsof exit non-zero when nothing matches, which is the normal case.
const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

const listenerPids = () => {
  if (isWindows) {
    return run('netstat -ano -p TCP')
      .split(/\r?\n/)
      .filter((line) => /LISTENING/i.test(line) && new RegExp(`:${PORT}\\s`).test(line))
      .map((line) => line.trim().split(/\s+/).pop())
      .filter((pid) => /^\d+$/.test(pid) && pid !== '0');
  }
  return run(`lsof -ti tcp:${PORT} -sTCP:LISTEN`).split(/\r?\n/).filter(Boolean);
};

const processName = (pid) => {
  if (isWindows) {
    const match = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).match(/^"([^"]+)"/);
    return match ? match[1] : '';
  }
  return run(`ps -p ${pid} -o comm=`).trim().split('/').pop();
};

for (const pid of [...new Set(listenerPids())]) {
  const name = processName(pid);

  if (!/^node(\.exe)?$/i.test(name)) {
    console.warn(`Port ${PORT} is held by ${name || 'an unknown process'} (pid ${pid}) - leaving it alone.`);
    continue;
  }

  console.log(`Freeing port ${PORT}: stopping stale ${name} (pid ${pid}).`);
  run(isWindows ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`);
}
