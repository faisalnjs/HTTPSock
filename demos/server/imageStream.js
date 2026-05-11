const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const HTTPSockServer = require('httpsock/server');

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

app.use('/httpsock', HTTPSockServer({ maxBody: '10mb', auth: true, clients, broadcasts }));

const streamPath = path.resolve(__dirname, '..', '..', 'stream.jpeg');

function sendStream(res, data) {
  const header = [
    'BoundaryString',
    'Content-Type: image/jpeg',
    `Content-Length: ${data.length}`,
    '',
    ''
  ].join('\r\n');
  res.write(header);
  res.write(data);
  res.write('\r\n');
};

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=BoundaryString');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.readFile(streamPath, (err, data) => {
    if (!err) sendStream(res, data);
  });
  var timeout = null;
  const scheduleSend = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      fs.readFile(streamPath, (err, data) => {
        if (!err) sendStream(res, data);
      });
    }, 100);
  };
  const watcher = fs.watch(streamPath, (eventType) => {
    if (eventType === 'change') scheduleSend();
  });
  req.on('close', () => {
    watcher.close();
    res.end();
  });
});

server.listen(port, () => {
  console.log(`httpsock://${port}`);
});
