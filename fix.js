const fs = require('fs');
let app = fs.readFileSync('client/src/App.jsx', 'utf8');

// Replace lazy imports with static imports
app = app.replace(/const (\w+) = lazy\(\(\) => import\('([^']+)'\)\);/g, "import $1 from '$2';");

// Remove Suspense wrappers
app = app.replace(/<Suspense fallback=\{<SuspenseFallback \/>\}>\s*(<Routes>[\s\S]*?<\/Routes>)\s*<\/Suspense>/, "$1");

// Fix React import
app = app.replace(/import React, \{ Suspense, lazy \} from 'react';/, "import React from 'react';");

fs.writeFileSync('client/src/App.jsx', app);
console.log('App.jsx fixed successfully.');
