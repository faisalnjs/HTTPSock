const hwsClient = require('../../client');

const client1 = new hwsClient({
  server: 'https://ws.faisaln.com/hws/1',
  cert: './certs/chain.pem',
  callback: (response => console.log('←', response)),
  close: (() => console.log('↓ stream closed')),
  error: (error => console.error(error))
});

var counter1 = 0;
setInterval(() => {
  const message = {
    id: ++counter1,
    text: `1 #${counter1}`
  };
  console.log('→', message);
  client1.send(message);
}, 3000);


const client2 = new hwsClient({
  server: 'https://ws.faisaln.com/hws/2',
  CA: './certs/chain.pem',
  callback: (response => console.log('←', response)),
  error: (error => console.error(error))
});

var counter2 = 0;
setInterval(() => {
  const message = {
    id: ++counter2,
    text: `2 #${counter2}`
  };
  console.log('→', message);
  client2.send(message);
}, 3000);
