import {prepareLeonardUpdate} from '../shared/leonard-update.js';

// Authorized state snapshots and generated payloads stay outside the repository.
// Apply the result using the existing optimistic commit RPC.
let input='';
for await(const chunk of process.stdin)input+=chunk;
process.stdout.write(JSON.stringify(prepareLeonardUpdate(JSON.parse(input))));
