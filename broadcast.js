"use strict";

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

const isNode = (typeof process !== 'undefined') && process.versions?.node && (typeof Buffer !== 'undefined');

/**
 * HTTPSockBroadcast
 *
 * Broadcaster that POSTs data to an `httpsock` server POST endpoint.
 *
 * @param {Object} [options]
 * @param {string} [options.server='https://sub.domain.tld:port/path'] - URL of the httpsock server POST endpoint.
 * @param {string|Buffer} [options.cert='./certs/chain.pem'] - Optional certificate chain for HTTPS servers.
 * @param {function} [options.callback=(response) => console.log('←', response)] - Called with the server response text after a POST completes.
 * @param {function} [options.close=() => console.log('↓ stream closed')] - Called when request is ended normally.
 * @param {function} [options.error=(err) => console.error('↓', err)] - Called on request errors.
 * @param {string|Object} [options.auth] - Optional basic auth credentials.
 *
 * Methods:
 * - send(data): sends data (Buffer, object -> JSON, string)
 * - stop(): aborts the ongoing request
 */
class HTTPSockBroadcast {
  constructor(options = {
    server: 'https://sub.domain.tld:port/path',
    cert: './certs/chain.pem',
    callback: ((response) => { console.log('←', response) }),
    close: (() => { console.log('↓ stream closed') }),
    error: ((error) => { console.error('↓', error) })
  }) {
    this.server = options.server || 'http://localhost:1234/';
    if (options.cert && ((isNode ? Buffer.isBuffer(options.cert) : false) || ((typeof options.cert === 'string') && options.cert.includes('BEGIN CERTIFICATE')))) {
      this.cert = options.cert;
    } else if (isNode) {
      try {
        this.cert = fs.readFileSync((typeof options.cert === 'string') ? options.cert : './certs/chain.pem');
      } catch (e) {
        this.cert = undefined;
      };
    } else {
      this.cert = undefined;
    };
    this.callback = options.callback || (response => console.log('←', response));
    this.close = options.close || (() => console.log('↓ stream closed'));
    this.error = options.error || (error => console.error('↓', error));
    this.auth = options.auth;
    this.err = this.err.bind(this);
    this.request = null;
    this.connected = true;
  };

  async err(error) {
    this.connected = false;
    if (error === 'ended') {
      await this.close();
    } else {
      await this.error(error);
    };
  };

  send(data) {
    this.connected = true;
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
          'Content-Length': body.length,
          ...(this.auth ? {
            Authorization: ((typeof this.auth === 'string') && (this.auth.indexOf(':') === -1)) ? ('Basic ' + this.auth) : ('Basic ' + Buffer.from((typeof this.auth === 'string') ? this.auth : (this.auth.username + ':' + this.auth.password)).toString('base64'))
          } : {})
        },
        ca: this.cert
      },
      res => {
        var response = '';
        res.on('data', r => (response += r));
        res.on('end', async () => {
          await this.callback(response);
        });
      }
    );
    this.request.on('error', this.err);
    this.request.write(body);
    this.request.end();
  };

  /**
   * sendTo(username, data)
   *
   * Send a message targeted at a specific connected client username. This
   * includes an `x-httpsock-username` header to instruct the server to route
   * the message to that client. Using headers or query parameters on the URL
   * to target delivery is deprecated/removed; use this API instead.
   *
   * @param {string} username
   * @param {Buffer|string|Object} data
   */
  sendTo(username, data) {
    this.connected = true;
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
          'Content-Length': body.length,
          'x-httpsock-username': String(username),
          ...(this.auth ? {
            Authorization: ((typeof this.auth === 'string') && (this.auth.indexOf(':') === -1)) ? ('Basic ' + this.auth) : ('Basic ' + Buffer.from((typeof this.auth === 'string') ? this.auth : (this.auth.username + ':' + this.auth.password)).toString('base64'))
          } : {})
        },
        ca: this.cert
      },
      res => {
        var response = '';
        res.on('data', r => (response += r));
        res.on('end', async () => {
          await this.callback(response);
        });
      }
    );
    this.request.on('error', this.err);
    this.request.write(body);
    this.request.end();
  };

  /**
   * sendQuiet(data)
   *
   * Send a message that the server should process in its callback but not forward to connected clients.
   *
   * @param {Buffer|string|Object} data
   */
  sendQuiet(data) {
    this.connected = true;
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
          'Content-Length': body.length,
          'x-httpsock-no-broadcast': '1',
          ...(this.auth ? {
            Authorization: ((typeof this.auth === 'string') && (this.auth.indexOf(':') === -1)) ? ('Basic ' + this.auth) : ('Basic ' + Buffer.from((typeof this.auth === 'string') ? this.auth : (this.auth.username + ':' + this.auth.password)).toString('base64'))
          } : {})
        },
        ca: this.cert
      },
      res => {
        var response = '';
        res.on('data', r => (response += r));
        res.on('end', async () => {
          await this.callback(response);
        });
      }
    );
    this.request.on('error', this.err);
    this.request.write(body);
    this.request.end();
  };

  stop() {
    if (this.request) this.request.destroy('ended');
    this.connected = false;
  };
};

module.exports = HTTPSockBroadcast;
