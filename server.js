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
 * @param {Array} [options.clients=[]] - List of allowed client credentials. Each item can be an object with `username` and `password` properties, an array of `[username, password]`, or a string in the format 'username:password'.
 * @param {Array} [options.broadcasts=[]] - List of allowed broadcaster credentials. Each item can be an object with `username` and `password` properties, an array of `[username, password]`, or a string in the format 'username:password'.
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

  const messageQueue = [];

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

    var closed = false;

    stream.on('error', (err) => {
      if (err && err.code === 'ERR_STREAM_WRITE_AFTER_END') return;
      console.error('HTTPSockStream error:', err && err.stack ? err.stack : err);
      try {
        stream.destroy();
      } catch (e) { };
    });

    req.on('close', () => {
      closed = true;
      try {
        if (!stream.writableEnded && !stream.destroyed) stream.end();
      } catch (e) { };
    });

    const drain = () => {
      if (closed || stream.destroyed || stream.writableEnded) return;
      while (messageQueue.length) {
        const msg = messageQueue.shift();
        try {
          const ok = stream.write(Buffer.from(msg));
          if (!ok) {
            stream.once('drain', () => { if (!closed) drain(); });
            return;
          };
        } catch (err) {
          if (err && err.code === 'ERR_STREAM_WRITE_AFTER_END') return;
          console.error('Error writing to stream:', err && err.stack ? err.stack : err);
          return;
        };
        if (closed || stream.destroyed || stream.writableEnded) return;
      };
      if (!closed) setImmediate(drain);
    };

    drain();
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
    if (Buffer.isBuffer(body)) {
      if (contentType && (contentType.indexOf('application/json') !== -1)) {
        const string = body.toString();
        callback(authenticatedAs, string);
        messageQueue.push(body);
      } else {
        callback(authenticatedAs, `${contentType} (${body.length} bytes)`);
        messageQueue.push(body);
      };
    } else {
      const string = (body === undefined || body === null) ? '' : String(body);
      callback(authenticatedAs, string);
      messageQueue.push(Buffer.from(string));
    };
    res.type('text').send('OK');
  });

  return router;
};

module.exports = HTTPSockServer;