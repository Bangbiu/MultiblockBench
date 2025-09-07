import {
    ArrowHelper,
    BufferAttribute,
    BufferGeometry,
    LineSegments,
    Mesh,
    Object3D,
    Plane,
    Points,
    Triangle,
    Vector3,
    type TypedArray
} from 'three';
import { GeometryUtil, type IndexedBufferGeometry } from './GeometryUtil';
import { Primitives } from './Primitives';
import { IndexIterable } from '../util/DataUtil';

type EdgeTuple = [number, number, number, number]; // [v1, v2, f1, f2]

interface Object3DProvider {
    geometry(): BufferGeometry;
    createObject3D(): Object3D;
}

interface VertexData {
    canonicIndex: number
    edges: Set<number>
}

interface BenchReferer extends Object3DProvider {
    readonly parent: BenchGeometry
    readonly index: number;    // Starting Index of SubArray
    readonly data: TypedArray; // SubArray of Parent Data Array
}

interface BenchRefererCtor<BR extends BenchReferer> {
    new (parent: BenchGeometry, index: number): BR;
    mergeGeometries(brs: ReferIterable<BR>): BufferGeometry;
    mergeObject3D(brs: ReferIterable<BR>): Object3D;
}

abstract class ReferIterable<BR extends BenchReferer, IT extends Iterable<number> = Iterable<number>> 
extends IndexIterable<BenchRefererCtor<BR>,IT> implements Object3DProvider {
    public readonly parent: BenchGeometry;

    constructor(parent: BenchGeometry, creator: BenchRefererCtor<BR>, container: IT) {
        super(container, creator);
        this.parent = parent;
    }

    public create(brIndex: number) { return new this.creator(this.parent, brIndex); }

    public geometry() { return this.creator.mergeGeometries(this); }
    public createObject3D(): Object3D { return this.creator.mergeObject3D(this); }

    // public abstract collect<U extends BenchReferer>
    // (creator: BenchRefererCtor<U>, callbackfn: (value: BR, index: number) => Iterable<number>): ReferIterable<U>;
}

class ReferArray<BR extends BenchReferer> extends ReferIterable<BR, Array<number>> {
    constructor(parent: BenchGeometry, creator: BenchRefererCtor<BR>, iterable?: NullableNumIterable) {
        super(parent, creator, [...iterable ?? []]);
    }

    public get lastIndex() { return this.container.length - 1; }
    public override get size() { return this.container.length; }

    public override at(index: number): number { return this.container[index]; }
    public override add(...items: Array<number>) { this.container.push(...items); return this; }
    public override append(iterable: Iterable<number>) { this.container.push(...iterable); return this;}
    public override clear(): void  { this.container.length = 0; }
}

class ReferSet<BR extends BenchReferer> extends ReferIterable<BR, Set<number>> {
    constructor(parent: BenchGeometry, creator: BenchRefererCtor<BR>, iterable?: NullableNumIterable) {
        super(parent, creator, new Set(iterable));
    }

    public override get size(): number { return this.container.size; }

    public override add(...items: Array<number>) { return this.append(items); }
    public override append(iterable: Iterable<number>) {
        for (const item of iterable) this.container.add(item);
        return this;
    }
    public override clear(): void { this.container.clear(); }
    public has(value: number) { return this.container.has(value); }
}

/**
 * Bench Vertex
 * 
 * Created from BenchGeometry By 
 * 
 * Elements from Starting Index to Starting Index + 3
 * Described by
 * [ canonicalIndex, dataStartingIndex, dataLength ]
 * Able to create related Bench Edge and BenchFace Instance
 * 
 */
class BenchVertex implements BenchReferer {
    public readonly parent: BenchGeometry;
    public readonly index: number;
    public readonly canonicIndex: number;
    public readonly data: TypedArray;
    public readonly edgeCount: number;
    constructor(parent: BenchGeometry, index: number) {
        this.parent = parent;
        this.index = index;
        this.canonicIndex = parent.vertMetaAttr.getX(index);
        const head = parent.vertMetaAttr.getY(index);
        const rear = head + parent.vertMetaAttr.getZ(index);
        this.data = this.parent.vertEdgesPool
        .subarray(head, rear);
        this.edgeCount = this.data.length;
    }

    public pos(): Vector3 {
        return new Vector3().fromBufferAttribute(
            this.parent.src!.attributes.position, 
            this.canonicIndex
        );
    }

    public to(vert: BenchVertex): Vector3 {
        return new Vector3().subVectors(vert.pos(), this.pos());
    }

    public geometry() {
        return Primitives.point(this.pos());
    }

    public createObject3D(): Points {
        return new Points(this.geometry(), window.config.referer.vert_mat);
    }

    public static keyOf(v: Vector3) {
        return BenchVertex.key(v.x, v.y, v.z);
    }

    public static key(x: number, y: number, z: number) {
        return `${x.toFixed(5)}_${y.toFixed(5)}_${z.toFixed(5)}`;
    }

    public static readonly mergeGeometries = Primitives.verts;
    public static mergeObject3D(verts: ReferIterable<BenchVertex>): Points {
        return new Points(
            BenchVertex.mergeGeometries(verts), 
            window.config.referer.vert_mat
        );
    }

    public static readonly META_SIZE = 3;
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

class BenchEdge implements BenchReferer {
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

    public get vertIndices(): Duple { return [this.a, this.b]; }  
    public get faceIndices(): Duple { return [this.f1, this.f2]; }
    
    public get isManifold(): boolean {
        return this.f1 !== -1 && this.f2 !== -1;
    }

    public verts(): BiData<BenchVertex> {
        return [this.parent.vertAt(this.data[0]),
                this.parent.vertAt(this.data[1])];
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

    public geometry(){
        const [v1, v2] = this.verts();
        return Primitives.line(v1.pos(), v2.pos())
    }

    public createObject3D(): LineSegments {
        return new LineSegments(
            this.geometry(), 
            window.config.referer.edge_mat
        );
    }

    /** Normalized key, for hashing */
    static key(a: number, b: number): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    get key(): string {
        return BenchEdge.key(this.a, this.b);
    }

    public static readonly mergeGeometries = Primitives.edges;
    public static mergeObject3D(edges: ReferIterable<BenchEdge>): LineSegments {
        return new LineSegments(
            BenchEdge.mergeGeometries(edges), 
            window.config.referer.edge_mat
        );
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

    public setIndices(truple: Truple) { this.data.set(truple, 0); }
    public setEdgeIndices(truple: Truple) { this.data.set(truple, 3); }
    public setVertIndices(truple: Truple) { this.data.set(truple, 6); } 

    public indices(): Readonly<Truple> {
        return [this.data[0], this.data[1], this.data[2]];
    }

    public tri(): Readonly<Triangle> {
        return new Triangle().setFromAttributeAndIndices(
            this.parent.src!.attributes.position, this.a, this.b, this.c
        );
    }

    public plane(): Plane {
        return this.tri().getPlane(new Plane());
    }

    public edges(): ReferSet<BenchEdge> { 
        return this.parent.referSetOf(BenchEdge, this.data.subarray(3, 6)); 
    }

    public verts(): ReferSet<BenchVertex> {
        return this.parent.referSetOf(BenchVertex, this.data.subarray(6, 9)); 
    }

    public neighbors(): ReferSet<BenchFace> {
        return this.parent.referSetOf(BenchFace, 
            this.edges().fetch(edge => edge.otherFaceOf(this.index))
            .filter(element => element !== undefined)
        );
    }

    public normalLine() { return GeometryUtil.createNormalLine(this); }

    public backFace(epsilon = 1e-3): Opt<BenchFace> {
        const otherCenter = new Vector3();
        const otherNormal = new Vector3();
        const normalLine = this.normalLine();
        let result: Opt<BenchFace>;
        let minDist = Infinity;
        for (let i = 0; i < this.parent.faceCount; i++) {
            if (i === this.index) continue;
            const curFace = this.parent.faceAt(i);
            const curTri = curFace.tri();
            curTri.getMidpoint(otherCenter);
            curTri.getNormal(otherNormal);
            if (normalLine.direction.dot(otherNormal) < -1 + epsilon) {
                const dist = normalLine.distanceTo(otherCenter);   // vector from v1 to v2
                if (dist < minDist) {
                    result = curFace;
                    minDist = dist;
                }
            }
        }
        return result;
    }

    public geometry(): IndexedBufferGeometry {
        return Primitives.tri(this.tri());
    }

    public createObject3D(): Object3D {
        const tri = this.tri();
        const center = tri.getMidpoint(new Vector3());
        const normal = tri.getNormal(new Vector3()).normalize();
        const arrow = new ArrowHelper(normal, center, 0.05, 0xff0000, 0.01,0.01);
        const mesh = new Mesh(this.geometry(), window.config.referer.face_mat);
        return mesh.add(arrow);;
    }

    public static readonly mergeGeometries = Primitives.faces;
    public static mergeObject3D(faces: ReferIterable<BenchFace>) {
        return new Mesh(
            BenchFace.mergeGeometries(faces), 
            window.config.referer.face_mat
        );
    }

    public static readonly DATA_SIZE = 9;
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

    public get faceCount(): number {return this.faceAttr.count; }

    public buildFrom(geometry: IndexedBufferGeometry, useUint16 = false): this {
        this.src = geometry;
        const IntArrConstructor = useUint16 ? Uint16Array : Uint32Array;
        const indexAttr = geometry.index;
        const faceCount = indexAttr.count / 3;
        const posAttr = geometry.attributes.position;

        const edgeMap = new Map<string, number>();
        const vertMap = new Map<string, number>();
    
        const edgeTuples: Array<EdgeTuple> = new Array();
        const vertDataList: Array<VertexData> = new Array();

        // Face Initialize
        const faceData = new IntArrConstructor(faceCount * BenchFace.DATA_SIZE);
        const faceAttr = new BufferAttribute(faceData, BenchFace.DATA_SIZE);
        this.faceAttr = faceAttr;
        for (let index = 0; index < indexAttr.count; index += 3) {
            const faceIndex = index / 3;
            const face = this.faceAt(faceIndex);
            
            const a = indexAttr.getX(index);
            const b = indexAttr.getY(index);
            const c = indexAttr.getZ(index);
            
            const indices: Truple = [a, b, c];
            const tempPos = new Vector3();
            const vertIndices = indices.map(posIndex => {
                tempPos.fromBufferAttribute(posAttr, posIndex);
                const key = BenchVertex.keyOf(tempPos);
                if (vertMap.has(key)) {
                    // Return Unique Vertex Index
                    return vertMap.get(key)!;
                } else {
                    // New Vertex
                    const vertIndex = vertDataList.length;
                    vertMap.set(key, vertIndex);
                    // Push PlaceHolder for Edge Set
                    vertDataList.push({
                        canonicIndex: posIndex,
                        edges: new Set()
                    });
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
                    vertDataList[vertIndex].edges.add(resultIndex);
                });
                return resultIndex;
            }) as Truple;

            face.setIndices(indices);
            face.setVertIndices(vertIndices);
            face.setEdgeIndices(edgeIndices);

        }

        // Create Meta Data for Vert
        const vertCount = vertDataList.length;
        const vertMetaArr = new IntArrConstructor(vertCount * BenchVertex.META_SIZE);
        this.vertMetaAttr = new BufferAttribute(vertMetaArr, BenchVertex.META_SIZE);
        let pointer: number = 0;
        for (let vertIndex = 0; vertIndex < vertDataList.length; vertIndex++) {
            const dataIndex = vertIndex * BenchVertex.META_SIZE;
            const size = vertDataList[vertIndex].edges.size;
            vertMetaArr[dataIndex] = vertDataList[vertIndex].canonicIndex;
            vertMetaArr[dataIndex + 1] = pointer;
            vertMetaArr[dataIndex + 2] = size;
            pointer += size;
        }

        // Fill flat Vert Edges Array
        this.vertEdgesPool = new IntArrConstructor(pointer);
        pointer = 0;
        for (const vertData of vertDataList) {
            for (const edgeIndex of vertData.edges) {
                this.vertEdgesPool[pointer++] = edgeIndex;
            }
        }
        
        // Construct flat edgeAttr
        this.edgeAttr =  new BufferAttribute(
            new IntArrConstructor(edgeTuples.flat()), 
            BenchEdge.DATA_SIZE
        );

        return this;
    }

    public faceAt(index: number): BenchFace { return new BenchFace(this, index); }

    public edgeAt(index: number): BenchEdge { return new BenchEdge(this, index); }

    public vertAt(index: number): BenchVertex { return new BenchVertex(this, index); }

    public referSetOf<BR extends BenchReferer>(ctor: BenchRefererCtor<BR>, iterable?: NullableNumIterable): ReferSet<BR> {
        return new ReferSet(this, ctor, iterable);
    }

    public referArrayOf<BR extends BenchReferer>(ctor: BenchRefererCtor<BR>, iterable?: NullableNumIterable): ReferArray<BR> {
        return new ReferArray(this, ctor, iterable);
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
        return this.triAt(index).getPlane(new Plane());
    }

    public neighborsOf(index: number): ReferSet<BenchFace> {
        return this.faceAt(index).neighbors();
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

    public assertSourceGeometry(): asserts this is { src: IndexedBufferGeometry } {
        if (!this.src) throw new Error("Need Source Geometry");
    }

}

export type {
    ReferIterable,
    Object3DProvider
}

export {
    ReferSet,
    ReferArray,
    BenchVertex,
    BenchEdge,
    BenchFace,
    BenchGeometry
}