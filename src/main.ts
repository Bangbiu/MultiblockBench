import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThickGridHelper } from './ThickGridHelper';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.set(-12,26,-16);
camera.lookAt(new THREE.Vector3(0,0,0));

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


// Controls
const controls = new OrbitControls(camera, renderer.domElement);
//controls.enableDamping = true;
//controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0); // rotate around the origin
controls.update();

//const thickGrid = new ThickGridHelper(160, 10, 0xffffff, 0.03);
//scene.add(thickGrid);

// Add a grid helper on the XZ plane (like ground)
const gridHelper = new THREE.GridHelper(160, 160, 0x555555, 0x555555);
//gridHelper.scale.set(1, 1, 1);
scene.add(gridHelper);
const gridHelper2 = new THREE.GridHelper(160, 10, 0xFFFFFF, 0xFFFFFF);
scene.add(gridHelper2);

// Add axes helper to visualize X, Y, Z
const axesHelper = new THREE.AxesHelper(80); // length of axes
scene.add(axesHelper);

// Cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
const cube = new THREE.Mesh(geometry, material);
cube.position.add(new THREE.Vector3(8,8,8));
cube.scale.set(16, 16, 16);
scene.add(cube);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(2, 2, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // color, intensity
scene.add(ambientLight);

// Animate
function animate(): void {
  requestAnimationFrame(animate);
  //cube.rotation.x += 0.01;
  //cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});