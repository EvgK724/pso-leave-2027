import {prepareRulesUpdate} from '../shared/rules-update.js';

// Read an authorized state snapshot from stdin; keep the generated payload
// outside the repository. Apply with the existing optimistic commit RPC.
let input='';
for await(const chunk of process.stdin)input+=chunk;
process.stdout.write(JSON.stringify(prepareRulesUpdate(JSON.parse(input))));
