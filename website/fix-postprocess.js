const fs = require('fs');

const files = ['src/components/three/DataSphere.tsx', 'src/components/three/ParticleTrack.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('<EffectComposer disableNormalPass>', '<EffectComposer>');
  fs.writeFileSync(file, content);
});
