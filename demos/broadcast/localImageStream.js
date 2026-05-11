const HTTPSockBroadcast = require('../../broadcast');

const streamPath = 'http://faisaln:8888/';

const broadcaster = new HTTPSockBroadcast({
    server: 'http://localhost:1234/httpsock',
    cert: './certs/chain.pem',
    auth: { username: 'broadcaster1', password: 'broadcasterPassword1' },
    callback: (response => console.log('→', response)),
    close: (() => console.log('↓ stream closed')),
    error: (error => {
        console.error(error);
        console.log('↓ stream closed');
        broadcaster.stop();
        process.exit(0);
    })
});

function indexOf(source, pattern) {
    if (pattern.length === 0) return 0;
    for (var i = 0; i <= (source.length - pattern.length); i++) {
        var match = true;
        for (var j = 0; j < pattern.length; j++) {
            if (source[i + j] !== pattern[j]) { match = false; break; }
        };
        if (match) return i;
    };
    return -1;
};

async function startImageStream() {
    const response = await fetch(streamPath);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    const match = /boundary="?([^;"\r\n]+)"?/.exec(contentType);
    if (!match) throw new Error('No multipart boundary found');
    const boundary = `--${match[1]}`;
    const boundaryBytes = new TextEncoder().encode(boundary);
    const reader = response.body.getReader();
    var buffer = new Uint8Array(0);
    var latestFrame = null;
    const sendInterval = setInterval(() => {
        if (latestFrame) {
            try {
                console.log(`← sending image (${latestFrame.length} bytes)`);
                broadcaster.send(latestFrame);
            } catch (e) {
                console.error('Send error:', e);
            };
            latestFrame = null;
        };
    }, 1000);
    try {
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
                var jpegStart = -1;
                for (var i = 0; i < part.length - 1; i++) {
                    if ((part[i] === 0xFF) && (part[i + 1] === 0xD8)) {
                        jpegStart = i;
                        break;
                    };
                };
                if (jpegStart !== -1) {
                    const jpegBytes = part.subarray(jpegStart);
                    latestFrame = Buffer.from(jpegBytes);
                };
                var afterBoundary = boundaryPosition + boundaryBytes.length;
                if ((buffer[afterBoundary] === 0x0D) && (buffer[afterBoundary + 1] === 0x0A)) afterBoundary += 2;
                buffer = buffer.subarray(afterBoundary);
                boundaryPosition = indexOf(buffer, boundaryBytes);
            };
        };
    } catch (err) {
        console.error('Stream read error:', err);
    } finally {
        clearInterval(sendInterval);
        if (latestFrame) {
            try {
                console.log(`← sending image (${latestFrame.length} bytes)`);
                broadcaster.send(latestFrame);
            } catch (e) {
                console.error('Send error:', e);
            };
            latestFrame = null;
        };
        console.log('↓ stream closed');
        broadcaster.stop();
        process.exit(0);
    };
};

startImageStream().catch(err => {
    console.error(err);
    process.exit(1);
});