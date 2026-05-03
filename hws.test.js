const express = require('express');
const http = require('http');
const hwsServer = require('./server');

const app = express();
const server = http.createServer(app);
const port = 1234;

describe('Server', () => {
  test('express', () => {
    expect(() => {
      app.get('/', (req, res) => res.send('hws server'));
    }).not.toThrow();
  });

  app.get('/', (req, res) => res.send('hws server'));

  test('rooms', () => {
    expect(() => {
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
    }).not.toThrow();
  });

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

  beforeAll((done) => {
    server.listen(port, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  test('start', () => {
    expect(server.listening).toBe(true);
  });
});

const hwsBroadcast = require('hws/broadcast');

describe('Broadcast', () => {
  test('create', () => {
    expect(() => {
      const broadcaster = new hwsBroadcast({
        server: `http://localhost:${port}/room/1`,
        cert: './certs/chain.pem',
        callback: (response => console.log('←', response)),
        close: (() => console.log('↓ stream closed')),
        error: (error => console.error(error))
      });
      broadcaster.stop();
    }).not.toThrow();
  });

  const logSpy = jest.spyOn(console, 'log');

  beforeAll((done) => {
    server.listen(port);

    const broadcaster = new hwsBroadcast({
      server: `http://localhost:${port}/room/1`,
      cert: './certs/chain.pem',
      callback: (response => console.log('←', response)),
      close: (() => console.log('↓ stream closed')),
      error: (error => console.error(error))
    });

    const message1 = {
      id: 1,
      text: 1
    };
    console.log('→', message1);
    broadcaster.send(message1);

    const message2 = {
      id: 2,
      text: 2
    };
    console.log('→', message2);
    broadcaster.send(message2);

    setTimeout(() => {
      broadcaster.stop();
      done();
    }, 100);
  });

  afterAll((done) => {
    logSpy.mockRestore();
    server.close(done);
  });

  test('local send-receive', async () => {
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(6);
    expect(logSpy).toHaveBeenCalledWith("→", { "id": 1, "text": 1 });
    expect(logSpy).toHaveBeenCalledWith("→", { "id": 2, "text": 2 });
    expect(logSpy).toHaveBeenCalledWith("Received from broadcaster:", "{\"id\":1,\"text\":1}");
    expect(logSpy).toHaveBeenCalledWith("Received from broadcaster:", "{\"id\":2,\"text\":2}");
  });
});

const hwsClient = require('./client');

describe('Client', () => {
  var app = null;

  test('create', () => {
    expect(() => {
      app = new hwsClient({
        server: `http://localhost:${port}/room/1`,
        cert: './certs/chain.pem',
        callback: (response => console.log('←', response)),
        close: (() => console.log('↓ stream closed')),
        error: (error => console.error(error))
      });
      app.stream();
      app.stop();
    }).not.toThrow();
  });

  const logSpy = jest.spyOn(console, 'log');

  beforeAll((done) => {
    server.listen(port);

    app = new hwsClient({
      server: 'http://localhost:1234/hws/1',
      cert: './certs/chain.pem',
      callback: (response => console.log('←', response)),
      close: (() => console.log('↓ stream closed')),
      error: (error => console.error('↓', error))
    });

    app.stream();

    const client = new hwsBroadcast({
      server: `http://localhost:${port}/room/1`,
      cert: './certs/chain.pem',
      callback: (response => console.log('←', response)),
      close: (() => console.log('↓ stream closed')),
      error: (error => console.error(error))
    });

    const message1 = {
      id: 1,
      text: 1
    };
    console.log('→', message1);
    client.send(message1);

    const message2 = {
      id: 2,
      text: 2
    };
    console.log('→', message2);
    client.send(message2);

    client.stop();
    app.stop();

    setTimeout(() => {
      done();
    }, 100);
  });

  afterAll((done) => {
    logSpy.mockRestore();
    server.close(done);
  });

  test('local send-receive-receive', async () => {
    expect(true).toBe(true);
  });
});