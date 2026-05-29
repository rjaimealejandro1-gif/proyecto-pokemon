const fs = require('fs');

const transcriptLines = fs.readFileSync('C:/Users/Jaime/.gemini/antigravity/brain/9ad94d33-bead-4b5d-98b8-41009f8bc8dc/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n').filter(Boolean);

let files = {
    'c:/Users/Jaime/Downloads/mi_proyecto3p/src/app/features/dashboard/dashboard.component.ts': fs.readFileSync('c:/Users/Jaime/Downloads/mi_proyecto3p/src/app/features/dashboard/dashboard.component.ts', 'utf-8'),
    'c:/Users/Jaime/Downloads/mi_proyecto3p/src/app/features/deck/deck.component.ts': fs.readFileSync('c:/Users/Jaime/Downloads/mi_proyecto3p/src/app/features/deck/deck.component.ts', 'utf-8')
};

let toolCallsToUndo = [];

for (let i = transcriptLines.length - 1; i >= 0; i--) {
    try {
        let obj = JSON.parse(transcriptLines[i]);
        if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
            for (let tc of obj.tool_calls) {
                if (tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
                    let args = tc.args;
                    let tf = args.TargetFile;
                    if (typeof tf === 'string' && tf.startsWith('"')) {
                        try { tf = JSON.parse(tf); } catch(e){}
                    }
                    if (!tf) continue;
                    
                    let tfNorm = tf.replace(/\\/g, '/').toLowerCase();
                    if (tfNorm === 'c:/users/jaime/downloads/mi_proyecto3p/src/app/features/dashboard/dashboard.component.ts' ||
                        tfNorm === 'c:/users/jaime/downloads/mi_proyecto3p/src/app/features/deck/deck.component.ts') {
                        
                        args.TargetFile = tf.replace(/\\/g, '/');
                        let chunks = args.ReplacementChunks;
                        if (typeof chunks === 'string') {
                            if (chunks.startsWith('"')) {
                                try { chunks = JSON.parse(chunks); } catch(e){}
                            }
                            if (typeof chunks === 'string') {
                                try {
                                    chunks = JSON.parse(chunks.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'));
                                } catch(e){
                                    console.log("Still failed to parse chunks", e.message);
                                }
                            }
                        }
                        args.ReplacementChunks = chunks;
                        toolCallsToUndo.push(args);
                    }
                }
            }
        }
    } catch (e) {}
}

console.log("Found " + toolCallsToUndo.length + " tool calls to undo.");

for (let args of toolCallsToUndo) {
    let content = files[args.TargetFile] || files[args.TargetFile.toLowerCase()];
    if (!content) {
        // try finding case-insensitive
        let key = Object.keys(files).find(k => k.toLowerCase() === args.TargetFile.toLowerCase());
        if(key) {
            args.TargetFile = key;
            content = files[key];
        }
    }
    
    if (args.ReplacementChunks && Array.isArray(args.ReplacementChunks)) {
        for (let chunk of args.ReplacementChunks) {
            let rc = chunk.ReplacementContent;
            let tc = chunk.TargetContent;
            if (typeof rc === 'string' && rc.startsWith('"') && rc.endsWith('"')) {
                 try { rc = JSON.parse(rc); } catch(e){}
            }
            if (typeof tc === 'string' && tc.startsWith('"') && tc.endsWith('"')) {
                 try { tc = JSON.parse(tc); } catch(e){}
            }
            
            // Clean up backslash escapes if any were mistakenly preserved
            rc = rc.replace(/\\n/g, '\n');
            tc = tc.replace(/\\n/g, '\n');

            if (content.includes(rc)) {
                content = content.replace(rc, tc);
                console.log("Replaced chunk in", args.TargetFile);
            } else {
                console.log("Could not find ReplacementContent in", args.TargetFile);
                // Print a small snippet to see why it fails
                console.log("Looking for:", rc.substring(0, 50).replace(/\n/g, '\\n'));
            }
        }
    }
    files[args.TargetFile] = content;
}

for (let file in files) {
    fs.writeFileSync(file, files[file]);
    console.log("Saved reverted file: " + file);
}
