
const https = require('https');

function handleQuestionGeneration(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache');

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

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { prompt, questionType } = JSON.parse(body);
            
            if (!prompt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Prompt is required' }));
                return;
            }

            const result = await generateQuestionWithAPI(prompt);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            
        } catch (error) {
            console.error('Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error', demo: true }));
        }
    });
}

async function generateQuestionWithAPI(prompt) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        
        if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 20) {
            console.log('Using demo response for question generation due to invalid API key');
            resolve({ demo: true, content: null });
            return;
        }

        const requestBody = JSON.stringify({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are a helpful assistant that generates educational questions. You must respond with ONLY valid JSON format. Do not include any text before or after the JSON. Do not use markdown formatting or code blocks." },
                { role: "user", content: prompt + "\n\nIMPORTANT: Respond with ONLY the JSON object, no additional text or formatting." }
            ],
            max_tokens: 500,
            temperature: 0.5,
            stream: false
        });

        const options = {
            hostname: 'api.deepseek.com',
            port: 443,
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (apiRes) => {
            let data = '';
            
            apiRes.on('data', (chunk) => {
                data += chunk;
            });
            
            apiRes.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.error) {
                        reject(new Error(response.error.message));
                        return;
                    }
                    
                    const content = response.choices[0].message.content;
                    
                    try {
                        let cleanContent = content.trim();
                        
                        if (cleanContent.startsWith('```json')) {
                            cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                        } else if (cleanContent.startsWith('```')) {
                            cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
                        }
                        
                        const parsedContent = JSON.parse(cleanContent);
                        resolve({ demo: false, content: JSON.stringify(parsedContent) });
                    } catch (jsonParseError) {
                        console.warn('AI response is not valid JSON, falling back to demo mode. Content:', content);
                        resolve({ demo: true, content: null });
                    }
                    
                } catch (parseError) {
                    reject(new Error('Failed to parse API response'));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(requestBody);
        req.end();
    });
}

module.exports = { handleQuestionGeneration };