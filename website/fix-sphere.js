const fs = require('fs');
let content = fs.readFileSync('src/components/three/DataSphere.tsx', 'utf8');

content = content.replace(
  '<bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />',
  '<bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} args={[positions, 3]} />'
).replace(
  '<bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />',
  '<bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} args={[colors, 3]} />'
);

fs.writeFileSync('src/components/three/DataSphere.tsx', content);
