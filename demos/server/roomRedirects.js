const express = require('express');
const http = require('http');
const hwsServer = require('../../server');

const app = express();
const server = http.createServer(app);
const PORT = 1234;

const rooms = [1, 2, 3, 4];

for (const room of rooms) {
  app.use(`/room/${room}`, hwsServer({ maxBody: `${room * 5}mb` }));
};

app.use('/room/5', hwsServer({ maxBody: '5mb' }));

function redirectToRoom(req, res, next) {
  const room = req.query.room;
  if (room && rooms.includes(Number(room))) return res.redirect(`/room/${room}`);
  next();
};

app.get('/room', redirectToRoom, (req, res) => res.send('no room query'));

app.get('/', (req, res) => res.send('hws server'));

server.listen(PORT, () => {
  console.log(`hws://${PORT}`);
});
