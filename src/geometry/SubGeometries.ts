import { BufferGeometry, Group, LineSegments, Mesh,  Plane, Points } from "three";
import { 
    BenchEdge, 
    BenchFace, 
    BenchGeometry, 
    BenchVertex, 
    IndexArray, 
    IndexSet
} from "./BenchGeometry";

import { 
    GeometryUtil,
    Line3D,
} from "./GeometryUtil";
import { Primitives } from "./Primitives";

class ReferMesh extends Mesh {
    public readonly boundary: LineSegments;
    public readonly verts: Points;
    constructor() {
        super();
        this.boundary = new LineSegments();
        this.boundary.material = window.config.referer.edge_mat;
        this.add(this.boundary);

        this.verts = new Points();
        this.verts.material = window.config.referer.vert_mat;
        this.add(this.verts);
    }
}

class BenchSubGeometry extends IndexSet<BenchFace> {
    constructor(parent: BenchGeometry, faceIndices?: NullableNumIterable) {
        super(parent, BenchFace, faceIndices);
    }

    public getBounds(): IndexSet<BenchEdge> {
        const bounds = this.parent.indexSetOf(BenchEdge);
        for (const face of this.fetch()) {
            for (const edge of face.edges()) {
                const [f1, f2] = edge.faceIndices;
                if (!this.has(f1) || !this.has(f2)) 
                    bounds.add(edge.index);
            }
        }
        return bounds;
    }

    public getEdgeLoop(): EdgeLoop {
        return new EdgeLoop(this.getBounds());
    }

    
    public override geometry() {
        return GeometryUtil.createPlainGeometry(this);
    }


    public override createObject3D(): ReferMesh {
        const mesh = new ReferMesh();
        const edgeLoop = this.getEdgeLoop().optimize();
        mesh.boundary.geometry = GeometryUtil.createEdgeLoopGeometry(edgeLoop);
        mesh.verts.geometry = edgeLoop.geometry();
        return mesh;
    }

}

class VertexNode extends BenchVertex {
    private _prev!: VertexNode;
    private _next!: VertexNode;
    constructor(parent: BenchGeometry, index: number) {
        super(parent, index);
    }

    public get prev() { return this._prev; }
    public get next() { return this._next; }

    public static readonly Setter = class {
        static setNext(node: VertexNode, next: VertexNode) {
            node._next = next;
        }

        static setPrev(node: VertexNode, prev: VertexNode) {
            node._prev = prev;
        }
    }
}

class EdgeLoop extends IndexArray<BenchVertex> {
    constructor(bounds: IndexSet<BenchEdge>) {
        super(bounds.parent, BenchVertex);
        // Step 1: Build adjacency from vertex -> [connected vertex]
        const adjacency = new Map<number, Set<number>>();
        const boundEdges = bounds.fetch();
        for (const edge of boundEdges) {
            const [v1, v2] = [edge.a, edge.b];
            if (!adjacency.has(v1)) adjacency.set(v1, new Set());
            if (!adjacency.has(v2)) adjacency.set(v2, new Set());
            adjacency.get(v1)!.add(v2);
            adjacency.get(v2)!.add(v1);
        }

        // Step 2: Pick a start vertex (any endpoint with valency == 1 or arbitrary)
        let start: number = -1;
        for (const edge of boundEdges) {
            start = edge.a;
            break;
        }

        if (start === -1) return;

        // Step 3: Walk the loop
        this.push(start);
        const visitedEdges = new Set<string>();
        let current = start;

        do {
            const neighbors = adjacency.get(current);
            if (!neighbors || neighbors.size === 0) break;

            // Pick next unvisited neighbor
            let next = -1;
            for (const neighbor of neighbors) {
                const key = BenchEdge.key(current, neighbor);
                if (!visitedEdges.has(key)) {
                    next = neighbor;
                    visitedEdges.add(key);
                    break;
                }
            }

            if (next === -1) break;

            this.push(next);
            current = next;
        } while (current !== start);
    }

    public chain(): VertexNode {
        const chainArr = new Array<VertexNode>();
        for (let i = 0; i < this.lastIndex; i++) {
            chainArr.push(new VertexNode(this.parent, this[i]));
        }

        chainArr.forEach((node, index) => {
            const prevIndex = index === 0 ? chainArr.length - 1 : index - 1;
            const nextIndex = index === chainArr.length - 1 ? 0 : index + 1;
            VertexNode.Setter.setPrev(node, chainArr[prevIndex]);
            VertexNode.Setter.setNext(node, chainArr[nextIndex]);
        })
        return chainArr[0];
    }

    public optimize(): this {
        const optimized = new Array<number>();
        if (this.length < 4) return this;
        const head = this.chain();
        let node = head;

        do {
            const prev = node.prev.pos();
            const curr = node.pos();
            const next = node.next.pos();

            const dir1 = prev.sub(curr).normalize();
            const dir2 = next.sub(curr).normalize();

            if (dir1.cross(dir2).lengthSq() > 1e-2) {
                optimized.push(node.index);
            }
            node = node.next;
        } while (node !== head);
        //Circular
        optimized.push(optimized[0]);
        // console.log(this.length + "->" + optimized.length);
        // Replace the current content with optimized version
        this.length = 0;
        this.push(...optimized);
        return this;
    }

    public static findNextEndPoint(line: Line3D, node: VertexNode) {
        const head = node;
        while (line.contains(node.next.pos())) {
            // Full Loop
            if (node.next === head) return undefined;
            node = node.next; 
        }
        return node;
    }

    public positions() {
        const positions = this.fetch().map((v) => v.pos());
        positions.pop();// Exclude Redundant tail
        return positions;
    }
}

class Coplane extends BenchSubGeometry {
    constructor(baseFace: BenchFace) {
        super(baseFace.parent);
        const basePlane = baseFace.tri().getPlane(new Plane());
        const visited = new Set<number>();
        const toVisit = [baseFace.index];

        while (toVisit.length > 0) {
            const curIndex = toVisit.pop()!;
            if (visited.has(curIndex)) continue;
            visited.add(curIndex);

            const curTri = this.parent.triAt(curIndex)
            const coplanar = GeometryUtil.isCoplanar(curTri, basePlane);
            
            if (!coplanar) {
                continue;
            }

            // Add original triangle indices
            this.add(curIndex);

            for (const neighborIndex of this.parent.neighborsOf(curIndex)) {
                if (neighborIndex === undefined) continue;
                if (visited.has(neighborIndex)) continue;
                toVisit.push(neighborIndex);
            }
        }
    }

}


export {
    EdgeLoop,
    BenchSubGeometry,
    Coplane
}