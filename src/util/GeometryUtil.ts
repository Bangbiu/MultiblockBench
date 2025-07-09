import { 
    BufferAttribute, 
    BufferGeometry, 
    Group, 
    Mesh, 
    Plane, 
    Triangle, 
    Vector3, 
    WireframeGeometry, 
    type TypedArray, 
} from "three";
import { mergeBufferGeometries, mergeVertices } from "three-stdlib";
import GeometryWorker from '../worker/GeometryWorker?worker';
import type { BenchGeometry, BenchSubGeometry } from "./BenchGeometry";

//AsyncFuncKeys<Omit<typeof GeometryUtil, 'run'>>;
type RunnableFuncKeys<T> = {
    [K in keyof T]: T[K] extends (geometry: BufferGeometry) => BufferGeometry ? K : never
}[keyof T];

type GeometryRunnableFunctions = RunnableFuncKeys<Omit<typeof GeometryUtil, 'run'>>;

type SerializedGeometry = {
    attributes: Record<string, SerializedAttribute>;
    index: { array: TypedArray } | null;
    groups?: { start: number; count: number; materialIndex?: number }[];
    drawRange?: { start: number; count: number };
};

type SerializedAttribute = {
    array: TypedArray; // or other TypedArray
    itemSize: number;
    normalized: boolean;
};

type GeometryIndexedMesh = Mesh & { geometry: IndexedBufferGeometry };
type IndexedBufferGeometry = BufferGeometry & { index: BufferAttribute };




class GeometryUtil {

    public static combineGroupGeometries(loadedObj: Group): BufferGeometry | null {
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

    public static canonicalize(geometry: IndexedBufferGeometry): IndexedBufferGeometry {
        assertIndexedGeometry(geometry);
        const position = geometry.attributes.position as BufferAttribute;
        const indexAttr = geometry.index;

        const keyToIndex = new Map<string, number>();
        const canonicalPositions: Vector3[] = [];
        const remappedIndices: number[] = [];

        const tmpVec = new Vector3();

        for (let i = 0; i < indexAttr.count; i++) {
            const posIndex = indexAttr.getX(i);
            tmpVec.fromBufferAttribute(position, posIndex);
            const key = vertKey(tmpVec);

            let canonicalIndex = keyToIndex.get(key);
            if (canonicalIndex === undefined) {
            canonicalIndex = canonicalPositions.length;
            keyToIndex.set(key, canonicalIndex);
            canonicalPositions.push(tmpVec.clone());
            }

            remappedIndices.push(canonicalIndex);
        }

        // Build new Float32Array for canonical position attribute
        const canonicalArray = new Float32Array(canonicalPositions.length * 3);
        for (let i = 0; i < canonicalPositions.length; i++) {
            const v = canonicalPositions[i];
            canonicalArray[i * 3 + 0] = v.x;
            canonicalArray[i * 3 + 1] = v.y;
            canonicalArray[i * 3 + 2] = v.z;
        }

        const newGeo = new BufferGeometry();
        newGeo.setAttribute('position', new BufferAttribute(canonicalArray, 3));
        newGeo.setIndex(remappedIndices);
        newGeo.computeVertexNormals();
        return newGeo as IndexedBufferGeometry;
    }

    public static createCanonicalIndexArray(geometry: IndexedBufferGeometry, outputArray?: Array<number>): Array<number> {
        const position = geometry.attributes.position as BufferAttribute;
        const indices = geometry.index;
        const canonicalIndexMap = new Map<string, number>(); // key → canonical index
        //const canonicalPositions: Vector3[] = [];

        let canonicalCounter = 0;
        const result = outputArray ?? new Array();
        for (let i = 0; i < indices.count; i++) {
            const posIndex = indices.getX(i);
            const pos = new Vector3().fromBufferAttribute(position, posIndex);
            const key = vertKey(pos);

            let canonicalIdx = canonicalIndexMap.get(key);
            if (canonicalIdx === undefined) {
                canonicalIdx = canonicalCounter++;
                canonicalIndexMap.set(key, canonicalIdx);
            }

            result.push(canonicalIdx);
        }
        return result;
    }

    public static mergeIndexedGeometries(geometries: IndexedBufferGeometry[]): IndexedBufferGeometry {
        const merged = mergeBufferGeometries(geometries, true);
        if (!merged) throw new Error("Merge failed");
        return merged as IndexedBufferGeometry;
    }

    public static createTriangleGeometry(tri: Triangle): IndexedBufferGeometry {
        const geometry = new BufferGeometry();
        geometry.setFromPoints([tri.a, tri.b, tri.c]);
        geometry.setIndex([0, 1, 2]);
        geometry.computeVertexNormals();
        return geometry as IndexedBufferGeometry;
    }

    public static createIndexedGeometry(geometry: BufferGeometry): IndexedBufferGeometry {
        return mergeVertices(geometry) as IndexedBufferGeometry;
    }

    public static createWireframe(geometry: BufferGeometry): WireframeGeometry {
        return new WireframeGeometry(geometry);
    }

    public static createCoplane(benchGeom: BenchGeometry, baseIndex: number): BenchSubGeometry {
        const basePlane = benchGeom.planeAt(baseIndex);
        const visited = new Set<number>();
        const toVisit = [baseIndex];
        const result: Set<number> = new Set();

        while (toVisit.length > 0) {
            const curIndex = toVisit.pop()!;
            if (visited.has(curIndex)) continue;
            visited.add(curIndex);

            const curTri = benchGeom.triAt(curIndex)
            const coplanar = GeometryUtil.isCoplanar(curTri, basePlane);
            
            if (!coplanar) {
                continue;
            }

            // Add original triangle indices
            result.add(curIndex);

            for (const neighborIndex of benchGeom.neighborsOf(curIndex)) {
                if (neighborIndex === undefined) continue;
                if (visited.has(neighborIndex)) continue;
                toVisit.push(neighborIndex);
            }
        }
        
        return benchGeom.subGeometry(result);
    }

    public static isCoplanar(tri: Triangle, basePlane: Plane, COPLANAR_TOLERANCE = 0.02, NORMAL_TOLERANCE = 0.2) {
        const plane = new Plane().setFromCoplanarPoints(tri.a, tri.b, tri.c);
        const aligned = plane.normal.angleTo(basePlane.normal) < NORMAL_TOLERANCE;
        if (!aligned) return false;
        const coplanar =
                Math.abs(basePlane.distanceToPoint(tri.a)) < COPLANAR_TOLERANCE &&
                Math.abs(basePlane.distanceToPoint(tri.b)) < COPLANAR_TOLERANCE &&
                Math.abs(basePlane.distanceToPoint(tri.c)) < COPLANAR_TOLERANCE;
        return coplanar;
    }

    public static extractSubMesh(srcMesh: GeometryIndexedMesh, subGeometry: BenchSubGeometry): Mesh {
        const srcGeo = srcMesh.geometry;
        
        const attributes = srcGeo.attributes;
        const usedVertexMap = new Map<number, number>(); // oldIndex -> newIndex
        const newIndices: number[] = [];

        let newVertexCounter = 0;

        for (const face of subGeometry.faces()) {
            const [a, b, c] = face.verts;

            for (const vi of [a, b, c]) {
                if (!usedVertexMap.has(vi)) {
                    usedVertexMap.set(vi, newVertexCounter++);
                }
            }

            newIndices.push(
                usedVertexMap.get(a)!,
                usedVertexMap.get(b)!,
                usedVertexMap.get(c)!
            );
        }

        // Create reverse map: newIndex -> oldIndex
        const reverseMap = new Map<number, number>();
        for (const [oldIndex, newIndex] of usedVertexMap.entries()) {
            reverseMap.set(newIndex, oldIndex);
        }

        const newGeo = new BufferGeometry();

        for (const [name, attr] of Object.entries(attributes)) {
            const itemSize = attr.itemSize;
            const TypedArrayConstructor = attr.array.constructor as any;
            const array = new TypedArrayConstructor(usedVertexMap.size * itemSize);

            for (let newIndex = 0; newIndex < usedVertexMap.size; newIndex++) {
                const oldIndex = reverseMap.get(newIndex)!;
                for (let k = 0; k < itemSize; k++) {
                    array[newIndex * itemSize + k] = attr.array[oldIndex * itemSize + k];
                }
            }

            newGeo.setAttribute(name, new BufferAttribute(array, itemSize, attr.normalized));
        }

        // Build new index buffer
        const IndexArrayConstructor = (srcGeo.index.array.constructor as any);
        const newIndexBuffer = new IndexArrayConstructor(newIndices);
        newGeo.setIndex(new BufferAttribute(newIndexBuffer, 1));

        const subMesh = new Mesh(newGeo, srcMesh.material);
        return subMesh;
    }

    public static async run<T = any>(fn: GeometryRunnableFunctions, ...payload: any[]): Promise<T> {
        const worker = new GeometryWorker();
        return new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                if (e.data.error)
                    reject(e.data.error);
                else 
                    resolve(GeometryUtil.deserializeAsType(e.data.result) as T);
            };

            worker.onerror = reject;
            GeometryUtil.serializeAll(payload);
            worker.postMessage({ 
                fn, payload
            });
        });
    }

    public static serialize(geometry: BufferGeometry): SerializedGeometry {
        const data: SerializedGeometry = {
            attributes: {},
            index: null,
            groups: geometry.groups,
            drawRange: geometry.drawRange
        };

        for (const name in geometry.attributes) {
            const attr = geometry.attributes[name];
            data.attributes[name] = {
                array: attr.array,
                itemSize: attr.itemSize,
                normalized: attr.normalized
            };
        }

        if (geometry.index) {
            data.index = {
                array: geometry.index.array
            };
        }

        return data;
    }

    public static deserialize(data: SerializedGeometry): BufferGeometry {
        const geometry = new BufferGeometry();

        for (const name in data.attributes) {
            const attr = data.attributes[name];
            geometry.setAttribute(name,
            new BufferAttribute(attr.array, attr.itemSize, attr.normalized)
            );
        }

        if (data.index) {
            geometry.setIndex(new BufferAttribute(data.index.array, 1));
        }

        if (data.groups) geometry.groups = data.groups;
        if (data.drawRange) geometry.drawRange = data.drawRange;

        return geometry;
    }

    public static isSerializedGeometry(obj: any): boolean {
        return obj &&
            typeof obj === 'object' && obj.attributes &&
            obj.attributes.position &&
            obj.attributes.position.array instanceof Float32Array &&
            typeof obj.attributes.position.itemSize === 'number';
    }

    public static isSerializedMap<K = any, V = any>(value: any): value is [K, V][] {
        return (
            Array.isArray(value) &&
            value.every(
            entry =>
                Array.isArray(entry) &&
                entry.length === 2
            )
        );
    }

    public static isSerializedEdgeMap(obj: any): boolean {
        return GeometryUtil.isSerializedMap<string, number[]>(obj);
    }

    public static serializeAsType(obj: any) {
        if (obj instanceof BufferGeometry) 
            return GeometryUtil.serialize(obj);
        else if (obj instanceof Map)
            return Array.from(obj.entries());
        else
            return obj;
    }

    public static deserializeAsType(obj: any) {
        if (GeometryUtil.isSerializedGeometry(obj))
            return GeometryUtil.deserialize(obj);
        else if (GeometryUtil.isSerializedEdgeMap(obj))
            return new Map(obj);
        else 
            return obj;
    }

    public static deserializeAll(payload: any[]): void {
        payload.forEach((value, index) => {
            payload[index] = GeometryUtil.deserializeAsType(value)
        });
    }

    public static serializeAll(payload: any[]): void {
        payload.forEach((value, index) => {
            payload[index] = GeometryUtil.serializeAsType(value)
        });
    } 
}

function assertIndexedGeometry(geom: BufferGeometry): asserts geom is IndexedBufferGeometry {
    if (!geom.index) throw new Error("Geometry must be indexed.");
}

function vertKey(v: Vector3) {
    return `${v.x.toFixed(5)}_${v.y.toFixed(5)}_${v.z.toFixed(5)}`;
}

export type {
    GeometryRunnableFunctions,
    IndexedBufferGeometry,
    GeometryIndexedMesh
}

export {
    GeometryUtil,
}
