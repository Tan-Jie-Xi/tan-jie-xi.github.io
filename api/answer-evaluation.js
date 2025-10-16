
const https = require('https');

function handleAnswerEvaluation(req, res) {
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
            const { userAnswer, correctAnswer, questionText } = JSON.parse(body);
            
            if (!userAnswer || !correctAnswer || !questionText) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'userAnswer, correctAnswer, and questionText are required' }));
                return;
            }

            const result = await evaluateAnswerWithAPI(userAnswer, correctAnswer, questionText);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            
        } catch (error) {
            console.error('Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error', demo: true }));
        }
    });
}

async function evaluateAnswerWithAPI(userAnswer, correctAnswer, questionText) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        
        if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 20) {
            console.log('Using demo response for answer evaluation due to invalid API key');

            const isCorrect = userAnswer.toLowerCase().includes(correctAnswer.toLowerCase()) ||
                             correctAnswer.toLowerCase().includes(userAnswer.toLowerCase());
            resolve({ demo: true, isCorrect: isCorrect, explanation: 'Demo evaluation based on text matching' });
            return;
        }

        const prompt = `You are an educational assessment AI. Evaluate if the student's answer is correct based on the question and expected answer.

Question: "${questionText}"
Expected Answer: "${correctAnswer}"
Student Answer: "${userAnswer}"

Evaluate if the student's answer demonstrates understanding of the concept and follows the same logic/idea as the expected answer, even if worded differently. Consider:
- Conceptual understanding
- Key facts or ideas present
- Logical reasoning
- Alternative valid explanations

Respond with only "CORRECT" or "INCORRECT" followed by a brief explanation.

Format: [CORRECT/INCORRECT]: [brief explanation]`;

        const requestBody = JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: 0.3
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
                    
                    const evaluation = response.choices[0].message.content;
                    const isCorrect = evaluation.toLowerCase().startsWith('correct');
                    
                    resolve({ 
                        demo: false, 
                        isCorrect: isCorrect, 
                        explanation: evaluation 
                    });
                    
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

module.exports = { handleAnswerEvaluation };