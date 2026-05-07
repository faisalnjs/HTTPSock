const httpsockClient = require('httpsock/client');

const client = new httpsockClient({
    server: 'https://ws.faisaln.com/httpsock/1',
    cert: './certs/chain.pem',
    auth: { username: 'client1', password: 'password1' },
    callback: (response => console.log('→', response)),
    close: (() => console.log('↓ stream closed')),
    error: (error => console.error('↓', error))
});

client.stream();

// setTimeout(() => client.stop(), 10000);