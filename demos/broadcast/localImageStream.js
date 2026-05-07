const HTTPSockBroadcast = require('../../broadcast');

const streamPath = 'https://faisaln.com:8888/';

const broadcaster = new HTTPSockBroadcast({
    server: 'http://localhost:1234/httpsock/1',
    cert: './certs/chain.pem',
    auth: { username: 'broadcaster1', password: 'broadcasterPassword1' },
    callback: (response => console.log('→', response)),
    close: (() => console.log('↓ stream closed')),
    error: (error => console.error(error))
});

function indexOf(source, pattern) {
    if (pattern.length === 0) return 0;
    for (let i = 0; i <= (source.length - pattern.length); i++) {
        var match = true;
        for (let j = 0; j < pattern.length; j++) {
            if (source[i + j] !== pattern[j]) {
                match = false;
                break;
            };
        };
        if (match) return i;
    };
    return -1;
};

async function startImageStream() {
    const response = await fetch(streamPath);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    console.log('Content‑Type:', contentType);
    const match = /boundary="?([^;"\r\n]+)"?/.exec(contentType);
    if (!match) throw new Error('No multipart boundary found');
    const boundary = `--${match[1]}`;
    const boundaryBytes = new TextEncoder().encode(boundary);
    const reader = response.body.getReader();
    var buffer = new Uint8Array(0);
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
        var boundaryPosition = indexOf(buffer, boundaryBytes);
        while (boundaryPosition !== -1) {
            const part = buffer.subarray(0, boundaryPosition);
            const jpegStart = part.indexOf(0xFF);
            if (jpegStart !== -1) {
                const jpegBytes = part.subarray(jpegStart);
                console.log('← sending image');
                broadcaster.send(Buffer.from(jpegBytes));
            };
            const afterBoundary = boundaryPosition + boundaryBytes.length;
            const skip = ((buffer[afterBoundary] === 0x0D) && (buffer[afterBoundary + 1] === 0x0A)) ? 2 : 0;
            buffer = buffer.subarray(afterBoundary + skip);
            boundaryPosition = indexOf(buffer, boundaryBytes);
        };
    };
    broadcaster.stop();
    process.exit(0);
};

startImageStream().catch(err => {
    console.error(err);
    process.exit(1);
});