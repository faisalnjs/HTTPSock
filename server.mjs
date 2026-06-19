const isNode = (typeof process !== 'undefined') && process.versions && process.versions.node;
var HTTPSockServer;
if (isNode) {
    (async () => {
        const mod = await import('./server.js');
        HTTPSockServer = mod && (mod.default || mod);
    })();
} else {
    HTTPSockServer = function HTTPSockServerBrowserStub() {
        console.warn('httpsock/server: running in a browser environment. Server Router is Node-only.');
        return {};
    };
};
export default HTTPSockServer;
