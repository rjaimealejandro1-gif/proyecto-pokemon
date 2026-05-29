const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Jaime/.gemini/antigravity/brain/9ad94d33-bead-4b5d-98b8-41009f8bc8dc/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n').filter(Boolean);

let dashOut = '';
let deckOut = '';

for (let line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch (e) { continue; }
    
    // Check tool responses
    if (obj.type === 'TOOL_RESPONSE' && obj.tool_calls) {
        for (let tc of obj.tool_calls) {
            if (tc.response && tc.response.output) {
                const out = tc.response.output;
                if (!dashOut && out.includes('file:///c:/Users/Jaime/Downloads/mi_proyecto3p/src/app/features/dashboard/dashboard.component.ts') && out.includes('The following code has been modified to include a line number')) {
                    dashOut = out;
                }
                if (!deckOut && out.includes('file:///c:/Users/Jaime/Downloads/mi_proyecto3p/src/app/features/deck/deck.component.ts') && out.includes('The following code has been modified to include a line number')) {
                    deckOut = out;
                }
            }
        }
    }
}

function cleanViewFileOutput(raw) {
    if (!raw) return '';
    const lines = raw.split('\n');
    const cleaned = [];
    let parsing = false;
    for (let l of lines) {
        if (l.includes('The following code has been modified')) {
            parsing = true;
            continue;
        }
        if (l.includes('The above content does NOT show the entire file contents') || l.includes('The above content shows the entire, complete file contents')) {
            parsing = false;
            break;
        }
        if (parsing) {
            // Remove the '123: ' prefix
            const match = l.match(/^\d+:\s?(.*)$/);
            if (match) {
                cleaned.push(match[1]);
            }
        }
    }
    return cleaned.join('\n');
}

fs.writeFileSync('dash_backup.ts', cleanViewFileOutput(dashOut));
fs.writeFileSync('deck_backup.ts', cleanViewFileOutput(deckOut));
