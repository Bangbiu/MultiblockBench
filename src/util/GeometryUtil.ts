import { 
    BufferAttribute, 
    BufferGeometry, 
    Group, 
    Mesh, 
    Plane, 
    Triangle, 
    Vector2, 
    Vector3, 
    WireframeGeometry, 
    type Face,
    type TypedArray, 
} from "three";
import { mergeBufferGeometries, mergeVertices } from "three-stdlib";
import GeometryWorker from '../worker/GeometryWorker?worker';

//AsyncFuncKeys<Omit<typeof GeometryUtil, 'run'>>;
type GeometryFunctionName = keyof typeof GeometryUtil;

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

type TriEdges = [IndexedEdge, IndexedEdge, IndexedEdge];
type TriIndices = [number, number, number];
type EdgeIndices = [number, number];

class IndexedEdge {
    // non-Directional
    public readonly indices: EdgeIndices;
    public readonly faces: Set<IndexedTri>;
    constructor(i1: number, i2: number) {
        // Ensure a is always small
        this.faces = new Set();
        this.indices = [Math.min(i1, i2), Math.max(i1, i2)];
    }

    public get a(): number { return this.indices[0]; }
    public get b(): number { return this.indices[1]; }

    public addFace(face: IndexedTri): this {
        this.faces.add(face);
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
    public readonly indices: TriIndices;
    public readonly edges: TriEdges;
    constructor(indices: TriIndices, edges?: TriEdges) {
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
    public getTriOn(geometry: BufferGeometry): Triangle {
        const position = geometry.attributes.position as BufferAttribute;
        const vA = new Vector3().fromBufferAttribute(position, this.indices[0]);
        const vB = new Vector3().fromBufferAttribute(position, this.indices[1]);
        const vC = new Vector3().fromBufferAttribute(position, this.indices[2]);

        return new Triangle(vA, vB, vC);
    }

    public log() {
        console.log(this.a + "," + this.b + "," + this.c);
    }

    public static at(indices: BufferAttribute, index: number) {
        const a = indices.getX(index);
        const b = indices.getX(index + 1);
        const c = indices.getX(index + 2);
        return new IndexedTri([a, b, c]);
    }
}

class EdgeGraph extends Map<string, IndexedEdge> {
    public readonly faces: Array<IndexedTri>;
    public readonly canonical: Map<number, number>;
    public readonly geometry: BufferGeometry;
    constructor(geometry: BufferGeometry) {
        super();
        if (!geometry.index) throw new Error("Geometry must be indexed");
        this.geometry = geometry;
        this.faces = new Array();
        this.canonical = GeometryUtil.createCanonicalVertexMap(geometry);
        const indices = geometry.index;
        for (let i = 0; i < indices.count; i += 3) {
            const a = indices.getX(i);
            const b = indices.getX(i + 1);
            const c = indices.getX(i + 2);

            // Use canonical position index for edge graph
            const ca = this.canonical.get(a)!;
            const cb = this.canonical.get(b)!;
            const cc = this.canonical.get(c)!;

            const e1 = this.getOrPutEdge(ca, cb);
            const e2 = this.getOrPutEdge(cb, cc);
            const e3 = this.getOrPutEdge(cc, ca);

            const face = new IndexedTri([a, b, c], [e1, e2, e3]); // store raw indices
            this.faces.push(face);
        }
    }

    public indexedTriAt(index: number): IndexedTri {
        return this.faces[index];
    }

    public triAt(index: number): Triangle {
        return this.faces[index].getTriOn(this.geometry);
    }

    public getPlaneAt(index: number): Plane {
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
    public readonly uva: Vector2;
    public readonly uvb: Vector2;
    public readonly uvc: Vector2;
    public readonly matIndex: number;
    constructor(geometry: BufferGeometry, face: Face) {
        super();
        const pos = geometry.attributes.position;
        const uv = geometry.attributes.uv as BufferAttribute;
        super.setFromAttributeAndIndices(pos, face.a, face.b, face.c);
        this.uva = new Vector2().fromBufferAttribute(uv, face.a);
        this.uvb = new Vector2().fromBufferAttribute(uv, face.b);
        this.uvc = new Vector2().fromBufferAttribute(uv, face.c);
        this.matIndex = face.materialIndex;
    }
    
    public static getFaceMaterialIndices(geometry: BufferGeometry): number[] {
        const result: number[] = [];
        for (const group of geometry.groups) {
            const faceStart = group.start / 3;
            const faceCount = group.count / 3;
            for (let i = 0; i < faceCount; i++) {
                result[faceStart + i] = group.materialIndex!;
            }
        }
        return result;
    }

    public createGeometry() {
        const geometry = new BufferGeometry();
        geometry.setFromPoints([this.a, this.b, this.c]);
        geometry.setIndex([0, 1, 2]);
        return geometry;
    }

    public static of(geometry: BufferGeometry, face: Face) {
        return new BenchTriangle(geometry, face);
    }
}

class GeometryUtil {

    public static combineGeometries(loadedObj: Group): BufferGeometry | null {
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

    public static createCanonicalVertexMap(geometry: BufferGeometry): Map<number, number> {
        const position = geometry.attributes.position;
        const map = new Map<string, number>();       // pos key → canonical index
        const canonical = new Map<number, number>(); // raw index → canonical index

        for (let i = 0; i < position.count; i++) {
            const key = `${position.getX(i).toFixed(5)}_${position.getY(i).toFixed(5)}_${position.getZ(i).toFixed(5)}`;
            if (!map.has(key)) {
                map.set(key, i);
            }
            canonical.set(i, map.get(key)!);
        }

        return canonical;
    }

    public static createIndexedGeometry(geometry: BufferGeometry): BufferGeometry {
        return mergeVertices(geometry);
    }

    public static createWireframe(geometry: BufferGeometry): WireframeGeometry {
        return new WireframeGeometry(geometry);
    }

    public static createEdgeGraph(geometry: BufferGeometry): EdgeGraph  {
        if (!geometry.index) throw new Error("Geometry must be indexed");
        return new EdgeGraph(geometry);
    }

    public static createCoplanar(geometry: BufferGeometry, faceIndex: number) {
        if (!geometry.index) throw new Error("Geometry must be indexed");
        const position = geometry.attributes.position as BufferAttribute;

        const edgeGraph: EdgeGraph = geometry.userData.edgeGraph ?? GeometryUtil.createEdgeGraph(geometry);

        const baseIndexedTri = edgeGraph.indexedTriAt(faceIndex);
        const basePlane = edgeGraph.getPlaneAt(faceIndex);

        const visited = new Set<IndexedTri>();
        const toVisit = [baseIndexedTri];
        const resultIndices: number[] = [];

        while (toVisit.length > 0) {
            const curIndexedTri = toVisit.pop()!;
            if (visited.has(curIndexedTri)) continue;
            visited.add(curIndexedTri);

            const tri = curIndexedTri.getTriOn(geometry);
            const coplanar = GeometryUtil.isCoplanar(tri, basePlane);
            
            if (!coplanar) continue;

            // Add original triangle indices
            resultIndices.push(
                curIndexedTri.a,
                curIndexedTri.b,
                curIndexedTri.c
            );

            for (const edge of curIndexedTri.edges) {
                const neighbors = edge.faces;
                for (const neighbor of neighbors) {
                    
                    if (!visited.has(neighbor)) {
                        toVisit.push(neighbor);
                    }
                }
            }
        }
        const output = new BufferGeometry();
        if (resultIndices.length === 0) return output;
        output.setIndex(resultIndices);
        output.setAttribute("position", position.clone());
        output.computeVertexNormals();
        return output;
    }

    public static isCoplanar(tri: Triangle, basePlane: Plane, COPLANAR_TOLERANCE = 0.02, NORMAL_TOLERANCE = 0.5) {
        const plane = new Plane().setFromCoplanarPoints(tri.a, tri.b, tri.c);
        const aligned = plane.normal.angleTo(basePlane.normal) < NORMAL_TOLERANCE;
        if (!aligned) return false;
        const coplanar =
                Math.abs(basePlane.distanceToPoint(tri.a)) < COPLANAR_TOLERANCE &&
                Math.abs(basePlane.distanceToPoint(tri.b)) < COPLANAR_TOLERANCE &&
                Math.abs(basePlane.distanceToPoint(tri.c)) < COPLANAR_TOLERANCE;
        return coplanar;
    }

    public static async run<T = any>(fn: GeometryFunctionName, ...payload: any[]): Promise<T> {
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




export type {
    GeometryFunctionName
}

export {
    GeometryUtil,
    BenchTriangle
}
