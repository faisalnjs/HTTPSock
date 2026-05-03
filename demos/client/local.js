const hwsClient = require('hws/client');

const app = new hwsClient({
    server: 'http://localhost:1234/hws/1',
    cert: './certs/chain.pem',
    callback: (response => console.log('←', response)),
    close: (() => console.log('↓ stream closed')),
    error: (error => console.error('↓', error))
});

app.stream();

setTimeout(() => app.stop(), 10000);