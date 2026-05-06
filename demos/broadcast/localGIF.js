const fs = require('fs');
const path = require('path');
const hwsBroadcast = require('../../broadcast');
const { GifReader } = require('omggif');
const { PNG } = require('pngjs');

const gifPath = path.resolve(__dirname, '..', '..', 'demo.gif');

if (!fs.existsSync(gifPath)) {
  console.error('demo.gif not found at', gifPath);
  process.exit(1);
};

const gifBuffer = fs.readFileSync(gifPath);

var reader;
try {
  reader = new GifReader(gifBuffer);
} catch (e) {
  console.error('Failed to parse GIF:', e);
  process.exit(1);
};

const frameCount = reader.numFrames();
console.log('gif frames:', frameCount, 'size:', gifBuffer.length);

const broadcaster = new hwsBroadcast({
  server: 'http://localhost:1234/hws/1',
  cert: './certs/chain.pem',
  auth: { username: 'broadcaster1', password: 'broadcasterPassword1' },
  callback: (response => console.log('→', response)),
  close: (() => console.log('↓ stream closed')),
  error: (error => console.error(error))
});

async function sendFrames() {
  const frameWidth = reader.width;
  const frameHeight = reader.height;
  for (var i = 0; i < frameCount; i++) {
    const rgba = new Uint8Array(frameWidth * frameHeight * 4);
    reader.decodeAndBlitFrameRGBA(i, rgba);
    const png = new PNG({ width: frameWidth, height: frameHeight });
    png.data = Buffer.from(rgba);
    const pngBuffer = PNG.sync.write(png);
    console.log(`← sending frame ${i + 1}/${frameCount} (${pngBuffer.length} bytes)`);
    broadcaster.send(pngBuffer);
    const info = reader.frameInfo(i) || {};
    const delay = (info.delay && (info.delay > 0)) ? info.delay * 10 : 100;
    await new Promise(res => setTimeout(res, delay));
  };
  broadcaster.stop();
  setTimeout(() => process.exit(0), 200);
};

sendFrames().catch(err => {
  console.error(err);
  process.exit(1);
});
