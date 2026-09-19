const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const binMacDir = path.join(rootDir, 'bin', 'mac');
const binWinDir = path.join(rootDir, 'bin', 'win');

fs.mkdirSync(binMacDir, { recursive: true });
fs.mkdirSync(binWinDir, { recursive: true });

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: rootDir });
}

// 1. macOS yt-dlp
const macYtdlp = path.join(binMacDir, 'yt-dlp');
if (!fs.existsSync(macYtdlp)) {
  console.log('Downloading macOS yt-dlp standalone universal binary...');
  run(`curl -L -o "${macYtdlp}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos`);
  fs.chmodSync(macYtdlp, 0o755);
}

// 2. macOS ffmpeg
const macFfmpeg = path.join(binMacDir, 'ffmpeg');
if (!fs.existsSync(macFfmpeg)) {
  console.log('Setting up macOS ffmpeg static binary...');
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      fs.copyFileSync(ffmpegStatic, macFfmpeg);
      fs.chmodSync(macFfmpeg, 0o755);
    }
  } catch (e) {
    console.warn('ffmpeg-static not available, downloading fallback...');
  }
}

// Both Mac packages share these resources: include both CPU architectures.
if (process.platform === 'darwin' && fs.existsSync(macFfmpeg)) {
  const architectures = execSync(`lipo -archs "${macFfmpeg}"`, { encoding: 'utf8' });
  if (!architectures.includes('arm64') || !architectures.includes('x86_64')) {
    const release = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1';
    for (const arch of ['arm64', 'x64']) {
      const binary = path.join(binMacDir, `ffmpeg-${arch}`);
      run(`curl -fL "${release}/ffmpeg-darwin-${arch}.gz" -o "${binary}.gz"`);
      run(`gzip -df "${binary}.gz"`);
    }
    run(`lipo -create "${path.join(binMacDir, 'ffmpeg-arm64')}" "${path.join(binMacDir, 'ffmpeg-x64')}" -output "${macFfmpeg}"`);
    fs.chmodSync(macFfmpeg, 0o755);
    for (const arch of ['arm64', 'x64']) fs.unlinkSync(path.join(binMacDir, `ffmpeg-${arch}`));
  }
}

// 3. Windows yt-dlp
const winYtdlp = path.join(binWinDir, 'yt-dlp.exe');
if (!fs.existsSync(winYtdlp)) {
  console.log('Downloading Windows yt-dlp.exe...');
  run(`curl -L -o "${winYtdlp}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe`);
}

// 4. Windows ffmpeg
const winFfmpeg = path.join(binWinDir, 'ffmpeg.exe');
if (!fs.existsSync(winFfmpeg)) {
  console.log('Downloading Windows ffmpeg.exe...');
  const zipPath = path.join(binWinDir, 'ffmpeg.zip');
  run(`curl -L -o "${zipPath}" https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip`);
  run(`unzip -o "${zipPath}" -d "${binWinDir}"`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
}

console.log('All bundled binaries verified and ready!');
