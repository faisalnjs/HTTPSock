const express = require('express');
const http = require('http');
const hwsServer = require('hws/server');

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

app.use('/hws/1', hwsServer({ maxBody: '5mb', auth: true, clients, broadcasts }));
app.use('/hws/2', hwsServer({ maxBody: '10mb', auth: true, clients, broadcasts }));

app.get('/', (req, res) => res.send('hws server'));

server.listen(port, () => {
  console.log(`hws://${port}`);
});
