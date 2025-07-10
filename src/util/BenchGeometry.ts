import {
  BufferAttribute,
  Plane,
  Triangle,
  Vector3,
  type TypedArray
} from 'three';
import { GeometryUtil, type IndexedBufferGeometry } from './GeometryUtil';

type Truple = [number, number, number];
type EdgeTuple = [number, number, number, number]; // [v1, v2, f1, f2]

interface BenchReferer {
    readonly parent: BenchGeometry
    readonly index: number;    // Starting Index of SubArray
    readonly data: TypedArray; // SubArray of Parent Data Array
}

type ReferCreator<BR extends BenchReferer> = (index: number) => BR;


/**
 * Bench Vertex
 * 
 * Created from BenchGeometry By 
 * 
 * Starting Index and Data Length in vertEdges and vertFaces Index Pool
 * 
 * Able to create related Bench Edge and BenchFace Instance
 * 
 */
class BenchVertex implements BenchReferer{
    public readonly parent: BenchGeometry;
    public readonly index: number;
    public readonly data: TypedArray;
    public readonly edgeCount: number;
    constructor(parent: BenchGeometry, index: number) {
        this.parent = parent;
        this.index = index;
        const head = parent.vertMetaAttr.getX(index);
        const rear = head + parent.vertMetaAttr.getY(index);
        this.data = this.parent.vertEdgesPool
        .subarray(head, rear);
        this.edgeCount = this.data.length;
    }

    public static keyOf(v: Vector3) {
        return BenchVertex.key(v.x, v.y, v.z);
    }

    public static key(x: number, y: number, z: number) {
        return `${x.toFixed(5)}_${y.toFixed(5)}_${z.toFixed(5)}`;
    }

    public static readonly META_SIZE = 2;
}

/**
 * Bench Edge
 * 
 * Created from BenchGeometry By 
 * 
 * Elements from Starting Index to Starting Index + 4
 * Described by
 * [ vertIndex1(a), vertIndex2(b),
 *   faceIndex1(v1), faceIndex2(v2) ]
 * 
 */

class BenchEdge implements BenchReferer{
    public readonly parent: BenchGeometry;
    public readonly index: number;
    public readonly data: TypedArray;
    
    constructor(parent: BenchGeometry, index: number) {
        this.parent = parent;
        this.index = index;
        const itemSize = parent.edgeAttr.itemSize;
        const offset = index * itemSize;
        this.data = parent.edgeAttr.array.subarray(offset, offset + itemSize)
    }

    public get a(): number { return this.data[0]; }
    public get b(): number { return this.data[1]; }

    public get f1(): number { return this.data[2]; }
    public get f2(): number { return this.data[3]; }
    
    public get isManifold(): boolean {
        return this.f1 !== -1 && this.f2 !== -1;
    }

    public attachFace(faceIndex: number): boolean {
        if (this.f1 === -1) this.data[2] = faceIndex;
        else if (this.f2 === -1) this.data[3] = faceIndex;
        else return false;
        return true;
    }

    public otherFaceOf(faceIndex: number): Opt<number> {
        if (this.f1 !== faceIndex) return this.f1;
        else if (this.f2 !== faceIndex) return this.f2;
        else return undefined;
    }
    
    public equals(other: BenchEdge) {
        return other.a == this.a && other.b == this.b;
    }

    /** Normalized key, for hashing */
    static key(a: number, b: number): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    get key(): string {
        return BenchEdge.key(this.a, this.b);
    }

    public static readonly DATA_SIZE = 4;
}


/**
 * Bench Face
 * 
 * Created from BenchGeometry By 
 * 
 * Elements from Starting Index to Starting Index + 9
 * Described by
 * [
 *  vertIndex1(a), vertIndex2(b), vertIndex3(c)
 *  edgeIndex1(e1), edgeIndex2(e2), edgeIndex3(e3)
 *  uniqueVert1(v1), uniqueVert2(v2), uniqueVert3(v3)
 * ]
 * 
 */

class BenchFace implements BenchReferer {
    public readonly parent: BenchGeometry;
    public readonly index: number;
    public readonly data: TypedArray;

    constructor(parent: BenchGeometry, index: number) {
        this.parent = parent;
        this.index = index;
        const itemSize = parent.faceAttr.itemSize;
        const offset = index * itemSize;
        this.data = parent.faceAttr.array.subarray(offset, offset + itemSize);
    }

    public get a(): number { return this.data[0]; }
    public get b(): number { return this.data[1]; }
    public get c(): number { return this.data[2]; }

    public get e1(): number { return this.data[3]; }
    public get e2(): number { return this.data[4]; }
    public get e3(): number { return this.data[5]; }

    public get v1(): number { return this.data[6]; }
    public get v2(): number { return this.data[7]; }
    public get v3(): number { return this.data[8]; }

    public get indices(): TypedArray { return this.data.subarray(0, 3); }
    public get edgeIndices(): TypedArray { return this.data.subarray(3, 6); }
    public get vertIndices(): TypedArray { return this.data.subarray(6, 9); }

    public set indices(truple: Truple) { 
        for (let i = 0; i < 3; i++) this.data[i] = truple[i];
    }

    public set edgeIndices(truple: Truple) { 
        for (let i = 0; i < 3; i++) this.data[i + 3] = truple[i];
    }

    public set vertIndices(truple: Truple) { 
        for (let i = 0; i < 3; i++) this.data[i + 6] = truple[i];
    }

    public tri(): Triangle {
        const position = this.parent.src!.attributes.position as BufferAttribute;
        const vA = new Vector3().fromBufferAttribute(position, this.a);
        const vB = new Vector3().fromBufferAttribute(position, this.b);
        const vC = new Vector3().fromBufferAttribute(position, this.c);
        return new Triangle(vA, vB, vC);
    }

    public geometry(): IndexedBufferGeometry {
        return GeometryUtil.createTriangleGeometry(this.tri());
    }

    public edges(): Set<BenchEdge> {
        return derefer(this.edgeIndices, this.parent.edgeAt);
    }

    public static readonly DATA_SIZE = 9;
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
        return derefer(this.faceIndices, this.parent.faceAt);
    }

    public addAll(indices: Array<number>): this {
        indices.forEach(index => this.faceIndices.add(index));
        return this;
    }
}


class BenchGeometry {
    public edgeAttr!: BufferAttribute; // 4 * edgeCount
    public faceAttr!: BufferAttribute; // 9 * faceCount
    public vertMetaAttr!: BufferAttribute; // 2 * VertCount
    public vertEdgesPool!: TypedArray; // EdgeIndices to Vert
    public src?: IndexedBufferGeometry;

    constructor() {
        // initialized later
        this.vertAt = this.vertAt.bind(this);
        this.edgeAt = this.edgeAt.bind(this);
        this.faceAt = this.faceAt.bind(this);
    }

    public buildFrom(geometry: IndexedBufferGeometry, useUint16 = false): this {
        this.src = geometry;
        const IntArrConstructor = useUint16 ? Uint16Array : Uint32Array;
        const indexAttr = geometry.index;
        const faceCount = indexAttr.count / 3;
        const posAttr = geometry.attributes.position;

        const edgeMap = new Map<string, number>();
        const vertMap = new Map<string, number>();
    
        const edgeTuples: Array<EdgeTuple> = new Array();
        const vertEdgeSets: Array<Set<number>> = new Array();

        // Face Initialize
        const faceData = new IntArrConstructor(faceCount * BenchFace.DATA_SIZE);
        const faceAttr = new BufferAttribute(faceData, BenchFace.DATA_SIZE);
        this.faceAttr = faceAttr;
        for (let index = 0; index < indexAttr.count; index += 3) {
            const faceIndex = index / 3;
            const face = new BenchFace(this, faceIndex);
            
            const a = indexAttr.getX(index);
            const b = indexAttr.getY(index);
            const c = indexAttr.getZ(index);
            
            const indices: Truple = [a, b, c];
            const tempPos = new Vector3();
            const vertIndices = indices.map(vertIndex => {
                tempPos.fromBufferAttribute(posAttr, vertIndex);
                const key = BenchVertex.keyOf(tempPos);
                if (vertMap.has(key)) {
                    // Return Unique Vertex
                    const vertIndex = vertMap.get(key)!;
                    return vertIndex;
                } else {
                    // New Vertex
                    const vertIndex = vertEdgeSets.length;
                    vertMap.set(key, vertIndex);
                    // Push PlaceHolder for Edge Set
                    vertEdgeSets.push(new Set());
                    return vertIndex;
                }
            }) as Truple;

            const v1 = vertIndices[0];
            const v2 = vertIndices[1];
            const v3 = vertIndices[2];
            
            const edgeIndices = [ [v1, v2], [v2, v3], [v3, v1] ].map(vertDuple => {
                const edgeVert1 = vertDuple[0];
                const edgeVert2 = vertDuple[1];
                const key = BenchEdge.key(edgeVert1, edgeVert2);
                let resultIndex: number;
                if (edgeMap.has(key)) {
                    // Return Unique Edge
                    resultIndex = edgeMap.get(key)!;
                    const edgeTuple = edgeTuples[resultIndex];
                    // The Attach New face be Current Face Index
                    if (edgeTuple[2] === -1) edgeTuple[2] = faceIndex;
                    else if (edgeTuple[3] === -1) edgeTuple[3] = faceIndex;
                    else {
                        console.warn("Edge already has two faces!", faceIndex, edgeTuple);
                    }
                } else {
                    // New Edge
                    resultIndex = edgeTuples.length;
                    edgeMap.set(key, resultIndex);
                    edgeTuples.push([
                        Math.min(edgeVert1, edgeVert2), 
                        Math.max(edgeVert1, edgeVert2), 
                        faceIndex, -1
                    ]);
                }
                
                // Relate Egde to Vertex
                vertDuple.forEach(vertIndex => {
                    vertEdgeSets[vertIndex].add(resultIndex);
                });
                return resultIndex;
            }) as Truple;

            face.indices = indices;
            face.vertIndices = vertIndices;
            face.edgeIndices = edgeIndices;

        }

        // Create Meta Data for Vert
        const vertMetaTuples: Array<[number, number]> = new Array();
        let pointer: number = 0;
        for (const edgeSet of vertEdgeSets) {
            const size = edgeSet.size;
            vertMetaTuples.push([pointer, size]);
            pointer += size;
        }

        // Fill flat Vert Edges Array
        this.vertEdgesPool = new IntArrConstructor(pointer);
        pointer = 0;
        for (const edgeSet of vertEdgeSets) {
            for (const edgeIndex of edgeSet) {
                this.vertEdgesPool[pointer++] = edgeIndex;
            }
        }

        // Construct flat metaAttr
        this.vertMetaAttr = new BufferAttribute(
            new IntArrConstructor(vertMetaTuples.flat()), 
            BenchVertex.META_SIZE
        );
        
        // Construct flat edgeAttr
        this.edgeAttr =  new BufferAttribute(
            new IntArrConstructor(edgeTuples.flat()), 
            BenchEdge.DATA_SIZE
        );

        return this;
    }

    public faceAt(index: number): BenchFace {
        return new BenchFace(this, index);
    }

    public edgeAt(index: number): BenchEdge {
        return new BenchEdge(this, index);
    }

    public vertAt(index: number): BenchVertex {
        return new BenchVertex(this, index);
    }

    public faceGeometryAt(index: number): IndexedBufferGeometry {
        this.assertSourceGeometry();
        return this.faceAt(index).geometry();
    }

    public triAt(index: number): Triangle {
        this.assertSourceGeometry();
        return this.faceAt(index).tri();
    }

    public planeAt(index: number): Plane {
        const tri = this.triAt(index);
        return new Plane().setFromCoplanarPoints(tri.a, tri.b, tri.c);
    }

    public neighborsOf(index: number): Set<number> {
        const face = this.faceAt(index);
        const neighbors = new Set<number>();
        for (const edge of face.edges()) {
            const neighbor = edge.otherFaceOf(index);
            if (neighbor) neighbors.add(neighbor);
        }
        return neighbors;
    }

    public isManifold(): boolean {
        for (let index = 0; index < this.edgeAttr.count; index++) {
            if (!this.edgeAt(index).isManifold) return false;
        }
        return true;
    }

    public getBoundaryEdge(): Array<number> {
        const boundaries = new Array<number>;
        for (let index = 0; index < this.edgeAttr.count; index++) {
            const edge = this.edgeAt(index);
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

}

function derefer<BR extends BenchReferer>(subIndice: Iterable<number>, creator: ReferCreator<BR>): Set<BR> {
    const result = new Set<BR>();
    for (const index of subIndice) {
        result.add(creator(index));
    }
    return result;
}

export type {
    BenchVertex,
    BenchEdge,
    BenchFace
}

export {
    BenchSubGeometry,
    BenchGeometry
}