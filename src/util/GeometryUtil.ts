import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, Triangle, Vector3, WireframeGeometry, type Face, type Intersection } from "three";
import { mergeBufferGeometries } from "three-stdlib";

export class GeometryUtil {

    public static extractGeometry(loadedObj: Group): BufferGeometry | null {
        const geometries: BufferGeometry[] = [];

        loadedObj.traverse((child) => {
            const mesh = child as Mesh;
            if (mesh.isMesh) {
                const geom = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
                geometries.push(geom);
            }
        });
        
        const mergedGeometry = mergeBufferGeometries(geometries, true);
        //mergeVertices();
        return mergedGeometry;
    }

    public static createWireFrame(geometry: BufferGeometry) {
        if (!geometry) return null;
        const wireframeGeometry = new WireframeGeometry(geometry);
        const wireframe = new LineSegments(
            wireframeGeometry,
            new LineBasicMaterial({
                color: 0xffff00,
                linewidth: 1 // note: linewidth may not work in all browsers
            })
        );
        // Set render order to draw on top
        wireframe.renderOrder = 1;
        //wireframe.material.depthTest = false; // makes it draw over the mesh
        return wireframe;
    }

    public static mergeVerticesWithNormals(geometry: BufferGeometry, normalThreshold = 0.01): BufferGeometry {
        // Step 1: Ensure indexed geometry
        geometry = geometry.toNonIndexed();
        const posAttr = geometry.getAttribute('position');
        const faceCount = posAttr.count / 3;

        // Helper to get face normal
        function getFaceNormal(i: number): Vector3 {
            const a = new Vector3().fromBufferAttribute(posAttr, i * 3);
            const b = new Vector3().fromBufferAttribute(posAttr, i * 3 + 1);
            const c = new Vector3().fromBufferAttribute(posAttr, i * 3 + 2);
            const cb = new Vector3().subVectors(c, b);
            const ab = new Vector3().subVectors(a, b);
            return cb.cross(ab).normalize();
        }

        // Step 2: Group triangles with roughly the same normal
        type Face = { index: number, normal: Vector3 };
        const groups: Face[][] = [];

        for (let i = 0; i < faceCount; i++) {
            const normal = getFaceNormal(i);
            let added = false;
            for (const group of groups) {
            if (group.length > 0 && group[0].normal.dot(normal) > 1 - normalThreshold) {
                group.push({ index: i, normal });
                added = true;
                break;
            }
            }
            if (!added) groups.push([{ index: i, normal }]);
        }

        // Step 3: Just re-add triangles per group (real minimal triangulation omitted)
        const newPositions: number[] = [];

        for (const group of groups) {
            for (const face of group) {
            for (let j = 0; j < 3; j++) {
                const idx = face.index * 3 + j;
                newPositions.push(
                posAttr.getX(idx),
                posAttr.getY(idx),
                posAttr.getZ(idx)
                );
            }
            }
        }

        const newGeom = new BufferGeometry();
        newGeom.setAttribute('position', new Float32BufferAttribute(newPositions, 3));
        newGeom.computeVertexNormals(); // optional for smoothing
        return newGeom;
    }

    public static getTriangleByFace(geometry: BufferGeometry, face: Face): Triangle {
        const position = geometry.attributes.position;
        return new Triangle(
            new Vector3().fromBufferAttribute(position, face.a),
            new Vector3().fromBufferAttribute(position, face.b),
            new Vector3().fromBufferAttribute(position, face.c)
        )
    }
}
