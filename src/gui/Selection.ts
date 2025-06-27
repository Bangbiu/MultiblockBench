import { 
    BufferGeometry, 
    DoubleSide, 
    Float32BufferAttribute, 
    Mesh, 
    MeshBasicMaterial, 
    Plane, 
    Triangle, 
    Vector3, 
    type Intersection
} from "three";
import { GeometryUtil } from "../util/GeometryUtil";

class SelectedFace extends Mesh {
    public readonly sourceMesh: Mesh;
    constructor(src: Mesh) {
        super(new BufferGeometry(), 
            new MeshBasicMaterial({
                color: 0xffff00, 
                side: DoubleSide,
                transparent: true,
                opacity: 0.5
            }));
        this.sourceMesh = src;
        this.visible = false;
    }

    public update(isect: Intersection) {
        if (isect.face) {
            // Create triangle geometry
            const tri = GeometryUtil.getTriangleByFace(this.sourceMesh.geometry, isect.face);
            this.geometry.setFromPoints([tri.a, tri.b, tri.c]);
            this.geometry.setIndex([0, 1, 2]);
        }
    }
}

class SelectedPlane extends Mesh  {
    public readonly sourceMesh: Mesh;
    constructor(src: Mesh) {
        super(new BufferGeometry(), 
            new MeshBasicMaterial({
                color: 0xffff00, 
                side: DoubleSide,
                transparent: true,
                opacity: 0.5
            }));
        this.sourceMesh = src;
        this.visible = false;
    }

    public update(isect: Intersection) {
        if (!isect.faceIndex) return;

        const COPLANAR_TOLERANCE = 0.05;
        const NORMAL_TOLERANCE = 0.01;

        const geometry = this.sourceMesh.geometry;
        const positionAttr = geometry.getAttribute('position');

        const triangleCount = positionAttr.count / 3;
        const visited = new Set<number>();
        const toVisit = [isect.faceIndex];
        const resultVertices: number[] = [];

        const getTriangle = (i: number): Triangle => {
            const a = new Vector3().fromBufferAttribute(positionAttr, i * 3);
            const b = new Vector3().fromBufferAttribute(positionAttr, i * 3 + 1);
            const c = new Vector3().fromBufferAttribute(positionAttr, i * 3 + 2);
            return new Triangle(a, b, c);
        };

        // Build edge → triangle index map
        const edgeMap = new Map<string, number[]>();
        for (let i = 0; i < triangleCount; i++) {
            const tri = getTriangle(i);
            const edges = [
            triangleKey(tri.a, tri.b),
            triangleKey(tri.b, tri.c),
            triangleKey(tri.c, tri.a)
            ];
            for (const edge of edges) {
            if (!edgeMap.has(edge)) edgeMap.set(edge, []);
            edgeMap.get(edge)!.push(i);
            }
        }

        const baseTri = getTriangle(isect.faceIndex);
        const basePlane = new Plane().setFromCoplanarPoints(baseTri.a, baseTri.b, baseTri.c);

        while (toVisit.length > 0) {
            const current = toVisit.pop()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const tri = getTriangle(current);
            const plane = new Plane().setFromCoplanarPoints(tri.a, tri.b, tri.c);

            const aligned = plane.normal.angleTo(basePlane.normal) < NORMAL_TOLERANCE;
            const coplanar =
            Math.abs(basePlane.distanceToPoint(tri.a)) < COPLANAR_TOLERANCE &&
            Math.abs(basePlane.distanceToPoint(tri.b)) < COPLANAR_TOLERANCE &&
            Math.abs(basePlane.distanceToPoint(tri.c)) < COPLANAR_TOLERANCE;

            if (!aligned || !coplanar) continue;

            // Add triangle vertices to output
            resultVertices.push(...tri.a.toArray(), ...tri.b.toArray(), ...tri.c.toArray());

            // Add connected triangles to stack
            const edges = [
            triangleKey(tri.a, tri.b),
            triangleKey(tri.b, tri.c),
            triangleKey(tri.c, tri.a)
            ];

            for (const edge of edges) {
            const neighbors = edgeMap.get(edge)!;
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) toVisit.push(neighbor);
            }
            }
        }

        if (resultVertices.length === 0) return null;

        // Create output mesh
        this.geometry.setAttribute(
            'position',
            new Float32BufferAttribute(resultVertices, 3)
        )
        this.geometry.computeVertexNormals();
    }
}

function triangleKey(a: Vector3, b: Vector3): string {
  // Ensure consistent ordering regardless of direction
  const hash = (v: Vector3) => `${v.x.toFixed(5)}_${v.y.toFixed(5)}_${v.z.toFixed(5)}`;
  const ha = hash(a), hb = hash(b);
  return ha < hb ? `${ha}|${hb}` : `${hb}|${ha}`;
}

export {
    SelectedFace,
    SelectedPlane
}