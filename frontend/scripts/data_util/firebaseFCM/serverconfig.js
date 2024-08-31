
// CONTENT SERVER
export const defaultServer = {
    debug: false,
    protocol: 'https', // 'http' or 'https'
    //domain: 'alyce.app', //for serving later
    host: 'localhost',
    port: 8080,
    startpage: 'index.html',
    certpath: 'server.crt',
    keypath: 'server.key'
};

// DATA SERVER
export const dataServerConfig = {
    port: 3000,
    socket_protocol: 'wss',
    socketport: 3001,
    headers:{
        'Access-Control-Allow-Origin': '*', // Allow all origins
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Allow these methods
        'Access-Control-Allow-Headers': 'Content-Type, userid, authorization' // Allow these headers    
    }
};

export const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.xhtml': 'application/xhtml+xml',
    '.bmp': 'image/bmp',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.xml': 'application/xml',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.weba': 'audio/webm',
    '.woff': 'font/woff',
    'woff2': 'font/woff2',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
    '.zip': 'application/zip',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.tif': 'image/tiff',
    '.sh': 'application/x-sh',
    '.csh': 'application/x-csh',
    '.rar': 'application/vnd.rar',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
    '.mpeg': 'video/mpeg',
    '.mjs': 'text/javascript',
    '.cjs': 'text/javascript',
    '.jsonld': 'application/ld+json',
    '.jar': 'application/java-archive',
    '.ico': 'image/vnd.microsoft.icon',
    '.gz': 'application/gzip',
    'epub': 'application/epub+zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.csv': 'text/csv',
    '.avi': 'video/x-msvideo',
    '.aac': 'audio/aac',
    '.mpkg': 'application/vnd.apple.installer+xml',
    '.oga': 'audio/ogg',
    '.ogv': 'video/ogg',
    'ogx': 'application/ogg',
    '.php': 'application/x-httpd-php',
    '.rtf': 'application/rtf',
    '.swf': 'application/x-shockwave-flash',
    '.7z': 'application/x-7z-compressed',
    '.3gp': 'video/3gpp'
};
