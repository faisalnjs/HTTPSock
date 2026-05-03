const express = require('express');
const http = require('http');
const hwsServer = require('../../server');

const app = express();
const server = http.createServer(app);
const PORT = 1234;

app.use('/hws/1', hwsServer({ maxBody: '5mb' }));
app.use('/hws/2', hwsServer({ maxBody: '10mb' }));

app.get('/', (req, res) => res.send('hws server'));

server.listen(PORT, () => {
  console.log(`hws://${PORT}`);
});
