const fs = require('fs');

const transcriptLines = fs.readFileSync('C:/Users/Jaime/.gemini/antigravity/brain/9ad94d33-bead-4b5d-98b8-41009f8bc8dc/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n').filter(Boolean);

for (let line of transcriptLines) {
    try {
        let obj = JSON.parse(line);
        if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
                    let args = tc.args;
                    let targetFileStr = args.TargetFile;
                    if (typeof targetFileStr === 'string' && targetFileStr.startsWith('"')) {
                        targetFileStr = JSON.parse(targetFileStr);
                    }
                    console.log('Parsed TargetFile:', targetFileStr);
                }
            }
        }
    } catch (e) {}
}
