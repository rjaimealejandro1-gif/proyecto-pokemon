const fs = require('fs');

const transcriptLines = fs.readFileSync('C:/Users/Jaime/.gemini/antigravity/brain/9ad94d33-bead-4b5d-98b8-41009f8bc8dc/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n').filter(Boolean);

let count = 0;
for (let line of transcriptLines) {
    try {
        let obj = JSON.parse(line);
        if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.name === 'multi_replace_file_content') {
                    let args = tc.args;
                    let tf = args.TargetFile;
                    if(typeof tf === 'string' && tf.startsWith('"')) tf = JSON.parse(tf);
                    
                    if (tf.includes('dashboard.component.ts') || tf.includes('deck.component.ts')) {
                        console.log('TargetFile:', tf);
                        let chunks = args.ReplacementChunks;
                        if(typeof chunks === 'string' && chunks.startsWith('"')) chunks = JSON.parse(chunks);
                        if(typeof chunks === 'string') chunks = JSON.parse(chunks);
                        
                        console.log('Chunks Type:', typeof chunks);
                        console.log('Is Array?', Array.isArray(chunks));
                        if(Array.isArray(chunks) && chunks.length > 0) {
                            console.log('First chunk has ReplacementContent?', !!chunks[0].ReplacementContent);
                            count++;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error at a line", e.message);
    }
}
console.log('Total matches:', count);
