const fs = require('fs');

let content = fs.readFileSync('src/components/sections/PerformanceSection.tsx', 'utf8');

// Fix 1: Date hydration mismatch by fixing client-side only rendering
content = content.replace(
  'const time = new Date(Date.now() - (40-i)*150).toISOString().slice(11, 23);',
  'const time = isMounted ? new Date(Date.now() - (40-i)*150).toISOString().slice(11, 23) : "00:00:00.000";'
);

// Add isMounted state
content = content.replace(
  'const [memory, setMemory] = useState("24.4");',
  'const [memory, setMemory] = useState("24.4");\n  const [isMounted, setIsMounted] = useState(false);\n  useEffect(() => setIsMounted(true), []);'
);

fs.writeFileSync('src/components/sections/PerformanceSection.tsx', content);
