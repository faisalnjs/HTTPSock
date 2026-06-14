const isNode = (typeof process !== 'undefined') && process.versions && process.versions.node;
var HTTPSockClient;
if (isNode) {
    const mod = await import('./client.js');
    HTTPSockClient = mod && (mod.default || mod);
} else {
    HTTPSockClient = class HTTPSockClientBrowser {
        constructor(options = {
            server: 'https://sub.domain.tld:port/path',
            callback: ((response) => { console.log('←', response) }),
            close: (() => { console.log('↓ stream closed') }),
            error: ((error) => { console.error('↓', error) })
        }) {
            this.server = options.server || 'http://localhost:1234/';
            this.auth = options.auth;
            this.callback = options.callback || (response => console.log('←', response));
            this.close = options.close || (() => console.log('↓ stream closed'));
            this.error = options.error || (error => console.error('↓', error));
            this.controller = null;
            this.reader = null;
            this.running = false;
        };

        _makeAuthHeader() {
            if (!this.auth) return undefined;
            try {
                if (typeof this.auth === 'string') {
                    if (this.auth.indexOf(':') === -1) return 'Basic ' + this.auth;
                    return 'Basic ' + btoa(this.auth);
                } else if (this.auth.username || this.auth.password) {
                    return 'Basic ' + btoa((this.auth.username || '') + ':' + (this.auth.password || ''));
                };
            } catch (e) {
                return undefined;
            };
            return undefined;
        };

        async stream() {
            if (this.running) return;
            this.running = true;
            const headers = {};
            const authHeader = this._makeAuthHeader();
            if (authHeader) headers['Authorization'] = authHeader;
            try {
                this.controller = new AbortController();
                const res = await fetch(this.server, {
                    method: 'GET',
                    headers,
                    signal: this.controller.signal
                });
                if (!res.ok) throw new Error('Network response was not ok: ' + res.status);
                const reader = res.body.getReader();
                this.reader = reader;
                var buffer = new Uint8Array(0);
                const decoder = new TextDecoder();
                const isText = (buf) => {
                    for (var i = 0; i < buf.length; i++) {
                        const b = buf[i];
                        if ((b === 9) || (b === 10) || (b === 13)) continue;
                        if ((b >= 32) && (b <= 126)) continue;
                        return false;
                    };
                    return true;
                };
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        this.running = false;
                        try {
                            await this.close();
                        } catch (e) { };
                        break;
                    };
                    const chunk = value || new Uint8Array(0);
                    const newBuf = new Uint8Array(buffer.length + chunk.length);
                    newBuf.set(buffer, 0);
                    newBuf.set(chunk, buffer.length);
                    buffer = newBuf;
                    while (true) {
                        var crlfIdx = -1;
                        for (var i = 0; i < buffer.length - 1; i++) {
                            if ((buffer[i] === 13) && (buffer[i + 1] === 10)) {
                                crlfIdx = i;
                                break;
                            };
                        };
                        if (crlfIdx === -1) break;
                        const sizeLine = decoder.decode(buffer.subarray(0, crlfIdx)).trim();
                        const size = parseInt(sizeLine, 16);
                        if (Number.isNaN(size)) {
                            await this.error(new Error('Invalid httpsock size: ' + sizeLine));
                            return;
                        };
                        const frameTotal = crlfIdx + 2 + size + 2;
                        if (buffer.length < frameTotal) break;
                        const payloadStart = crlfIdx + 2;
                        const payload = buffer.subarray(payloadStart, payloadStart + size);
                        buffer = buffer.subarray(frameTotal);
                        var out = payload;
                        try {
                            if (isText(payload)) {
                                const s = decoder.decode(payload);
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
                            await this.callback(out);
                        } catch (err) {
                            try {
                                await this.error(err);
                            } catch (e) { };
                        };
                    }
                }
            } catch (err) {
                if (err && (err.name === 'AbortError')) {
                    try {
                        await this.close();
                    } catch (e) { };
                } else {
                    try {
                        await this.error(err);
                    } catch (e) { };
                };
            };
        };

        stop() {
            try {
                if (this.controller) this.controller.abort();
            } catch (e) { };
            this.running = false;
        };
    };
};

export default HTTPSockClient;
