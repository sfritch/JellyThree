import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "jsm/loaders/HDRLoader.js";

let camera, scene, renderer, ctrls,mixer;

const clock = new THREE.Clock();

// MATERIALs
const jellyParams = {
  color: 0xbbeeff,
  transmission: 1,
  transparent: true,
  opacity: 1,
  metalness: .75,
  roughness: .5,
  ior: 1.67,
  thickness: .5,
  specularIntensity: 1,
  envMapIntensity: .5,
  attenuationDistance: 50,
  attenuationColor: new THREE.Color(0x88ccff),
  side: THREE.FrontSide,
  exposure: 3
};

const brainParams = {
  color: 0x00ffff,
  roughness: 0,
  metalness: 0,
  transmission: 1,
  opacity: 1,
  transparent: true,
  emissive: 0x1a8dcb,
  emissiveIntensity: 50.0,
  envMapIntensity: 1,
  side: THREE.DoubleSide
};

init();

function init() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = jellyParams.exposure;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  document.body.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  // const geo = new THREE.SphereGeometry(50, 32, 32);

  // const mat = new THREE.MeshBasicMaterial({
  //   color: 0xffffff,
  //   side: THREE.BackSide
  // });

  // const whiteShell = new THREE.Mesh(geo, mat);
  // scene.add(whiteShell);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 8);

  // Controls
  ctrls = new OrbitControls(camera, renderer.domElement);
  ctrls.enableDamping = true;
  ctrls.enablePan = false;

  // Lights 
  //const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  //dirLight.position.set(5, 10, 5);
  //scene.add(dirLight);

   const rim = new THREE.DirectionalLight(0xffffff, 1);
   rim.position.set(0, 2, .1);
   scene.add(rim);

  //scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.8));

  
  const jellyMaterial = new THREE.MeshPhysicalMaterial({
    color: jellyParams.color,
    transmission: jellyParams.transmission,
    transparent: jellyParams.transparent,
    opacity: jellyParams.opacity,
    roughness: jellyParams.roughness,
    metalness: jellyParams.metalness,
    ior: jellyParams.ior,
    thickness: jellyParams.thickness,
    attenuationDistance: jellyParams.attenuationDistance,
    attenuationColor: jellyParams.attenuationColor,
    specularIntensity: jellyParams.specularIntensity,
    envMapIntensity: jellyParams.envMapIntensity,
    side: jellyParams.side
  });
  

  // HDR ENV
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  new HDRLoader().load(
  "Fresnel_sm.hdr",
  (hdrTexture) => {

    const envMap =
      pmrem.fromEquirectangular(hdrTexture).texture;

    scene.environment = envMap;

    const whiteEnv = pmrem.fromScene(scene).texture;

    //scene.environment = whiteEnv;
    scene.background = new THREE.Color(0x000000);

    hdrTexture.dispose();
    pmrem.dispose();

    loadModel(jellyMaterial);
  }
);

  window.addEventListener("resize", onResize);

  animate();
}

// Load GLB Model
function loadModel(material) {
  const loader = new GLTFLoader();

  loader.load("jellyfish.glb", (gltf) => {
    const root = gltf.scene;
    scene.add(root);

    if (gltf.animations && gltf.animations.length > 0) {

  mixer = new THREE.AnimationMixer(root);

  //console.log("Animations found:", gltf.animations);

  gltf.animations.forEach((clip) => {

    const action = mixer.clipAction(clip);

      action.reset();
      action.play();

    });

    } else {
      console.warn("No animations found in GLB");
    }

    root.traverse((child) => {

  if (!child.isMesh) return;

  const name = child.name.toLowerCase();

  const isBrain = name.includes("brain");

  if (isBrain) {

    child.renderOrder = 1;

    child.material = new THREE.MeshPhysicalMaterial({
      color: brainParams.color,
      roughness: brainParams.roughness,
      metalness: brainParams.metalness,
      transmission: brainParams.transmission,
      transparent: brainParams.transparent,
      opacity: brainParams.opacity,
      emissive: brainParams.emissive,
      emissiveIntensity: brainParams.emissiveIntensity,
      envMapIntensity: brainParams.envMapIntensity,
      side: brainParams.side
    });

  } else {

    child.renderOrder = 0;

    child.material = material;
    child.material.flatShading = false;
  }
});


  });
}

// LOOP
function animate() {
  const delta = clock.getDelta();

  requestAnimationFrame(animate);

  if (mixer) mixer.update(delta);
  ctrls.update();

  renderer.render(scene, camera);
}

// RESIZE
function onResize() {

  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
}