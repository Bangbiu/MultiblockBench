import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Vector3 } from "three";

export class GeometryUtil {

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
