
const https = require('https');
const fs = require('fs');
const path = require('path');
const { IncomingForm } = require('formidable');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; 
const RATE_LIMIT_MAX_REQUESTS = 10;

const MAX_FILE_SIZE = 10 * 1024 * 1024; 
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_PDF_TYPE = 'application/pdf';

const FILE_SIGNATURES = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'image/webp': [0x52, 0x49, 0x46, 0x46], 
    'application/pdf': [0x25, 0x50, 0x44, 0x46] 
};

function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = rateLimiter.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    
    if (now > userRequests.resetTime) {
        userRequests.count = 0;
        userRequests.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    if (userRequests.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }
    
    userRequests.count++;
    rateLimiter.set(ip, userRequests);
    return true;
}

function validateFileType(buffer, declaredMimeType) {
    const signature = FILE_SIGNATURES[declaredMimeType];
    if (!signature) {
        return false;
    }
    
    for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
            return false;
        }
    }
    
    return true;
}

function setCorsHeaders(req, res) {
    const allowedOrigins = [
        'http://localhost:5000',
        'https://localhost:5000'
    ];
    
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        allowedOrigins.push(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    }
    
    if (process.env.REPLIT_DEV_DOMAIN) {
        allowedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache');
}

function handleTextExtraction(req, res) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIP)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Rate limit exceeded. Maximum 10 requests per minute.',
            retryAfter: 60
        }));
        return;
    }

    const form = new IncomingForm({
        maxFileSize: MAX_FILE_SIZE,
        maxFields: 1,
        maxFiles: 1,
        allowEmptyFiles: false,
        keepExtensions: false
    });

    form.parse(req, async (err, fields, files) => {
        try {
            if (err) {
                console.error('Formidable parse error:', err);
                let errorMessage = 'File upload error';
                
                if (err.code === 'LIMIT_FILE_SIZE') {
                    errorMessage = `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
                } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    errorMessage = 'Only one file allowed';
                }
                
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: errorMessage }));
                return;
            }

            const fileKey = Object.keys(files)[0];
            if (!fileKey || !files[fileKey]) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No file uploaded' }));
                return;
            }

            const file = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
            
            const fileBuffer = fs.readFileSync(file.filepath);
            
            fs.unlinkSync(file.filepath);

            const declaredMimeType = file.mimetype;
            const supportedTypes = [...SUPPORTED_IMAGE_TYPES, SUPPORTED_PDF_TYPE];
            
            if (!supportedTypes.includes(declaredMimeType)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Unsupported file type. Please upload JPG, PNG, GIF, WebP, or PDF files.' 
                }));
                return;
            }

            if (!validateFileType(fileBuffer, declaredMimeType)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'File type mismatch. The file content does not match the declared file type.' 
                }));
                return;
            }

            let result;
            if (declaredMimeType === SUPPORTED_PDF_TYPE) {
                result = await extractTextFromPDF(fileBuffer);
            } else {
                result = await extractTextWithDeepSeek({
                    data: fileBuffer,
                    contentType: declaredMimeType,
                    filename: file.originalFilename || 'unknown'
                });
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            
        } catch (error) {
            console.error('Text extraction error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Internal server error during text extraction',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again'
            }));
        }
    });
}

async function extractTextFromPDF(buffer) {
    try {
        const data = await pdfParse(buffer);
        const extractedText = data.text;
        const names = extractNamesFromText(extractedText);
        
        return {
            success: true,
            extractedText: extractedText,
            names: names,
            count: names.length,
            source: 'pdf-parser'
        };
    } catch (error) {
        throw new Error('Failed to extract text from PDF: ' + error.message);
    }
}

async function extractTextWithDeepSeek(fileData) {
    return new Promise(async (resolve, reject) => {
        if (fileData.contentType.startsWith('image/')) {
            try {
                const extractedText = await performBasicOCR(fileData);
                const names = extractNamesFromText(extractedText);
                resolve({
                    success: true,
                    extractedText: extractedText,
                    names: names,
                    count: names.length,
                    source: 'basic-ocr'
                });
            } catch (error) {
                reject(new Error(`Image processing failed: ${error.message}. Note: DeepSeek API doesn't support image vision. Try converting your image to PDF or use manual input.`));
            }
            return;
        }

        if (fileData.extractedText) {
            const names = extractNamesFromText(fileData.extractedText);
            resolve({
                success: true,
                extractedText: fileData.extractedText,
                names: names,
                count: names.length,
                source: 'pdf-parser'
            });
            return;
        }

        reject(new Error('Unsupported file type or no text content found'));
    });
}

let ocrSemaphore = 0;
const MAX_CONCURRENT_OCR = 2;

async function performBasicOCR(fileData) {
    return new Promise(async (resolve, reject) => {
        if (ocrSemaphore >= MAX_CONCURRENT_OCR) {
            reject(new Error('OCR service is busy. Please try again in a moment.'));
            return;
        }

        ocrSemaphore++;
        const timeout = setTimeout(() => {
            ocrSemaphore--;
            reject(new Error('OCR processing timed out. Please try with a smaller or clearer image.'));
        }, 60000); 

        try {
            console.log('Starting OCR processing...');
            
            const { data: { text } } = await Tesseract.recognize(
                fileData.data,
                'eng',
                {
                    psm: Tesseract.PSM.SINGLE_BLOCK,
                    preserve_interword_spaces: '1',
                    tessjs_create_hocr: '0',
                    tessjs_create_tsv: '0',
                    tessjs_create_box: '0',
                    tessjs_create_unlv: '0',
                    tessjs_create_osd: '0'
                }
            );

            clearTimeout(timeout);
            ocrSemaphore--;
            
            console.log('OCR processing completed, extracted text length:', text?.length || 0);
            
            if (!text || text.trim().length === 0) {
                reject(new Error('No text could be extracted from the image. Please ensure the image is clear and contains readable text.'));
                return;
            }

            resolve(text.trim());
            
        } catch (error) {
            clearTimeout(timeout);
            ocrSemaphore--;
            console.error('OCR processing error:', error);
            reject(new Error(`Failed to extract text from image: ${error.message}. Please try with a clearer image or convert to PDF.`));
        }
    });
}

function extractNamesFromText(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const lines = text.split(/[\n\r]+/);
    const potentialNames = [];

    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (!trimmedLine || trimmedLine.length < 2) return;
        
        if (/\d|@|www\.|http|\.com|[#$%^&*+=<>{}[\]\\|`~]/.test(trimmedLine)) return;
        
        const words = trimmedLine.split(/\s+/);
        
        if (words.length >= 1 && words.length <= 4) {
            const looksLikeName = words.every(word => {
                return /^[A-Z][a-z]+$/.test(word) ||
                       /^[A-Z][a-z]*[-'][A-Z][a-z]*$/.test(word) ||
                       /^[A-Z]\.?$/.test(word) || // Initials
                       /^(Jr|Sr|II|III|IV)\.?$/i.test(word); // Name suffixes
            });
            
            if (words.length === 1) {
                const word = words[0];
                if (word.length >= 2 && word.length <= 20 && /^[A-Z][a-z]+$/.test(word) && 
                    !/(page|line|date|time|chapter|section|note|item|list|part|vol|no|ref)$/i.test(word)) {
                    potentialNames.push(word);
                }
            } else if (looksLikeName) {
                potentialNames.push(words.join(' '));
            }
        }
        
        if (trimmedLine.includes(',') && !trimmedLine.includes('.') && words.length <= 4) {
            const commaParts = trimmedLine.split(',').map(part => part.trim());
            if (commaParts.length === 2) {
                const [last, first] = commaParts;
                const lastWords = last.trim().split(/\s+/);
                const firstWords = first.trim().split(/\s+/);
                
                const lastLooksLikeName = lastWords.every(word => /^[A-Z][a-z]+$/.test(word));
                const firstLooksLikeName = firstWords.every(word => 
                    /^[A-Z][a-z]+$/.test(word) || /^[A-Z]\.?$/.test(word)
                );
                
                if (lastLooksLikeName && firstLooksLikeName && 
                    lastWords.length <= 2 && firstWords.length <= 3) {
                    potentialNames.push(`${first.trim()} ${last.trim()}`);
                }
            }
        }
    });

    const uniqueNames = [...new Set(potentialNames)];
    
    const filteredNames = uniqueNames.filter(name => {
        const words = name.split(/\s+/);
        return words.length >= 1 && 
               words.length <= 4 && 
               name.length <= 50 &&
               !/\b(and|or|the|in|on|at|for|with|by|page|line|date|time|total|sum|count)\b/i.test(name) &&
               name.trim().length > 1;
    });
    
    return filteredNames.slice(0, 50);
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimiter.entries()) {
        if (now > data.resetTime) {
            rateLimiter.delete(ip);
        }
    }
}, 5 * 60 * 1000);

module.exports = { handleTextExtraction };