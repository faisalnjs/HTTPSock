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
        if (error === 'ended' || (error && (error.code === 'ECONNRESET'))) {
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
                var buffer = Buffer.alloc(0);
                const feed = (chunk) => {
                    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
                    while (true) {
                        const crlfIdx = buffer.indexOf('\r\n');
                        if (crlfIdx === -1) break;
                        const sizeLine = buffer.subarray(0, crlfIdx).toString().trim();
                        const size = parseInt(sizeLine, 16);
                        if (Number.isNaN(size)) {
                            this.err(new Error('Invalid hws size: ' + sizeLine));
                            return;
                        };
                        const frameTotal = crlfIdx + 2 + size + 2;
                        if (buffer.length < frameTotal) break;
                        const payloadStart = crlfIdx + 2;
                        const payload = buffer.subarray(payloadStart, payloadStart + size);
                        buffer = buffer.subarray(frameTotal);
                        var out = payload;
                        try {
                            const isText = (buf) => {
                                for (var i = 0; i < buf.length; i++) {
                                    const b = buf[i];
                                    if ((b === 9) || (b === 10) || (b === 13)) continue;
                                    if ((b >= 32) && (b <= 126)) continue;
                                    return false;
                                };
                                return true;
                            };
                            if (Buffer.isBuffer(payload) && isText(payload)) {
                                const s = payload.toString();
                                try {
                                    out = JSON.parse(s);
                                } catch (e) {
                                    out = s;
                                };
                            };
                        } catch (convErr) {
                            out = payload;
                        };
                        try {
                            this.callback(out);
                        } catch (err) {
                            this.err(err);
                        };
                    };
                };
                res.on('data', feed);
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