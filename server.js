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
    const drain = () => {
      while (messageQueue.length) {
        const ok = stream.write(Buffer.from(messageQueue.shift()));
        if (!ok) {
          stream.once('drain', drain);
          return;
        };
      };
      setImmediate(drain);
    };
    drain();
    req.on('close', () => stream.end());
  });

  router.post('/', (req, res) => {
    const body = req.body.toString();
    console.log('Received from broadcaster:', body);
    messageQueue.push(body);
    res.type('text').send('OK');
  });

  return router;
};

module.exports = hwsRouter;