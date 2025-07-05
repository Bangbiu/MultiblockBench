import { BufferAttribute, BufferGeometry, Plane, Triangle, Vector3 } from "three";
import { GeometryUtil, type IndexedBufferGeometry } from "./GeometryUtil";

type Truple = [number, number, number];
type Duple = [number, number];
type Quadruple = [number, number, number, number];
type Sextuple = [number, number, number, number, number, number];
type SerializedBenchGeometry = {
    faces: Array<Sextuple>;
    edges: Array<Quadruple>;
    unidex: Array<number>;
}

class BenchEdge {
    public readonly index: number;
    public readonly verts: Duple;
    public readonly faces: Duple;
    
    constructor(index: number, v1: number, v2: number, f1?: number, f2?: number) {
        this.index = index;
        this.verts = [Math.min(v1, v2), Math.max(v1, v2)];
        this.faces = new Array(2) as Duple;
        if (f1) this.f1 = f1;
        if (f2) this.f2 = f2;
    }

    public get v1(): number { return this.verts[0]; }
    public get v2(): number { return this.verts[1]; }

    public get f1(): number { return this.faces[0]; }
    public get f2(): number { return this.faces[1]; }
    public set f1(faceIndex: number) { this.faces[0] = faceIndex; }
    public set f2(faceIndex: number) { this.faces[1] = faceIndex; }

    public get isManifold() { return this.f1 && this.f2; }

    public putFace(faceIndex: number): boolean {
        if (this.f1 && this.f2) return false;
        if (this.f2) this.f1 = faceIndex;
        else this.f2 = faceIndex;
        return true;
    }

    public otherFaceOf(faceIndex: number): number {
        if (this.f1 === faceIndex) 
            return this.f2;
        else
            return this.f1;
    }
    
    public equals(other: BenchEdge) {
        return other.v1 == this.v1 && other.v2 == this.v2;
    }

    /** Normalized key, for hashing */
    static key(a: number, b: number): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    get key(): string {
        return BenchEdge.key(this.v1, this.v2);
    }

    public serialize(): Quadruple {
        return [...this.verts, ...this.faces];
    }

    public static serialize(bf: BenchEdge): Quadruple {
        return [...bf.verts, ...bf.faces];
    }

    public static deserialize(index: number, data: Quadruple) {
        return new BenchEdge(
            index,
            data[0],data[1], 
            data[2],data[3]
        );
    }
}

class BenchFace {
    public readonly index: number;
    public readonly verts: Truple;
    public readonly edges: Truple;
    constructor(index: number, verts: Truple, edges: Truple) {
        this.index = index;
        this.verts = verts;
        this.edges = edges;
    }

    public get a(): number { return this.verts[0]; }
    public get b(): number { return this.verts[1]; }
    public get c(): number { return this.verts[2]; }

    public get array(): Truple {
        return this.verts;
    }

    public on(geometry: IndexedBufferGeometry): Triangle {
        const position = geometry.attributes.position as BufferAttribute;
        const vA = new Vector3().fromBufferAttribute(position, this.a);
        const vB = new Vector3().fromBufferAttribute(position, this.b);
        const vC = new Vector3().fromBufferAttribute(position, this.c);
        return new Triangle(vA, vB, vC);
    }

    public geometryOn(geometry: IndexedBufferGeometry): IndexedBufferGeometry {
        return GeometryUtil.createTriangleGeometry(this.on(geometry));
    }

    public serialize(): Sextuple {
        return [...this.verts, ...this.edges];
    }

    public static serialize(bf: BenchFace): Sextuple {
        return [...bf.verts, ...bf.edges];
    }

    public static deserialize(index: number, data: Sextuple) {
        return new BenchFace(
            index, 
            [data[0], data[1], data[2]], 
            [data[3], data[4], data[5]]
        );
    }
}


class BenchGeometry {
    public readonly faces: Array<BenchFace>;
    public readonly edges: Array<BenchEdge>;
    public readonly unidex: Array<number>;
    public src?: IndexedBufferGeometry;

    constructor() {
        this.faces = new Array();
        this.edges = new Array();
        this.unidex = new Array();
    }

    public create(geometry: IndexedBufferGeometry): this {
        //this.canonic = GeometryUtil.canonicalize(geometry);
        this.src = geometry;
        this.faces.length = 0;
        this.edges.length = 0;
        this.unidex.length = 0;
        GeometryUtil.createCanonicalIndexArray(geometry, this.unidex);
        const indices = geometry.index;
        const edgeMap = new Map<string, BenchEdge>();
        for (let i = 0; i < indices.count; i += 3) {
            const a = indices.getX(i);
            const b = indices.getX(i + 1);
            const c = indices.getX(i + 2);

            // Use canonical position index for edge graph
            const ca = this.unidex[i];
            const cb = this.unidex[i + 1];
            const cc = this.unidex[i + 2];

            const e1 = this.getUniqueEdge(ca, cb, edgeMap);
            const e2 = this.getUniqueEdge(cb, cc, edgeMap);
            const e3 = this.getUniqueEdge(cc, ca, edgeMap);

            const faceIndex = i / 3
            const face = new BenchFace(faceIndex, [a, b, c], [e1, e2, e3]); // store raw indices
            
            this.edges[e1].putFace(faceIndex);
            this.edges[e2].putFace(faceIndex);
            this.edges[e3].putFace(faceIndex);
            
            this.faces.push(face);
        }
        return this;
    }

    public edgeAt(index: number): BenchEdge {
        return this.edges[index];
    }

    public faceAt(index: number): BenchFace {
        return this.faces[index];
    }

    public faceGeometryAt(index: number): IndexedBufferGeometry {
        this.assertSourceGeometry();
        return this.faces[index].geometryOn(this.src);
    }

    public triAt(index: number): Triangle {
        this.assertSourceGeometry();
        if (!this.faces[index])
            console.log(index + " from " + this.faces.length);
        
        return this.faces[index].on(this.src);
    }

    public planeAt(index: number): Plane {
        const tri = this.triAt(index);
        return new Plane().setFromCoplanarPoints(tri.a, tri.b, tri.c);
    }

    public neighborsOf(index: number): Truple {
        const face = this.faceAt(index);
        const neighbors = new Array();
        for (const edgeIndex of face.edges) {
            const edge = this.edges[edgeIndex];
            neighbors.push(edge.otherFaceOf(index));
        }
        return neighbors as Truple;
    }

    public isManifold(): boolean {
        for (const edge of this.edges) {
            if (!edge.isManifold) return false;
        }
        return true;
    }

    public getBoundaryEdge(): Array<number> {
        const boundaries = new Array<number>;
        for (const edge of this.edges) {
            if (!edge.isManifold) boundaries.push(edge.index);
        }
        return boundaries;
    }

    public subGeometry(faceIndices: Set<number>) {
        return new BenchSubGeometry(this, faceIndices);
    }

    public assertSourceGeometry(): asserts this is { src: IndexedBufferGeometry } {
        if (!this.src) throw new Error("Need Source Geometry");
    }

    public serialize(): SerializedBenchGeometry {
        return {
            faces: this.faces.map(face => face.serialize()),
            edges: this.edges.map(edge => edge.serialize()),
            unidex: this.unidex
        }
    }
    
    private getUniqueEdge(a: number, b: number, map: Map<string, BenchEdge>): number {
        const key = BenchEdge.key(a, b);
        if (map.has(key)) return map.get(key)!.index;

        const index = this.edges.length;
        const newEdge = new BenchEdge(index, a, b)
        this.edges.push(newEdge);
        map.set(key, newEdge);
        return index;
    }

    public static deserialize(data: SerializedBenchGeometry, src?: IndexedBufferGeometry): BenchGeometry {
        const geometry = new BenchGeometry();
        data.faces.forEach((faceData, faceIndex) => {
            geometry.faces.push(BenchFace.deserialize(faceIndex, faceData));
        });

        data.edges.forEach((edgeData, edgeIndex) => {
            geometry.edges.push(BenchEdge.deserialize(edgeIndex, edgeData));
        });

        data.unidex = data.unidex;
        if (src) geometry.src = src;

        return geometry;
    }
}    

class BenchSubGeometry {
    public readonly parent: BenchGeometry;
    public readonly bareGeom: IndexedBufferGeometry;
    public readonly faceIndices: Set<number>;
    constructor(parent: BenchGeometry, faceIndices: Set<number>) {
        this.parent = parent;
        this.faceIndices = faceIndices;
        const geometries = new Array<IndexedBufferGeometry>();
        for (const index of faceIndices) {
            geometries.push(parent.faceGeometryAt(index));
        }
        this.bareGeom = GeometryUtil.mergeIndexedGeometries(geometries);
    }

    public get size(): number {
        return this.faceIndices.size;
    }

    public faces(): Set<BenchFace> {
        const result = new Set<BenchFace>();
        for (const faceIndex of this.faceIndices) {
            result.add(this.parent.faceAt(faceIndex));
        }
        return result;
    }

    public addAll(indices: Array<number>): this {
        indices.forEach(index => this.faceIndices.add(index));
        return this;
    }
}

export {
    BenchFace,
    BenchGeometry,
    BenchSubGeometry
}