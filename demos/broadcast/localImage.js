const fs = require('fs');
const path = require('path');
const HTTPSockBroadcast = require('../../broadcast');

const imagePath = path.resolve(__dirname, '..', '..', 'setup.png');

if (!fs.existsSync(imagePath)) {
    console.error('setup.png not found at', imagePath);
    process.exit(1);
};

const imageBuffer = fs.readFileSync(imagePath);
console.log('image size:', imageBuffer.length, 'path:', imagePath);

const broadcaster = new HTTPSockBroadcast({
    server: 'http://localhost:1234/httpsock/1',
    cert: './certs/chain.pem',
    auth: { username: 'broadcaster1', password: 'broadcasterPassword1' },
    callback: (response => console.log('→', response)),
    close: (() => console.log('↓ stream closed')),
    error: (error => console.error(error))
});

async function sendImage() {
    console.log('← sending image');
    broadcaster.send(imageBuffer);
    await new Promise(res => setTimeout(res, 200));
    broadcaster.stop();
    setTimeout(() => process.exit(0), 200);
};

sendImage().catch(err => {
    console.error(err);
    process.exit(1);
});

