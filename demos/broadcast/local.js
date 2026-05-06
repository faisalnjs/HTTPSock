const hwsBroadcast = require('../../broadcast');

const broadcaster1 = new hwsBroadcast({
  server: 'http://localhost:1234/hws/1',
  cert: './certs/chain.pem',
  auth: { username: 'broadcaster1', password: 'broadcasterPassword1' },
  callback: (response => console.log('→', response)),
  close: (() => console.log('↓ stream closed')),
  error: (error => console.error(error))
});

var counter1 = 0;
setInterval(() => {
  const message = ++counter1;
  console.log('←', message);
  broadcaster1.send(message);
}, 1000);


const broadcaster2 = new hwsBroadcast({
  server: 'http://localhost:1234/hws/2',
  cert: './certs/chain.pem',
  auth: { username: 'broadcaster2', password: 'broadcasterPassword2' },
  callback: (response => console.log('→', response)),
  error: (error => console.error(error))
});

var counter2 = 0;
setInterval(() => {
  const message = ++counter2;
  console.log('←', message);
  broadcaster2.send(message);
}, 1000);

// setTimeout(() => app.stop(), 10000);