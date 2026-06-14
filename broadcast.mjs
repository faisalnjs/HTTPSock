const isNode = (typeof process !== 'undefined') && process.versions && process.versions.node;
var HTTPSockBroadcast;
if (isNode) {
    const mod = await import('./broadcast.js');
    HTTPSockBroadcast = mod && (mod.default || mod);
} else {
    /**
     * HTTPSockBroadcast (browser)
     *
     * Browser-compatible broadcaster that POSTs data via fetch.
     *
     * @param {Object} [options]
     * @param {string} [options.server='https://sub.domain.tld:port/path'] - URL of the httpsock server POST endpoint.
     * @param {function} [options.callback=(response) => console.log('←', response)] - Called with response text after POST completes.
     * @param {function} [options.close=() => console.log('↓ stream closed')] - Called when aborted/closed.
     * @param {function} [options.error=(err) => console.error('↓', err)] - Called on errors.
     * @param {string|Object} [options.auth] - Optional basic auth credentials.
     */
    HTTPSockBroadcast = class HTTPSockBroadcastBrowser {
        constructor(options = {
            server: 'https://sub.domain.tld:port/path',
            callback: ((response) => { console.log('←', response) }),
            close: (() => { console.log('↓ stream closed') }),
            error: ((error) => { console.error('↓', error) })
        }) {
            this.server = options.server || 'http://localhost:1234/';
            this.callback = options.callback || (response => console.log('←', response));
            this.close = options.close || (() => console.log('↓ stream closed'));
            this.error = options.error || (error => console.error('↓', error));
            this.auth = options.auth;
            this.controller = null;
            this.requestPromise = null;
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

        async err(error) {
            if (error === 'ended') {
                try {
                    await this.close();
                } catch (e) { };
            } else {
                try {
                    await this.error(error);
                } catch (e) { };
            };
        };

        async send(data) {
            var body = data;
            var contentType = 'application/octet-stream';
            if (data instanceof Blob) {
                body = data;
                contentType = data.type || 'application/octet-stream';
            } else if ((data instanceof ArrayBuffer) || ArrayBuffer.isView(data)) {
                body = (data instanceof ArrayBuffer) ? new Blob([data]) : new Blob([data.buffer]);
                contentType = 'application/octet-stream';
            } else if ((typeof data === 'object') && (data !== null)) {
                try {
                    body = JSON.stringify(data);
                    contentType = 'application/json';
                } catch (e) {
                    body = String(data);
                    contentType = 'text/plain';
                };
            } else {
                body = String(((data === undefined) || (data === null)) ? '' : data);
                contentType = 'text/plain';
            };
            const headers = {
                'Content-Type': contentType,
            };
            const auth = this._makeAuthHeader();
            if (auth) headers['Authorization'] = auth;
            this.controller = new AbortController();
            try {
                const resp = await fetch(this.server, {
                    method: 'POST',
                    headers,
                    body,
                    signal: this.controller.signal,
                });
                const text = await resp.text();
                try {
                    await this.callback(text);
                } catch (e) { };
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    await this.err('ended');
                } else {
                    await this.err(err);
                };
            };
        };

        stop() {
            if (this.controller) {
                try {
                    this.controller.abort();
                } catch (e) { };
            };
        };
    };
};

export default HTTPSockBroadcast;
