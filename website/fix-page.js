const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// Insert CodeShowcase import and component
if (!content.includes('import { CodeShowcase }')) {
  content = content.replace(
    'import { Footer } from "@/components/sections/Footer";',
    'import { Footer } from "@/components/sections/Footer";\nimport { CodeShowcase } from "@/components/sections/CodeShowcase";'
  );
  
  content = content.replace(
    '<PerformanceSection />',
    '<CodeShowcase />\n      <PerformanceSection />'
  );
  
  fs.writeFileSync('src/app/page.tsx', content);
}

