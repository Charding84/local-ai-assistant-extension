import archiver from 'archiver';
import { createWriteStream, promises as fs } from 'fs';
import { join } from 'path';

const DIST_DIR = 'dist';
const BUILD_DIR = 'build';
const OUTPUT_ZIP = 'local-ai-assistant-extension.zip';

async function buildExtension() {
  console.log('Building Chrome extension...');

  // Create build directory
  await fs.mkdir(BUILD_DIR, { recursive: true });

  // Copy manifest
  await fs.copyFile('manifest.json', join(BUILD_DIR, 'manifest.json'));

  // Copy dist files
  await copyDir(DIST_DIR, BUILD_DIR);

  // Copy assets
  await fs.mkdir(join(BUILD_DIR, 'assets'), { recursive: true });
  // Add icons if they exist
  try {
    await copyDir('assets', join(BUILD_DIR, 'assets'));
  } catch (e) {
    console.warn('No assets directory found, skipping...');
  }

  // Create zip
  await createZip();

  console.log(`✓ Extension built successfully at ${BUILD_DIR}/`);
  console.log(`✓ Distribution zip created at ${OUTPUT_ZIP}`);
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

function createZip() {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(OUTPUT_ZIP);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(BUILD_DIR, false);
    archive.finalize();
  });
}

buildExtension().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
