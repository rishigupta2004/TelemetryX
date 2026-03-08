const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// Swap out old AppMockup for new full-width AppPreview
content = content.replace(
  'import { AppMockup } from "@/components/ui/AppMockup";',
  'import { AppPreview } from "@/components/sections/AppPreview";'
);

content = content.replace(
  /<motion\.div \n\s*initial={{ opacity: 0, y: 100 }}\n\s*animate={{ opacity: 1, y: 0 }}\n\s*transition={{ duration: 1, delay: 0\.5 }}\n\s*className="w-full relative z-20 mt-12 px-6"\n\s*>\n\s*<AppMockup \/>\n\s*<\/motion\.div>/,
  ''
);

// Add AppPreview between Hero and FeatureGrid
content = content.replace(
  '<FeatureGrid />',
  '<AppPreview />\n      <FeatureGrid />'
);

fs.writeFileSync('src/app/page.tsx', content);
