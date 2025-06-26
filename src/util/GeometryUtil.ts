import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, Vector3, WireframeGeometry } from "three";
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

    public static createUniqueWireframe(geometry: BufferGeometry): LineSegments {
        const positionAttr = geometry.attributes.position;
        if (!positionAttr) {
            console.warn("Mesh has no position attribute");
            return new LineSegments();
        }

        const edgeSet = new Set<string>();
        const edgeVertices: number[] = [];

        const pos = positionAttr.array as Float32Array;

        if (geometry.index) {
            // ✅ Indexed case
            const indices = geometry.index.array;

            for (let i = 0; i < indices.length; i += 3) {
                const a = indices[i], b = indices[i + 1], c = indices[i + 2];
                GeometryUtil.addEdge(pos, a, b, edgeSet, edgeVertices);
                GeometryUtil.addEdge(pos, b, c, edgeSet, edgeVertices);
                GeometryUtil.addEdge(pos, c, a, edgeSet, edgeVertices);
            }
        } else {
            // ✅ Non-indexed case
            const vertexCount = positionAttr.count; // total vertices
            for (let i = 0; i < vertexCount; i += 3) {
                const a = i, b = i + 1, c = i + 2;
                GeometryUtil.addEdge(pos, a, b, edgeSet, edgeVertices);
                GeometryUtil.addEdge(pos, b, c, edgeSet, edgeVertices);
                GeometryUtil.addEdge(pos, c, a, edgeSet, edgeVertices);
            }
        }

        const edgeGeometry = new BufferGeometry();
        edgeGeometry.setAttribute(
            'position',
            new BufferAttribute(new Float32Array(edgeVertices), 3)
        );

        return new LineSegments(
            edgeGeometry,
            new LineBasicMaterial({ color: 0xffff00 })
        );
    }


    public static addEdge(
        pos: Float32Array,
        i1: number,
        i2: number,
        edgeSet: Set<string>,
        edgeVertices: number[]
        ) {
        const v1 = new Vector3(
            pos[i1 * 3],
            pos[i1 * 3 + 1],
            pos[i1 * 3 + 2]
        );

        const v2 = new Vector3(
            pos[i2 * 3],
            pos[i2 * 3 + 1],
            pos[i2 * 3 + 2]
        );

        const key = GeometryUtil.makeEdgeKey(v1, v2);
        if (edgeSet.has(key)) return;
        edgeSet.add(key);

        edgeVertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }

    public static makeEdgeKey(a: Vector3, b: Vector3): string {
        const p1 = [a.x, a.y, a.z].map(n => n.toFixed(5));
        const p2 = [b.x, b.y, b.z].map(n => n.toFixed(5));
        return p1.join(',') < p2.join(',') ? `${p1.join(',')}|${p2.join(',')}` : `${p2.join(',')}|${p1.join(',')}`;
    }
}
