// Simple Node.js API endpoint for fact-checking
const https = require('https');
const url = require('url');

function handleFactCheck(req, res) {
    // Set CORS headers
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
            const { content } = JSON.parse(body);
            
            if (!content || content.trim().length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Content is required' }));
                return;
            }

            const result = await factCheckWithOpenAI(content);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            
        } catch (error) {
            console.error('Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    });
}

async function factCheckWithOpenAI(content) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        
        // Check if API key looks valid (should start with sk- and be reasonable length)
        if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 20) {
            // Provide a demo response for now
            console.log('Using demo response due to invalid API key');
            
            // Enhanced fact-checking logic for demo with more scenarios
            const lowerContent = content.toLowerCase();
            let response;
            
            if (lowerContent.includes('earth') && lowerContent.includes('flat')) {
                response = {
                    label: '❌ False',
                    labelClass: 'false',
                    explanation: 'The Earth is not flat. Scientific evidence from multiple fields including astronomy, physics, and satellite imagery conclusively shows that Earth is an oblate spheroid (roughly spherical).',
                    correctedVersion: 'The Earth is an oblate spheroid, slightly flattened at the poles and bulging at the equator due to its rotation.'
                };
            } else if (lowerContent.includes('vaccine') && (lowerContent.includes('autism') || lowerContent.includes('cause'))) {
                response = {
                    label: '❌ False',
                    labelClass: 'false',
                    explanation: 'Multiple large-scale scientific studies have found no link between vaccines and autism. The original study suggesting this connection was retracted due to serious methodological flaws and ethical violations.',
                    correctedVersion: 'Vaccines do not cause autism. This has been confirmed by numerous peer-reviewed studies involving millions of children.'
                };
            } else if (lowerContent.includes('climate change') && lowerContent.includes('hoax')) {
                response = {
                    label: '❌ False',
                    labelClass: 'false',
                    explanation: 'Climate change is not a hoax. It is a well-documented phenomenon supported by overwhelming scientific consensus and evidence from multiple independent research institutions worldwide.',
                    correctedVersion: 'Climate change is real and primarily caused by human activities, particularly the emission of greenhouse gases from burning fossil fuels.'
                };
            } else if (lowerContent.includes('water') && lowerContent.includes('boil') && lowerContent.includes('100')) {
                response = {
                    label: '✅ True',
                    labelClass: 'true',
                    explanation: 'Water does indeed boil at 100°C (212°F) at standard atmospheric pressure (1 atmosphere or 101.3 kPa). This is a well-established scientific fact.',
                    correctedVersion: ''
                };
            } else if (lowerContent.includes('sun') && (lowerContent.includes('center') || lowerContent.includes('revolve'))) {
                response = {
                    label: '✅ True',
                    labelClass: 'true',
                    explanation: 'The Earth and other planets in our solar system do revolve around the Sun. This heliocentric model has been scientifically proven and is fundamental to modern astronomy.',
                    correctedVersion: ''
                };
            } else if (lowerContent.includes('gravity') && lowerContent.includes('theory')) {
                response = {
                    label: '⚠️ Misleading',
                    labelClass: 'misleading',
                    explanation: 'While gravity is called a "theory" in scientific terms, this doesn\'t mean it\'s just a guess. In science, a theory is a well-substantiated explanation supported by extensive evidence.',
                    correctedVersion: 'Gravity is both a scientific law (describing what happens) and a theory (explaining how and why it happens). It is one of the most well-tested concepts in physics.'
                };
            } else if (lowerContent.includes('human') && lowerContent.includes('brain') && lowerContent.includes('10')) {
                response = {
                    label: '❌ False',
                    labelClass: 'false',
                    explanation: 'Humans use virtually 100% of their brain, not just 10%. Brain imaging shows that even simple tasks involve multiple brain areas, and damage to almost any area has noticeable effects.',
                    correctedVersion: 'Humans use essentially their entire brain. Even during sleep, brain activity only decreases by about 20%.'
                };
            } else if (lowerContent.includes('goldfish') && lowerContent.includes('memory') && lowerContent.includes('second')) {
                response = {
                    label: '❌ False',
                    labelClass: 'false',
                    explanation: 'Goldfish have much longer memories than 3 seconds. Studies show they can remember things for weeks or even months, and can be trained to respond to different stimuli.',
                    correctedVersion: 'Goldfish can remember things for weeks to months and are capable of learning and recognition.'
                };
            } else {
            
                const hasSpecificClaims = lowerContent.includes('study') || lowerContent.includes('research') || 
                                        lowerContent.includes('scientist') || lowerContent.includes('prove') ||
                                        lowerContent.includes('fact') || lowerContent.includes('truth');
                
                if (hasSpecificClaims) {
                    response = {
                        label: '⏳ Needs Verification',
                        labelClass: 'unverified',
                        explanation: 'This claim contains specific assertions that require verification from reliable sources. Please consult peer-reviewed research, official reports, or authoritative sources to verify this information.',
                        correctedVersion: ''
                    };
                } else {
                    response = {
                        label: '🧠 Opinion/Subjective',
                        labelClass: 'opinion',
                        explanation: 'This appears to be an opinion or subjective statement rather than a factual claim that can be verified. Personal opinions and preferences are not typically subject to fact-checking.',
                        correctedVersion: ''
                    };
                }
            }
            
            resolve(response);
            return;
        }

        const prompt = `You are an AI fact checker. Analyze the following content and provide a fact-check response in JSON format.

Content to fact-check: "${content}"

Please respond with a JSON object containing:
1. "truthLabel" - one of: "True", "False", "Misleading", "Unverified", "Outdated", "Opinion"
2. "explanation" - detailed explanation of your assessment (2-3 sentences)
3. "correctedVersion" - if the content is false or misleading, provide a corrected version (otherwise empty string)

Example response format:
{
  "truthLabel": "Misleading",
  "explanation": "While this statement contains some factual elements, it misrepresents the context and omits important details that significantly change the meaning.",
  "correctedVersion": "The actual facts are..."
}`;

        const requestBody = JSON.stringify({
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful fact-checking assistant. Always respond with valid JSON format."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.3
        });

        const options = {
            hostname: 'api.deepseek.com',
            port: 443,
            path: '/v1/chat/completions',
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
                    
                    const aiResponse = response.choices[0].message.content;
                    const parsed = JSON.parse(aiResponse);
                    
                    // Map truth labels to CSS classes and emojis
                    const labelMap = {
                        'True': { emoji: '✅', class: 'true' },
                        'False': { emoji: '❌', class: 'false' },
                        'Misleading': { emoji: '⚠️', class: 'misleading' },
                        'Unverified': { emoji: '⏳', class: 'unverified' },
                        'Outdated': { emoji: '🕓', class: 'outdated' },
                        'Opinion': { emoji: '🧠', class: 'opinion' }
                    };
                    
                    const mapping = labelMap[parsed.truthLabel] || { emoji: '❓', class: 'unverified' };
                    
                    resolve({
                        label: `${mapping.emoji} ${parsed.truthLabel}`,
                        labelClass: mapping.class,
                        explanation: parsed.explanation,
                        correctedVersion: parsed.correctedVersion || ''
                    });
                    
                } catch (parseError) {
                    reject(new Error('Failed to parse AI response'));
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

module.exports = { handleFactCheck };