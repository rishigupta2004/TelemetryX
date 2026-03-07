const fs = require('fs');
let content = fs.readFileSync('src/components/three/DataCubes.tsx', 'utf8');

content = content.replace(
  '<instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} castShadow receiveShadow>',
  '<instancedMesh ref={meshRef} args={[null as any, null as any, COUNT]} castShadow receiveShadow>'
);

fs.writeFileSync('src/components/three/DataCubes.tsx', content);
