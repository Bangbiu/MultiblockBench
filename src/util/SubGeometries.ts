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
    type IndexedBufferGeometry 
} from "./GeometryUtil";


class BenchSubGeometry extends IndexSet<BenchFace> {
    protected _plainGeometry?: IndexedBufferGeometry;
    protected _bounds?: IndexSet<BenchEdge>;
    protected _edgeLoop?: EdgeLoop;
    constructor(parent: BenchGeometry, faceIndices?: NullableNumIterable) {
        super(parent, BenchFace, faceIndices);
    }

    public get plainGeometry() {
        if (!this._plainGeometry) 
            this._plainGeometry = GeometryUtil.createPlainGeometry(this);
        return this._plainGeometry;
    }

    public get bounds(): IndexSet<BenchEdge> {
        if (!this._bounds) {
            const bounds = this.parent.indexSetOf(BenchEdge);
            for (const face of this.fetch()) {
                for (const edge of face.edges()) {
                    const [f1, f2] = edge.faceIndices;
                    if (!this.has(f1) || !this.has(f2)) 
                        bounds.add(edge.index);
                }
            }
            this._bounds = bounds;
        }
        return this._bounds;
    }

    public get edgeLoop(): EdgeLoop {
        if (!this._edgeLoop) 
            this._edgeLoop = new EdgeLoop(this.bounds);
        return this._edgeLoop;
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
}


export {
    EdgeLoop,
    BenchSubGeometry,
}