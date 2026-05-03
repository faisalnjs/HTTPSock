const express = require('express');
const http = require('http');
const hwsServer = require('hws/server');

const app = express();
const server = http.createServer(app);
const port = 1234;

app.use('/hws/1', hwsServer({ maxBody: '5mb' }));
app.use('/hws/2', hwsServer({ maxBody: '10mb' }));

app.get('/', (req, res) => res.send('hws server'));

server.listen(port, () => {
  console.log(`hws://${port}`);
});
