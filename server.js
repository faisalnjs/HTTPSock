"use strict";

const { Router } = require('express');
const { Transform } = require('stream');

class HwsStream extends Transform {
  _transform(chunk, _enc, callback) {
    const size = chunk.length.toString(16);
    this.push(size + '\r\n');
    this.push(chunk);
    this.push('\r\n');
    callback();
  };
};

/**
 * Returns the HWS server router.
 *
 * @param {Object} [options]
 * @param {number} [options.maxBody='10mb']
 * @returns {Router}
 */
function hwsRouter(options = {}) {
  const router = Router();

  router.use(require('express').raw({
    type: '*/*',
    limit: options.maxBody || '10mb',
  }));

  const messageQueue = [];

  router.get('/', (req, res) => {
    res.set({
      'Content-Type': 'application/octet-stream',
      'Transfer-Encoding': 'chunked',
      Connection: 'keep-alive',
    });
    const stream = new HwsStream();
    stream.pipe(res);

    var closed = false;

    stream.on('error', (err) => {
      if (err && err.code === 'ERR_STREAM_WRITE_AFTER_END') return;
      console.error('HwsStream error:', err && err.stack ? err.stack : err);
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

  router.post('/', (req, res) => {
    const body = req.body;
    const contentType = req.headers['content-type'] || '';
    if (Buffer.isBuffer(body)) {
      if (contentType && contentType.indexOf('application/json') !== -1) {
        const s = body.toString();
        console.log('Received from broadcaster:', s);
        messageQueue.push(body);
      } else {
        console.log('Received from broadcaster: %s %d bytes', contentType, body.length);
        messageQueue.push(body);
      };
    } else {
      const string = (body === undefined || body === null) ? '' : String(body);
      console.log('Received from broadcaster:', string);
      messageQueue.push(Buffer.from(string));
    };
    res.type('text').send('OK');
  });

  return router;
};

module.exports = hwsRouter;