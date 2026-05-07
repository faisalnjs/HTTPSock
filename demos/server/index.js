const express = require('express');
const http = require('http');
const httpsockServer = require('httpsock/server');

const app = express();
const server = http.createServer(app);
const port = 1234;

const clients = [
  { username: 'client1', password: 'password1' },
  { username: 'client2', password: 'password2' }
];
const broadcasts = [
  { username: 'broadcaster1', password: 'broadcasterPassword1' },
  { username: 'broadcaster2', password: 'broadcasterPassword2' }
];

app.use('/httpsock/1', httpsockServer({ maxBody: '5mb', auth: true, clients, broadcasts }));
app.use('/httpsock/2', httpsockServer({ maxBody: '10mb', auth: true, clients, broadcasts }));

app.get('/', (req, res) => res.send('httpsock server'));

server.listen(port, () => {
  console.log(`httpsock://${port}`);
});
