import fixtures from './fixtures.js';
import {replicateFixtures} from './peartrace.js';
console.log(JSON.stringify(await replicateFixtures(fixtures),null,2));
