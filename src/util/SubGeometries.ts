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


class BenchSubGeometry extends IndexSet<BenchFace> {
    constructor(parent: BenchGeometry, faceIndices?: NullableNumIterable) {
        super(parent, BenchFace, faceIndices);
    }

    public getPlainGeometry() {
        return GeometryUtil.createPlainGeometry(this);
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

}

class VertexNode extends BenchVertex {
    private _next!: VertexNode;
    constructor(parent: BenchGeometry, index: number, next?: VertexNode) {
        super(parent, index);
        if (next) this._next = next;
    }

    public get next() { return this._next; }

    public static readonly Setter = class {
        static setNext(node: VertexNode, next: VertexNode) {
            node._next = next;
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
        for (let i = 0; i < this.lastIndex - 1; i++) {
            chainArr.push(new VertexNode(this.parent, this[i]));
        }

        chainArr.forEach((node, index) => {
            const nextIndex = index === chainArr.length - 1 ? 0 : index + 1;
            VertexNode.Setter.setNext(node, chainArr[nextIndex]);
        })
        return chainArr[0];
    }

    public optimize(): this {
        const optimized = new Array<number>();
        if (this.length < 4) return this;
        console.log(this.length);
        const head = this.chain();
        // Consider Element 0 is at the middle of the line - Find the Next Starting
        let forwardLine = Line3D.fromPoints(head.pos(), head.next.pos());
        const start = EdgeLoop.findNextEndPoint(forwardLine, head.next);
        
        if (!start) return this;
        
        optimized.push(head.index);
        optimized.push(start.index);
        let node = start;
        do {
            forwardLine = Line3D.fromPoints(node.pos(), node.next.pos());
            const endPoint = EdgeLoop.findNextEndPoint(forwardLine, node.next);
            if (!endPoint) return this;
            node = endPoint;
            optimized.push(node.index);
            if (optimized.length >= this.length) return this;
        } while (node !== start);
        

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
}


export {
    EdgeLoop,
    BenchSubGeometry,
}