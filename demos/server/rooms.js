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

const rooms = [1, 2, 3, 4];

for (const room of rooms) {
  app.use(`/room/${room}`, hwsServer({ maxBody: `${room * 5}mb`, auth: true, clients, broadcasts }));
};

app.use('/room/5', hwsServer({ maxBody: '5mb', auth: true, clients, broadcasts }));

app.get('/', (req, res) => res.send('hws server'));

server.listen(port, () => {
  console.log(`hws://${port}`);
});
