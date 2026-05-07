const fs = require('fs');
const path = require('path');
const HTTPSockClient = require('../../client');

const outPath = path.resolve(__dirname, '..', '..', 'gif-demo.png');

const client = new HTTPSockClient({
  server: 'http://localhost:1234/httpsock/1',
  cert: './certs/chain.pem',
  auth: { username: 'client1', password: 'password1' },
  callback: (response => {
    if (Buffer.isBuffer(response)) {
      try {
        fs.writeFileSync(outPath, response);
        console.log(`→ wrote gif-demo.png (${response.length} bytes)`);
      } catch (e) {
        console.error('error writing gif-demo.png', e);
      };
    } else {
      console.log('→', response);
    };
  }),
  close: (() => console.log('↓ stream closed')),
  error: (error => console.error('↓', error))
});

client.stream();

// setTimeout(() => client.stop(), 10000);
