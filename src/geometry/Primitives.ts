import {
    BoxGeometry, 
    SphereGeometry, 
    CylinderGeometry, 
    PlaneGeometry, 
    ConeGeometry, 
    TorusGeometry, 
    TorusKnotGeometry,
    TubeGeometry, 
    CircleGeometry, 
    RingGeometry, 
    DodecahedronGeometry, 
    IcosahedronGeometry, 
    OctahedronGeometry,
    TetrahedronGeometry, 
    PolyhedronGeometry, 
    LatheGeometry, 
    ShapeGeometry, 
    ExtrudeGeometry,
    CapsuleGeometry,
    CatmullRomCurve3,
    Vector3,
    BufferGeometry,
    BufferAttribute,
    Triangle
} from 'three';
import type { EdgeLoop } from './SubGeometries';
import type { BenchEdge, BenchFace, BenchVertex, IndexIterable } from './BenchGeometry';
import { GeometryUtil } from './GeometryUtil';
interface IndexedBufferGeometry extends BufferGeometry {
    index: BufferAttribute;
}

class PointGeometry extends BufferGeometry {
    constructor(pos: Vector3) {
        super();
        const positions = new Float32Array(3);
        pos.toArray(positions);
        this.attributes.position = new BufferAttribute(positions, 3);
        this.index
    }
}

class VerticesGeometry extends BufferGeometry {
    constructor(verts: IndexIterable<BenchVertex>) {
        super();
        const positions = new Float32Array(verts.size * 3);
        let index = 0;
        for (const vert of verts.fetch()) {
            positions.set(vert.pos().toArray(), index * 3);
            index++;
        }

        this.attributes.position = new BufferAttribute(positions, 3);
    }
}

class LineSegmentGeometry extends BufferGeometry implements IndexedBufferGeometry {
    declare public index: BufferAttribute;
    constructor(a: Vector3, b: Vector3) {
        super();
        const positions = new Float32Array(6);
        positions.set(a.toArray().concat(b.toArray()), 0);
        this.attributes.position = new BufferAttribute(positions, 3);
        this.setIndex([1, 2]);
    }
}

class EdgesGeometry extends BufferGeometry implements IndexedBufferGeometry {
    declare public index: BufferAttribute;
    constructor(edges: IndexIterable<BenchEdge>) {
        super();
        const positions = new Float32Array(edges.size * 2 * 3);
        let pointer = 0;
        for (const edge of edges.fetch()) {
            for (const vert of edge.verts()) {
                vert.pos().toArray(positions, pointer);
                pointer += 3;
            }
        }
        this.attributes.position = new BufferAttribute(positions, 3);
        this.setIndex(GeometryUtil.createSequentialIndicesAttr(edges.size * 2));
    }
}

class TriangleGeometry extends BufferGeometry implements IndexedBufferGeometry {
    declare public index: BufferAttribute;
    constructor(tri: Triangle) {
        super();
        this.setFromPoints([tri.a, tri.b, tri.c]);
        this.setIndex([0, 1, 2]);
    }
}

class FacesGeometry extends BufferGeometry implements IndexedBufferGeometry {
    declare public index: BufferAttribute;
    constructor(faces: IndexIterable<BenchFace>) {
        super();
        const positions = new Float32Array(faces.size * 9);
        let pointer = 0;
        for (const face of faces.fetch()) {
            const tri = face.tri();
            tri.a.toArray(positions, pointer);
            tri.b.toArray(positions, pointer += 3);
            tri.c.toArray(positions, pointer += 3);
            pointer += 3;
        }

        this.attributes.position = new BufferAttribute(positions, 3);
        this.setIndex(GeometryUtil.createSequentialIndicesAttr(faces.size * 3));
    }
}

class Primitives {
    static box = (...args: ConstructorParameters<typeof BoxGeometry>) => new BoxGeometry(...args);
    static sphere = (...args: ConstructorParameters<typeof SphereGeometry>) => new SphereGeometry(...args);
    static cylinder = (...args: ConstructorParameters<typeof CylinderGeometry>) => new CylinderGeometry(...args);
    static plane = (...args: ConstructorParameters<typeof PlaneGeometry>) => new PlaneGeometry(...args);
    static cone = (...args: ConstructorParameters<typeof ConeGeometry>) => new ConeGeometry(...args);
    static torus = (...args: ConstructorParameters<typeof TorusGeometry>) => new TorusGeometry(...args);
    static torusKnot = (...args: ConstructorParameters<typeof TorusKnotGeometry>) => new TorusKnotGeometry(...args);
    static tube = (...args: ConstructorParameters<typeof TubeGeometry>) => new TubeGeometry(...args);
    static circle = (...args: ConstructorParameters<typeof CircleGeometry>) => new CircleGeometry(...args);
    static ring = (...args: ConstructorParameters<typeof RingGeometry>) => new RingGeometry(...args);
    static dodecahedron = (...args: ConstructorParameters<typeof DodecahedronGeometry>) => new DodecahedronGeometry(...args);
    static icosahedron = (...args: ConstructorParameters<typeof IcosahedronGeometry>) => new IcosahedronGeometry(...args);
    static octahedron = (...args: ConstructorParameters<typeof OctahedronGeometry>) => new OctahedronGeometry(...args);
    static tetrahedron = (...args: ConstructorParameters<typeof TetrahedronGeometry>) => new TetrahedronGeometry(...args);
    static polyhedron = (...args: ConstructorParameters<typeof PolyhedronGeometry>) => new PolyhedronGeometry(...args);
    static lathe = (...args: ConstructorParameters<typeof LatheGeometry>) => new LatheGeometry(...args);
    static shape = (...args: ConstructorParameters<typeof ShapeGeometry>) => new ShapeGeometry(...args);
    static extrude = (...args: ConstructorParameters<typeof ExtrudeGeometry>) => new ExtrudeGeometry(...args);
    static capsule = (...args: ConstructorParameters<typeof CapsuleGeometry>) => new CapsuleGeometry(...args);

    static point = (...args: ConstructorParameters<typeof PointGeometry>) => new PointGeometry(...args);
    static line = (...args: ConstructorParameters<typeof LineSegmentGeometry>) => new LineSegmentGeometry(...args);
    static tri = (...args: ConstructorParameters<typeof TriangleGeometry>) => new TriangleGeometry(...args);
    
    static verts = (...args: ConstructorParameters<typeof VerticesGeometry>) => new VerticesGeometry(...args);
    static edges = (...args: ConstructorParameters<typeof EdgesGeometry>) => new EdgesGeometry(...args);
    static faces = (...args: ConstructorParameters<typeof FacesGeometry>) => new FacesGeometry(...args);

    static tubeFromLoop(loop: EdgeLoop, options: { 
        tubularSegments?: number; 
            radius?: number; 
            radialSegments?: number;
            closed?: boolean;
        } = {}
    ): TubeGeometry {
        const {
            tubularSegments = loop.length * 4,
            radius = 0.1,
            radialSegments = 8,
            closed = true,
        } = options;    
        const points = loop.fetch().map((v) => v.pos());
        const curve = new CatmullRomCurve3(points, closed);
        return new TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
    }

}

export type {
    IndexedBufferGeometry
}

export {
    Primitives
}