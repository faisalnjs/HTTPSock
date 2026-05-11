const express = require('express');
const http = require('http');
const HTTPSockServer = require('httpsock/server');

const app = express();
const server = http.createServer(app);
const port = 1234;

function clients(username, password) {
  if ((username === 'client1') && (password === 'password1')) return true;
  if ((username === 'client2') && (password === 'password2')) return true;
  return false;
};
const broadcasts = [
  { username: 'broadcaster1', password: 'broadcasterPassword1' },
  { username: 'broadcaster2', password: 'broadcasterPassword2' }
];

app.use('/httpsock/1', HTTPSockServer({ maxBody: '5mb', auth: true, clients, broadcasts }));
app.use('/httpsock/2', HTTPSockServer({ maxBody: '10mb', auth: true, clients, broadcasts }));

app.get('/', (req, res) => res.send('httpsock server'));

server.listen(port, () => {
  console.log(`httpsock://${port}`);
});
