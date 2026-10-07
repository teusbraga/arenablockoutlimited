import * as THREE from 'three';

export function buildVSS() {
  const group = new THREE.Group();

  // Materiais
  const matMetal = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.6,
    metalness: 0.8
  });
  
  const matSuppressor = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.7,
    metalness: 0.5
  });

  const matWood = new THREE.MeshStandardMaterial({
    color: 0x3b2818, // Dark wood
    roughness: 0.8,
    metalness: 0.1
  });

  // Receiver
  const receiverGeo = new THREE.BoxGeometry(0.04, 0.05, 0.18);
  const receiver = new THREE.Mesh(receiverGeo, matMetal);
  receiver.position.set(0, 0, 0.0);
  group.add(receiver);

  // Stock (Coronha de madeira vazada característica da VSS)
  const stockGeo = new THREE.BoxGeometry(0.035, 0.08, 0.15);
  const stock = new THREE.Mesh(stockGeo, matWood);
  stock.position.set(0, -0.02, 0.16);
  group.add(stock);

  // Grip (Integrado ao stock)
  const gripGeo = new THREE.BoxGeometry(0.03, 0.08, 0.04);
  const grip = new THREE.Mesh(gripGeo, matWood);
  grip.position.set(0, -0.06, 0.08);
  grip.rotation.x = -0.2;
  group.add(grip);

  // Handguard
  const handguardGeo = new THREE.BoxGeometry(0.04, 0.04, 0.08);
  const handguard = new THREE.Mesh(handguardGeo, matMetal);
  handguard.position.set(0, -0.005, -0.13);
  group.add(handguard);

  // Integrated Suppressor (Barrel)
  const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 16);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, matSuppressor);
  barrel.position.set(0, 0.005, -0.34);
  group.add(barrel);

  // Magazine (Curved/angled for 9x39mm)
  const magGeo = new THREE.BoxGeometry(0.03, 0.08, 0.05);
  const mag = new THREE.Mesh(magGeo, matMetal);
  mag.position.set(0, -0.06, -0.04);
  mag.rotation.x = 0.1;
  group.add(mag);

  // PSO-1 Scope
  const opticGroup = new THREE.Group();
  opticGroup.position.set(-0.015, 0.05, -0.02); // Montado levemente à esquerda e acima
  group.add(opticGroup);

  // Mount
  const mountGeo = new THREE.BoxGeometry(0.02, 0.04, 0.08);
  const mount = new THREE.Mesh(mountGeo, matMetal);
  mount.position.set(0.01, -0.02, 0);
  opticGroup.add(mount);

  // Scope Tube
  const tubeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 16);
  tubeGeo.rotateX(Math.PI / 2);
  const tube = new THREE.Mesh(tubeGeo, matMetal);
  opticGroup.add(tube);

  // Front Bell (Objective)
  const bellGeo = new THREE.CylinderGeometry(0.022, 0.015, 0.05, 16);
  bellGeo.rotateX(Math.PI / 2);
  const bell = new THREE.Mesh(bellGeo, matMetal);
  bell.position.set(0, 0, -0.135);
  opticGroup.add(bell);

  // Rear Bell (Ocular)
  const ocularGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.04, 16);
  ocularGeo.rotateX(Math.PI / 2);
  const ocular = new THREE.Mesh(ocularGeo, matMetal);
  ocular.position.set(0, 0, 0.13);
  opticGroup.add(ocular);

  // Lenses for Render Target
  const lensGeo = new THREE.CircleGeometry(0.017, 32);
  
  // Rear Lens (Onde a imagem da câmera e o shader do retículo serão projetados)
  const rearLensMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Placeholder
  const rearLens = new THREE.Mesh(lensGeo, rearLensMat);
  rearLens.position.set(0, 0, 0.151); // Fim do ocular
  // Circle geometry padrão olha para +Z, o olho do jogador está em +Z olhando para -Z.
  // Então o rearLens deve olhar para trás (para o jogador). Está correto por padrão.
  opticGroup.add(rearLens);

  // Front Lens (Apenas para referencial direcional)
  const frontLensGeo = new THREE.CircleGeometry(0.021, 16);
  const frontLensMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.9 });
  const frontLens = new THREE.Mesh(frontLensGeo, frontLensMat);
  frontLens.position.set(0, 0, -0.161);
  frontLens.rotation.y = Math.PI; // Olha para frente (-Z)
  opticGroup.add(frontLens);

  // Sombra
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return { 
    group,
    details: {
      opticBody: tube,
      rearLens: rearLens,
      frontLens: frontLens
    }
  };
}
