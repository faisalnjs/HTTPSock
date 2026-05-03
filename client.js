"use strict";

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

class hwsClient {
    constructor(options = {
        server: 'https://sub.domain.tld:port/path',
        cert: './certs/chain.pem',
        callback: ((response) => { console.log('←', response) }),
        close: (() => { console.log('↓ stream closed') }),
        error: ((error) => { console.error('↓', error) })
    }) {
        this.server = options.server || 'https://sub.domain.tld:port/path';
        this.cert = fs.readFileSync(options.cert || './certs/chain.pem');
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

    stream() {
        console.log('↑ connecting...');
        const url = new URL(this.server);
        this.request = ((url.protocol === 'https:') ? https : http).request(
            {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: 'GET',
                ca: this.cert
            },
            res => {
                res.on('data', chunk => this.callback(chunk.toString()));
                res.on('end', () => this.close());
            }
        );
        this.request.on('error', this.err);
        this.request.end();
    };

    stop() {
        if (this.request) this.request.destroy('ended');
    };
};

module.exports = hwsClient;