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
    Triangle,
    Plane,
    Box2,
    Vector2
} from 'three';
import { Coplane, type EdgeLoop } from './SubGeometries';
import type { BenchEdge, BenchFace, BenchVertex, ReferIterable } from './BenchGeometry';
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
    constructor(verts: ReferIterable<BenchVertex>) {
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
    constructor(edges: ReferIterable<BenchEdge>) {
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
    constructor(faces: ReferIterable<BenchFace>) {
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

/**
 * Stores:
 *  - attributes.position: 3D positions (indexed, unique)
 *  - attributes.pos2d:    2D positions flattened onto the plane (itemSize = 2)
 *  - index:               triangle indices
 *  - .plane:              the THREE.Plane the coplane lies on
 */
class CoplaneGeometry extends BufferGeometry implements IndexedBufferGeometry {
    declare public index: BufferAttribute;
    public plane!: Plane;
    public boundingBox2D!: Box2;

    /** Custom attribute name for in-plane 2D coords */
    public static readonly ATTR_POS2D = "pos2d";

    constructor(coplane: Coplane) {
        super();

        // 1) Early out: empty selection
        if (coplane.size === 0) {
            this.plane = new Plane(new Vector3(0, 0, 1), 0);
            this.boundingBox2D = new Box2();
            // keep empty geometry
            return;
        }

        // 2) Gather triangles’ 3D positions
        const faceCount = coplane.size;
        const positions = new Float32Array(faceCount * 9);
        const uvs = new Float32Array(faceCount * 6);
        let ptr = 0;

        for (const face of coplane.fetch()) {
            face.uvCoords(uvs, ptr * 6);
            face.tri().toArray(positions, ptr * 9);
            ptr++;
        }

        this.attributes.position = new BufferAttribute(positions, 3);
        this.attributes.uv = new BufferAttribute(uvs, 2);
        this.setIndex(GeometryUtil.createSequentialIndicesAttr(faceCount * 3));

        this.projectOn(coplane.plane);

        // Optional niceties
        this.computeVertexNormals();
        this.computeBoundingSphere();
    }

    public get pos2DAttr() {
        return this.getAttribute(CoplaneGeometry.ATTR_POS2D);
    }

    public projectOn(plane: Plane): void {
        this.plane = plane;
        // in-plane ONB
        const n = this.plane.normal.clone().normalize();
        // robust tangent selection
        const pick = Math.abs(n.x) > 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
        const tangent = new Vector3().crossVectors(n, pick).normalize();
        const bitangent = new Vector3().crossVectors(n, tangent).normalize();

        // Project unique positions to plane & store pos2d
        const posAttr = this.attributes.position as BufferAttribute;
        const pos2dArr = new Float32Array(posAttr.count * 2);
        const pos3d = new Vector3();
        const pos2d = new Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            pos3d.fromBufferAttribute(posAttr, i);
            // Project to plane, then to 2D basis
            this.plane.projectPoint(pos3d, pos2d);
            pos2dArr[i * 2 + 0] = pos2d.dot(tangent);
            pos2dArr[i * 2 + 1] = pos2d.dot(bitangent);
        }

        this.setAttribute(CoplaneGeometry.ATTR_POS2D, new BufferAttribute(pos2dArr, 2));
        this.computeBoundingBox2D();
    }

    public computeBoundingBox2D(): void {
        this.boundingBox2D = new Box2();
        const point2D = new Vector2();
        for (let i = 0; i < this.pos2DAttr.count; i++) {
            point2D.fromBufferAttribute(this.pos2DAttr as BufferAttribute, i);
            this.boundingBox2D.expandByPoint(point2D);
        }
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

    static coplane = (...args: ConstructorParameters<typeof CoplaneGeometry>) => new CoplaneGeometry(...args);

    static tubeFromLoop(loop: EdgeLoop, options: { 
        tubularSegments?: number; 
            radius?: number; 
            radialSegments?: number;
            closed?: boolean;
        } = {}
    ): TubeGeometry {
        const {
            tubularSegments = loop.size * 4,
            radius = 0.1,
            radialSegments = 8,
            closed = true,
        } = options;    
        const points = loop.fetch(v => v.pos());
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