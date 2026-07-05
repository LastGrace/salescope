const fs = require('fs');
let app = fs.readFileSync('client/src/App.jsx', 'utf8');
app = app.replace(/const (\w+) = lazy\(\(\) => import\('([^']+)'\)\);/g, 'import $1 from \'\';');
app = app.replace(/<Suspense fallback=\{<SuspenseFallback \/>\}>\s*(<Routes>[\s\S]*?<\/Routes>)\s*<\/Suspense>/, '$1');
app = app.replace(/import React, \{ Suspense, lazy \} from 'react';/, 'import React from \'react\';');
fs.writeFileSync('client/src/App.jsx', app);
console.log('Fixed imports in App.jsx');
