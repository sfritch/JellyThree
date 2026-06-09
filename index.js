import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "jsm/loaders/HDRLoader.js";

let camera, scene, renderer, ctrls,mixer;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let hovered = null;
let jellyRoot;
let actions = [];

const clock = new THREE.Clock();

// MATERIALs
const jellyParams = {
  color: 0xbbeeff,
  transmission: 1,
  transparent: true,
  opacity: 1,
  metalness: .05,
  roughness: .25,
  ior: 1.75,
  thickness: 1.1,
  specularIntensity: 2,
  envMapIntensity: 1.8,
  attenuationDistance: 50,
  attenuationColor: new THREE.Color(0x88ccff),
  side: THREE.FrontSide,
  exposure: 1
};

const brainParams = {
  color: 0x00ffff,
  roughness: 0,
  metalness: 0,
  transmission: 1,
  opacity: 1,
  transparent: true,
  emissive: 0x1a8dcb,
  emissiveIntensity: 2.0,
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
   rim.position.set(10, 1, 100);
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

  new HDRLoader().load("Fresnel_sm.hdr", (hdrTexture) => {

  const hdrEnv = pmrem.fromEquirectangular(hdrTexture).texture;

  // use HDR ONLY for subtle lighting
  scene.environment = hdrEnv;

  // DO NOT use HDR as background
  scene.background = new THREE.Color(0xeeeeee);

  hdrTexture.dispose();

  loadModel(jellyMaterial);
});

  window.addEventListener("resize", onResize);
  window.addEventListener("mousemove", (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener("click", onObjectClick);

  animate();
}

// Load GLB Model
function loadModel(material) {
  const loader = new GLTFLoader();
  const modelURL = new URL("./assets/jellyfish.glb", import.meta.url);

  loader.load(modelURL.href, (gltf) => {
    const root = gltf.scene;
    jellyRoot = root;
    scene.add(root);

    if (gltf.animations && gltf.animations.length > 0) {

  mixer = new THREE.AnimationMixer(root);

  actions = gltf.animations.map((clip) => {

  const action = mixer.clipAction(clip);

  action.reset();

  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;

  action.paused = true;   // stays paused
  action.play();          // required for mixer to evaluate
  action.time = 0;        // force frame 0

  action.enabled = true;

  return action;
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

  if (jellyRoot) {

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObject(jellyRoot, true);

    if (hits.length > 0) {

      if (hovered !== jellyRoot) {
        hovered = jellyRoot;

        onHoverEnter();
      }

    } else {

      if (hovered) {
        hovered = null;

        onHoverLeave();
      }
    }
  }

  renderer.render(scene, camera);
}

function onHoverEnter() {
  // jellyRoot.traverse((child) => {

  //   if (!child.isMesh) return;

  //   if (child.material.emissive) {
  //     child.material.emissive.set(0x3399ff);
  //     child.material.emissiveIntensity = 1;
  //   }

  //   child.material.envMapIntensity = 2;
  // });
}

function onHoverLeave() {
  
  // jellyRoot.traverse((child) => {

  //   if (!child.isMesh) return;

  //   if (child.material.emissive) {
  //     child.material.emissive.set(0x000000);
  //     child.material.emissiveIntensity = 0;
  //   }

  //   child.material.envMapIntensity = 1;
  // });
}

function onObjectClick(event) {
// convert mouse to normalized device coords (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObject(scene, true);

  if (hits.length === 0) return; // clicked empty space

  const hit = hits[0].object;
  const name = hit.name.toLowerCase();

 

  triggerAnimation();
}

function triggerAnimation() {

  if (!actions) return;

  actions.forEach((action) => {

    action.reset();
    action.paused = false;
    action.play();
  });
}

// RESIZE
function onResize() {

  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
}