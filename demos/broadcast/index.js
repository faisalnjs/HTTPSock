const hwsBroadcast = require('../../broadcast');

const broadcaster1 = new hwsBroadcast({
  server: 'https://ws.faisaln.com/hws/1',
  cert: './certs/chain.pem',
  auth: { username: 'broadcaster1', password: 'broadcasterPassword1' },
  callback: (response => console.log('→', response)),
  close: (() => console.log('↓ stream closed')),
  error: (error => console.error(error))
});

var counter1 = 0;
setInterval(() => {
  const message = {
    id: ++counter1,
    text: `1 #${counter1}`
  };
  console.log('←', message);
  broadcaster1.send(message);
}, 3000);


const broadcaster2 = new hwsBroadcast({
  server: 'https://ws.faisaln.com/hws/2',
  cert: './certs/chain.pem',
  auth: { username: 'broadcaster2', password: 'broadcasterPassword2' },
  callback: (response => console.log('→', response)),
  error: (error => console.error(error))
});

var counter2 = 0;
setInterval(() => {
  const message = {
    id: ++counter2,
    text: `2 #${counter2}`
  };
  console.log('←', message);
  broadcaster2.send(message);
}, 3000);

// setTimeout(() => app.stop(), 10000);