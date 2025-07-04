import { 
    BufferAttribute, 
    BufferGeometry, 
    EdgesGeometry, 
    Group, 
    Mesh, 
    Plane, 
    Triangle, 
    Vector2, 
    Vector3, 
    WireframeGeometry, 
    type TypedArray, 
} from "three";
import { mergeBufferGeometries, mergeVertices } from "three-stdlib";
import GeometryWorker from '../worker/GeometryWorker?worker';

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

type TriUV = [Vector2, Vector2, Vector2];
type TriEdges = [IndexedEdge, IndexedEdge, IndexedEdge];
type TriIndices = [number, number, number];
type EdgeIndices = [number, number];
type IndexedBufferGeometry = BufferGeometry & { index: BufferAttribute };

class IndexedEdge {
    // non-Directional
    public readonly indices: EdgeIndices;
    public readonly tris: Set<IndexedTri>;
    constructor(i1: number, i2: number) {
        // Ensure a is always small
        this.tris = new Set();
        this.indices = [Math.min(i1, i2), Math.max(i1, i2)];
    }

    public get a(): number { return this.indices[0]; }
    public get b(): number { return this.indices[1]; }

    public addFace(face: IndexedTri): this {
        this.tris.add(face);
        return this;
    }

    public equals(other: IndexedEdge) {
        return other.a == this.a && other.b == this.b;
    }

    /** Normalized key, for hashing */
    static key(a: number, b: number): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    get key(): string {
        return IndexedEdge.key(this.a, this.b);
    }
}

class IndexedTri {
    public readonly index: number;
    public readonly indices: TriIndices;
    public readonly edges: TriEdges;
    constructor(index: number, indices: TriIndices, edges?: TriEdges) {
        this.index = index;
        this.indices = indices;
        this.edges = edges ?? IndexedTri.createEdges(this);
        this.connectWithEdges();
    }

    public get a(): number { return this.indices[0]; }
    public get b(): number { return this.indices[1]; }
    public get c(): number { return this.indices[2]; }

    public get array(): TriIndices {
        return this.indices;
    }

    public connectWithEdges(): this {
        this.edges.forEach(edge => edge.addFace(this));
        return this;
    }

    public static createEdges(tri: IndexedTri): TriEdges {
        return [
            new IndexedEdge(tri.a, tri.b),
            new IndexedEdge(tri.b, tri.c),
            new IndexedEdge(tri.c, tri.a)
        ];
    }

    /**
     * Constructs a THREE.Triangle from the indexed triangle using a geometry.
     * Assumes the geometry has a 'position' attribute.
     */
    public on(geometry: BufferGeometry): Triangle {
        const position = geometry.attributes.position as BufferAttribute;
        const vA = new Vector3().fromBufferAttribute(position, this.a);
        const vB = new Vector3().fromBufferAttribute(position, this.b);
        const vC = new Vector3().fromBufferAttribute(position, this.c);

        return new Triangle(vA, vB, vC);
    }

    public geometryOn(geometry: BufferGeometry) {
        return GeometryUtil.createTriangleGeometry(this.on(geometry));
    }

    public log() {
        console.log(this.a + "," + this.b + "," + this.c);
    }

    public static at(indices: BufferAttribute, index: number) {
        const a = indices.getX(index * 3);
        const b = indices.getX(index * 3 + 1);
        const c = indices.getX(index * 3 + 2);
        return new IndexedTri(index, [a, b, c]);
    }
}

class IndexedGeometry {
    public readonly triIndices: Set<number>;
    constructor(...triIndices: Array<number>) {
        this.triIndices = new Set();
        this.add(...triIndices);
    }

    public get size(): number {
        return this.triIndices.size;
    }

    public add(...indices: Array<number>): this {
        indices.forEach(index => this.triIndices.add(index));
        return this;
    }

    public on(edgeGraphOrGeom: EdgeGraph | IndexedBufferGeometry) {
        const geometries = new Array<IndexedBufferGeometry>();
        if (edgeGraphOrGeom instanceof EdgeGraph) {
            const edgeGraph = edgeGraphOrGeom as EdgeGraph;
            for (const index of this.triIndices) {
                geometries.push(edgeGraph.geometryAt(index));
            }
            return GeometryUtil.mergeIndexedGeometries(geometries);
        } else {
            return new BufferGeometry();
        }
    }
}

class EdgeGraph extends Map<string, IndexedEdge> {
    public readonly tris: Array<IndexedTri>;
    public readonly uniquePosIndex: Array<number>;
    public geometry!: IndexedBufferGeometry;

    constructor() {
        super();
        this.tris = new Array();
        this.uniquePosIndex = new Array();
    }

    public create(geometry: IndexedBufferGeometry): this {
        assertIndexedGeometry(geometry);
        this.geometry = geometry;
        this.createCanonicalIndexArray();
        const indices = this.geometry.index;
        for (let i = 0; i < indices.count; i += 3) {
            const a = indices.getX(i);
            const b = indices.getX(i + 1);
            const c = indices.getX(i + 2);

            // Use canonical position index for edge graph
            const ca = this.uniquePosIndex[i];
            const cb = this.uniquePosIndex[i + 1];
            const cc = this.uniquePosIndex[i + 2];

            const e1 = this.getOrPutEdge(ca, cb);
            const e2 = this.getOrPutEdge(cb, cc);
            const e3 = this.getOrPutEdge(cc, ca);

            const tri = new IndexedTri(i / 3, [a, b, c], [e1, e2, e3]); // store raw indices
            this.tris.push(tri);
        }
        console.log(indices.array.length);
        const uniquePos: Set<number> = new Set();
        this.uniquePosIndex.forEach(element => {
            uniquePos.add(element);
        });
        
        console.log(uniquePos);
        
        return this;
    }

    public createCanonicalIndexArray(): void {
        const position = this.geometry.attributes.position as BufferAttribute;
        const indices = this.geometry.index;
        const canonicalIndexMap = new Map<string, number>(); // key → canonical index
        //const canonicalPositions: Vector3[] = [];

        let canonicalCounter = 0;

        for (let i = 0; i < indices.count; i++) {
            const posIndex = indices.getX(i);
            const pos = new Vector3().fromBufferAttribute(position, posIndex);
            const key = vertKey(pos);

            let canonicalIdx = canonicalIndexMap.get(key);
            if (canonicalIdx === undefined) {
                canonicalIdx = canonicalCounter++;
                canonicalIndexMap.set(key, canonicalIdx);
                //canonicalPositions.push(pos.clone()); // optional: store actual canonical positions
            }

            this.uniquePosIndex.push(canonicalIdx);
        }

        // const canonicalPosAttr = new BufferAttribute(
        //     new Float32Array(canonicalPositions.length * 3),
        //     3
        // );
        // canonicalPositions.forEach((v, i) => {
        //     canonicalPosAttr.setXYZ(i, v.x, v.y, v.z);
        // });
    }

    public indexedTriAt(index: number): IndexedTri {
        return this.tris[index];
    }

    public triAt(index: number): Triangle {
        return this.tris[index].on(this.geometry);
    }

    public geometryAt(index: number): IndexedBufferGeometry {
        return this.tris[index].geometryOn(this.geometry);
    }

    public planeAt(index: number): Plane {
        const tri = this.triAt(index);
        return new Plane().setFromCoplanarPoints(tri.a, tri.b, tri.c);
    }


    private getOrPutEdge(a: number, b: number): IndexedEdge {
        const key = IndexedEdge.key(a, b);
        if (!this.has(key)) 
            this.set(key, new IndexedEdge(a, b));
        return this.get(key)!;
    }

}

class BenchTriangle extends Triangle {
    public readonly uv: TriUV;
    public readonly matIndex: number;
    constructor(geometry: BufferGeometry, tri: IndexedTri) {
        super();
        const pos = geometry.attributes.position;
        const uv = geometry.attributes.uv as BufferAttribute;
        super.setFromAttributeAndIndices(pos, tri.a, tri.b, tri.c);
        this.uv = [
            new Vector2().fromBufferAttribute(uv, tri.a),
            new Vector2().fromBufferAttribute(uv, tri.b),
            new Vector2().fromBufferAttribute(uv, tri.c)
        ];
        this.matIndex = BenchTriangle.getMaterialIndex(geometry, tri.index)!;
    }
    
    public static getMaterialIndex(geometry: BufferGeometry, faceIndex: number): number | undefined {
        const triangleStartIndex = faceIndex * 3;

        for (const group of geometry.groups) {
            const groupStart = group.start;
            const groupEnd = group.start + group.count;

            if (triangleStartIndex >= groupStart && triangleStartIndex < groupEnd) {
                return group.materialIndex;
            }
        }

        return undefined; // if no group matched
    }

    public createGeometry() {
        const geometry = new BufferGeometry();
        geometry.setFromPoints([this.a, this.b, this.c]);
        geometry.setIndex([0, 1, 2]);
        return geometry;
    }

    public static of(geometry: BufferGeometry, triIndex: number) {
        return new BenchTriangle(geometry, IndexedTri.at(geometry.index!, triIndex));
    }
}

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

    public static createCoplanar(edgeGraph: EdgeGraph, baseIndex: number) {

        const basePlane = edgeGraph.planeAt(baseIndex);
        const visited = new Set<number>();
        const toVisit = [baseIndex];
        const result = new IndexedGeometry();

        while (toVisit.length > 0) {
            const curIndex = toVisit.pop()!;
            if (visited.has(curIndex)) continue;
            visited.add(curIndex);

            const curTri = edgeGraph.triAt(curIndex)
            const coplanar = GeometryUtil.isCoplanar(curTri, basePlane);
            
            if (!coplanar) continue;

            // Add original triangle indices
            result.add(curIndex);

            for (const edge of edgeGraph.indexedTriAt(curIndex).edges) {
                const neighbors = edge.tris;
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor.index)) {
                        toVisit.push(neighbor.index);
                    }
                }
            }
        }

        const output = result.on(edgeGraph);
        return output;
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
    IndexedBufferGeometry
}

export {
    GeometryUtil,
    BenchTriangle,
    EdgeGraph
}
