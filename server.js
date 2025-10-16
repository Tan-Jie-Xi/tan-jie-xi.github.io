const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { handleFactCheck } = require('./api/fact-check');
const { handleQuestionGeneration } = require('./api/question-generator');
const { handleAnswerEvaluation } = require('./api/answer-evaluation');
const { handleTextExtraction } = require('./api/text-extraction');

const PORT = process.env.PORT || 5000;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function serveStaticFile(req, res, filePath) {
    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });
            res.end(content, 'utf-8');
        }
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Handle API endpoints
    if (pathname === '/api/fact-check') {
        handleFactCheck(req, res);
        return;
    }

    if (pathname === '/api/generate-question') {
        handleQuestionGeneration(req, res);
        return;
    }

    if (pathname === '/api/evaluate-answer') {
        handleAnswerEvaluation(req, res);
        return;
    }

    if (pathname === '/api/extract-text') {
        handleTextExtraction(req, res);
        return;
    }

    // Handle static files
    if (pathname === '/') {
        pathname = '/index.html';
    }

    const filePath = path.join(__dirname, pathname);
    serveStaticFile(req, res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
    // Add migration API routes
    try {
      const { addMigrationRoutes } = require('./migration-api.js');
      addMigrationRoutes(server);
      console.log('✅ Migration API endpoints available');
    } catch (error) {
      console.log('⚠️  Migration API not loaded (optional):', error.message);
    }
    
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});