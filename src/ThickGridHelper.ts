import * as THREE from 'three';
import { MeshLine, MeshLineMaterial } from 'three.meshline';

export class ThickGridHelper extends THREE.Group {
  constructor(size = 10, divisions = 10, color = 0x888888, lineWidth = 0.05) {
    super();

    const step = size / divisions;
    const half = size / 2;

    const material = new MeshLineMaterial({
        color: color,
        lineWidth: lineWidth,
        side: THREE.DoubleSide,     // ✅ Render front and back faces
        depthTest: true,
        transparent: false,
        opacity: 1.0,
    });

    for (let i = -half; i <= half + 0.0001; i += step) {
      // Z-direction line at X=i
      this.add(this.makeThickLine(
        [i, 0, -half, i, 0, half],
        material
      ));

      // X-direction line at Z=i
      this.add(this.makeThickLine(
        [-half, 0, i, half, 0, i],
        material
      ));
    }
  }

  private makeThickLine(pointsArray: number[], material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointsArray, 3));

    const meshLine = new MeshLine();
    meshLine.setGeometry(geometry);

    return new THREE.Mesh(meshLine.geometry, material);
  }
}
