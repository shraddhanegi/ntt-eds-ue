import { spawn } from 'child_process';

/**
 * @returns {Promise<boolean>}
 */
export function isFfmpegAvailable() {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version'], { stdio: 'ignore', shell: true });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Convert animated GIF buffer to MP4 using system ffmpeg.
 * @param {Buffer} gifBuffer GIF file bytes
 * @returns {Promise<Buffer|null>} MP4 buffer or null when conversion fails
 */
export async function convertGifToMp4(gifBuffer) {
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eds-ingest-gif-'));
  const inputPath = path.join(tmpDir, 'input.gif');
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    await fs.writeFile(inputPath, gifBuffer);

    await new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', inputPath,
        '-movflags', 'faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        outputPath,
      ];
      const proc = spawn('ffmpeg', args, { stdio: 'ignore', shell: true });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });

    return await fs.readFile(outputPath);
  } catch {
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Detect animated GIF (multi-frame) using sharp metadata when available.
 * @param {Buffer} buffer GIF bytes
 * @returns {Promise<boolean>}
 */
export async function isAnimatedGif(buffer) {
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    return meta.format === 'gif' && (meta.pages || 0) > 1;
  } catch {
    return false;
  }
}
