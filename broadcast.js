"use strict";

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

class hwsBroadcast {
  constructor(options = {
    server: 'https://sub.domain.tld:port/path',
    cert: './certs/chain.pem',
    callback: ((response) => { console.log('←', response) }),
    close: (() => { console.log('↓ stream closed') }),
    error: ((error) => { console.error('↓', error) })
  }) {
    this.server = options.server || 'https://sub.domain.tld:port/path';
    if (options.cert && Buffer.isBuffer(options.cert)) {
      this.cert = options.cert;
    } else if (options.cert && (typeof options.cert === 'string')) {
      this.cert = fs.readFileSync(options.cert);
    } else {
      try {
        this.cert = fs.readFileSync('./certs/chain.pem');
      } catch (e) {
        this.cert = undefined;
      };
    };
    this.callback = options.callback || (response => console.log('←', response));
    this.close = options.close || (() => console.log('↓ stream closed'));
    this.error = options.error || (error => console.error('↓', error));
    this.err = this.err.bind(this);
    this.request = null;
  };

  err(error) {
    if (error === 'ended') {
      this.close();
    } else {
      this.error(error);
    };
  };

  send(data) {
    const url = new URL(this.server);
    var body = data;
    var contentType = 'application/octet-stream';
    if (Buffer.isBuffer(data)) {
      body = data;
    } else if (typeof data === 'object') {
      body = Buffer.from(JSON.stringify(data));
      contentType = 'application/json';
    } else {
      body = Buffer.from(String(data));
      contentType = 'text/plain';
    };
    this.request = ((url.protocol === 'https:') ? https : http).request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': body.length
        },
        ca: this.cert
      },
      res => {
        var response = '';
        res.on('data', r => (response += r));
        res.on('end', () => this.callback(response));
      }
    );
    this.request.on('error', this.err);
    this.request.write(body);
    this.request.end();
  };

  stop() {
    if (this.request) this.request.destroy('ended');
  };
};

module.exports = hwsBroadcast;