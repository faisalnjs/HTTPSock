"use strict";

const { Router } = require('express');
const { Transform } = require('stream');

class HTTPSockStream extends Transform {
  _transform(chunk, _enc, callback) {
    const size = chunk.length.toString(16);
    this.push(size + '\r\n');
    this.push(chunk);
    this.push('\r\n');
    callback();
  };
};

/**
 * Returns the httpsock server router.
 *
 * @param {Object} [options]
 * @param {number} [options.maxBody='10mb'] - Maximum allowed body size for POST requests.
 * @param {boolean} [options.auth=false] - Whether to require authentication for clients and broadcasters.
 * @param {Array} [options.clients=[]] - List of allowed client credentials. Each item can be an object with `username` and `password` properties, an array of `[username, password]`, or a string in the format 'username:password'. Alternatively, can be a function that returns false or the authenticated username when given parameters: username, password.
 * @param {Array} [options.broadcasts=[]] - List of allowed broadcaster credentials. Each item can be an object with `username` and `password` properties, an array of `[username, password]`, or a string in the format 'username:password'. Alternatively, can be a function that returns false or the authenticated username when given parameters: username, password.
 * @param {function} [options.callback=((authenticatedAs, message) => console.log(`←→ ${authenticatedAs}:`, message))] - Callback function with successful data sent to the server. Receives two parameters: authenticatedAs, message.
 * @returns {Router}
 */
function HTTPSockServer(options = {}) {
  const router = Router();
  const requireAuth = Boolean(options.auth);
  const allowedClients = options.clients || [];
  const allowedBroadcasts = options.broadcasts || [];
  const callback = options.callback || ((authenticatedAs, message) => console.log(`←→ ${authenticatedAs}:`, message));

  const parseBasic = (header) => {
    if (!header || (typeof header !== 'string')) return null;
    const parts = header.split(' ');
    if (parts.length !== 2) return null;
    if (parts[0] !== 'Basic') return null;
    try {
      const decoded = Buffer.from(parts[1], 'base64').toString();
      const sep = decoded.indexOf(':');
      if (sep === -1) return null;
      return { username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
    } catch (e) {
      return null;
    };
  };

  const matches = async (credentials, list) => {
    if (!credentials) return false;
    if (typeof list === 'function') {
      try {
        return await list(credentials.username, credentials.password);
      } catch { };
    } else {
      for (const item of list) {
        if (!item) continue;
        if (item.username && item.password) {
          if ((item.username === credentials.username) && (item.password === credentials.password)) return credentials.username;
        } else if (Array.isArray(item) && (item.length >= 2)) {
          if ((item[0] === credentials.username) && (item[1] === credentials.password)) return credentials.username;
        } else if (typeof item === 'string') {
          const itemCredentials = item.split(':');
          if ((itemCredentials[0] === credentials.username) && (itemCredentials[1] === credentials.password)) return credentials.username;
        };
      };
    };
    return false;
  };

  router.use(require('express').raw({
    type: '*/*',
    limit: options.maxBody || '10mb',
  }));

  router.connections = [];

  const enqueueForConnection = (connection, buffer) => {
    if (!connection || connection.closed || connection.stream.destroyed || connection.stream.writableEnded) return;
    connection.queue.push(buffer);
    drainConnection(connection);
  };

  const drainConnection = (connection) => {
    if (!connection || connection.closed || connection.stream.destroyed || connection.stream.writableEnded) return;
    while (connection.queue.length) {
      const message = connection.queue[0];
      try {
        const ok = connection.stream.write(Buffer.from(message));
        if (!ok) {
          connection.stream.once('drain', () => { if (!connection.closed) drainConnection(connection); });
          return;
        };
      } catch (err) {
        if (err && err.code === 'ERR_STREAM_WRITE_AFTER_END') return;
        console.error('Error writing to stream:', (err && err.stack) ? err.stack : err);
        return;
      };
      connection.queue.shift();
      if (connection.closed || connection.stream.destroyed || connection.stream.writableEnded) return;
    };
  };

  router.sendTo = (room, username, buffer) => {
    for (const connection of router.connections) {
      if (connection.closed) continue;
      if (room && (connection.room !== room)) continue;
      if (username && (connection.username !== username)) continue;
      enqueueForConnection(connection, buffer);
    };
  };

  router.sendToRoom = (room, buffer) => router.sendTo(room, undefined, buffer);
  router.sendToUser = (username, buffer) => router.sendTo(undefined, username, buffer);
  router.sendAll = (buffer) => router.sendTo(undefined, undefined, buffer);

  router.get('/', async (req, res) => {
    if (requireAuth) {
      const credentials = parseBasic(req.headers.authorization);
      if (await matches(credentials, allowedClients) === false) {
        res.set('WWW-Authenticate', 'Basic realm="httpsock"');
        return res.status(401).type('text').send('Unauthorized');
      };
    };
    res.set({
      'Content-Type': 'application/octet-stream',
      'Transfer-Encoding': 'chunked',
      Connection: 'keep-alive',
    });
    const stream = new HTTPSockStream();
    stream.pipe(res);

    const connection = {
      stream,
      closed: false,
      queue: [],
      username: undefined,
      room: undefined,
    };

    stream.on('error', (err) => {
      if (err && (err.code === 'ERR_STREAM_WRITE_AFTER_END')) return;
      console.error('HTTPSockStream error:', (err && err.stack) ? err.stack : err);
      try {
        stream.destroy();
      } catch (e) { };
    });

    req.on('close', () => {
      connection.closed = true;
      try {
        if (!stream.writableEnded && !stream.destroyed) stream.end();
      } catch (e) { };
      const idx = router.connections.indexOf(connection);
      if (idx !== -1) router.connections.splice(idx, 1);
    });

    try {
      const credentials = parseBasic(req.headers.authorization);
      const matched = requireAuth ? await matches(credentials, allowedClients) : (credentials ? (credentials.username || undefined) : undefined);
      connection.username = matched || req.headers['x-httpsock-username'] || (req.query && req.query.username) || 'client';
    } catch (e) {
      connection.username = req.headers['x-httpsock-username'] || (req.query && req.query.username) || 'client';
    };
    connection.room = req.headers['x-httpsock-room'] || (req.query && req.query.room) || 'default';
    connection.send = (message) => {
      var buffer;
      if (Buffer.isBuffer(message)) {
        buffer = message;
      } else if (typeof message === 'object') {
        try {
          buffer = Buffer.from(JSON.stringify(message));
        } catch (e) {
          buffer = Buffer.from(String(message));
        };
      } else {
        buffer = Buffer.from(String(message));
      };
      enqueueForConnection(connection, buffer);
    };
    router.connections.push(connection);
    if (options.welcome) {
      try {
        const welcomeMsg = (typeof options.welcome === 'function') ? await options.welcome(connection.username) : options.welcome;
        if (welcomeMsg !== undefined) {
          var buffer;
          if (Buffer.isBuffer(welcomeMsg)) {
            buffer = welcomeMsg;
          } else if ((typeof welcomeMsg === 'object') && (welcomeMsg !== null)) {
            try {
              buffer = Buffer.from(JSON.stringify(welcomeMsg));
            } catch (e) {
              buffer = Buffer.from(String(welcomeMsg));
            };
          } else {
            buffer = Buffer.from(String(welcomeMsg));
          };
          enqueueForConnection(connection, buffer);
        };
      } catch (e) { };
    };
  });

  router.post('/', async (req, res) => {
    var authenticatedAs = 'broadcaster';
    if (requireAuth) {
      const credentials = parseBasic(req.headers.authorization);
      authenticatedAs = await matches(credentials, allowedBroadcasts);
      if (authenticatedAs === false) {
        res.set('WWW-Authenticate', 'Basic realm="httpsock"');
        return res.status(401).type('text').send('Unauthorized');
      };
    };
    const body = req.body;
    const contentType = req.headers['content-type'] || '';
    const targetRoom = req.headers['x-httpsock-room'];
    const targetUser = req.headers['x-httpsock-username'];
    if (Buffer.isBuffer(body)) {
      if (contentType && (contentType.indexOf('application/json') !== -1)) {
        const string = body.toString();
        callback(authenticatedAs, string);
        if (targetRoom || targetUser) {
          if (targetUser) {
            router.sendToUser(targetUser, body);
          } else {
            router.sendToRoom(targetRoom, body);
          };
        } else {
          for (const connection of router.connections) enqueueForConnection(connection, body);
        };
      } else {
        callback(authenticatedAs, `${contentType} (${body.length} bytes)`);
        if (targetRoom || targetUser) {
          if (targetUser) {
            router.sendToUser(targetUser, body);
          } else {
            router.sendToRoom(targetRoom, body);
          };
        } else {
          for (const connection of router.connections) enqueueForConnection(connection, body);
        };
      };
    } else {
      const string = (body === undefined || body === null) ? '' : String(body);
      callback(authenticatedAs, string);
      const buffer = Buffer.from(string);
      if (targetRoom || targetUser) {
        if (targetUser) {
          router.sendToUser(targetUser, buffer);
        } else {
          router.sendToRoom(targetRoom, buffer);
        };
      } else {
        for (const connection of router.connections) enqueueForConnection(connection, buffer);
      };
    };
    res.type('text').send('OK');
  });

  return router;
};

module.exports = HTTPSockServer;
