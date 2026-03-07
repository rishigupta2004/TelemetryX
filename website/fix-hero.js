const fs = require('fs');
let content = fs.readFileSync('src/components/sections/Hero.tsx', 'utf8');

// Ensure Link is imported
if (!content.includes('import Link from "next/link";')) {
  content = content.replace('import { useEffect, useState } from "react";', 'import { useEffect, useState } from "react";\nimport Link from "next/link";');
}

// Fix buttons block
content = content.replace(
  /<div className="flex flex-col sm:flex-row gap-4 font-mono">[\s\S]*?<\/div>/,
  `<div className="flex flex-col sm:flex-row gap-4 font-mono">
            <Link href="/download" className="w-full sm:w-auto">
              <Button size="lg" className="w-full px-8 panel-border bg-white text-black hover:bg-zinc-200 uppercase tracking-widest font-bold text-xs h-12">
                <Download className="mr-2 w-4 h-4" /> macOS .dmg
              </Button>
            </Link>
            <Link href="/download" className="w-full sm:w-auto">
              <Button size="lg" variant="terminal" className="w-full px-8 h-12">
                <Terminal className="mr-2 w-4 h-4" /> Windows .exe
              </Button>
            </Link>
          </div>`
);

fs.writeFileSync('src/components/sections/Hero.tsx', content);
