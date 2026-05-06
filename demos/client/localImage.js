const fs = require('fs');
const path = require('path');
const hwsClient = require('../../client');

const outPath = path.resolve(__dirname, '..', '..', 'demo.png');

const client = new hwsClient({
  server: 'http://localhost:1234/hws/1',
  cert: './certs/chain.pem',
  callback: (response => {
    if (Buffer.isBuffer(response)) {
      try {
        fs.writeFileSync(outPath, response);
        console.log(`← wrote demo.png (${response.length} bytes)`);
      } catch (e) {
        console.error('error writing demo.png', e);
      };
    } else {
      console.log('←', response);
    };
  }),
  close: (() => console.log('↓ stream closed')),
  error: (error => console.error('↓', error))
});

client.stream();

// setTimeout(() => client.stop(), 10000);
