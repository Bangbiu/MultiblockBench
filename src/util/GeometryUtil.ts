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

    public static mergeVerticesWithNormals(geometry: BufferGeometry, tolerance = 1e-4): BufferGeometry {
        // Ensure it's non-indexed so each triangle has separate vertices
        const nonIndexed = geometry.toNonIndexed();
        const posAttr = nonIndexed.getAttribute('position');
        const normAttr = nonIndexed.getAttribute('normal');
        const uvAttr = nonIndexed.getAttribute('uv');

        const newPositions: number[] = [];
        const newNormals: number[] = [];
        const newUVs: number[] = [];
        const vertexMap = new Map<string, number>(); // key: "x|y|z", value: new index
        const indexMap: number[] = [];

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);

            const key = `${Math.round(x / tolerance)}|${Math.round(y / tolerance)}|${Math.round(z / tolerance)}`;
            if (vertexMap.has(key)) {
            indexMap.push(vertexMap.get(key)!);
            } else {
            const newIndex = newPositions.length / 3;
            vertexMap.set(key, newIndex);
            newPositions.push(x, y, z);

            if (normAttr) newNormals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
            if (uvAttr) newUVs.push(uvAttr.getX(i), uvAttr.getY(i));
            indexMap.push(newIndex);
            }
        }

        const merged = new BufferGeometry();
        merged.setIndex(indexMap);
        merged.setAttribute('position', new Float32BufferAttribute(newPositions, 3));
        if (newNormals.length > 0) merged.setAttribute('normal', new Float32BufferAttribute(newNormals, 3));
        if (newUVs.length > 0) merged.setAttribute('uv', new Float32BufferAttribute(newUVs, 2));
        merged.computeVertexNormals();
        return merged;
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
