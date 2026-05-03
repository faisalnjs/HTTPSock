const express = require('express');
const http = require('http');
const hwsServer = require('hws/server');

const app = express();
const server = http.createServer(app);
const port = 1234;

const rooms = [1, 2, 3, 4];

for (const room of rooms) {
  app.use(`/room/${room}`, hwsServer({ maxBody: `${room * 5}mb` }));
};

app.use('/room/5', hwsServer({ maxBody: '5mb' }));

app.get('/', (req, res) => res.send('hws server'));

server.listen(port, () => {
  console.log(`hws://${port}`);
});
