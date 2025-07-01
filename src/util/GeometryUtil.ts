import { 
    BufferAttribute, 
    BufferGeometry, 
    Group, 
    Mesh, 
    Triangle, 
    Vector2, 
    Vector3, 
    WireframeGeometry, 
    type Face, 
} from "three";
import { mergeBufferGeometries } from "three-stdlib";
import GeometryWorker from '../worker/GeometryWorker?worker';
type GeometryFunctionName = keyof typeof GeometryUtil;

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

    public static of(geometry: BufferGeometry, face: Face) {
        return new BenchTriangle(geometry, face);
    }
}

class GeometryUtil {

    public static extractGeometry(loadedObj: Group): BufferGeometry | null {
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

    public static createWireframe(geometry: BufferGeometry): WireframeGeometry {
        return new WireframeGeometry(geometry);
    }

    private static isUniqueEdge(start: Vector3, end: Vector3, edges: Set<string>) {
        const hash1 = `${start.x},${start.y},${start.z}-${end.x},${end.y},${end.z}`;
        const hash2 = `${end.x},${end.y},${end.z}-${start.x},${start.y},${start.z}`;
        if (edges.has(hash1) === true || edges.has(hash2) === true) {
            return false;
        } else {
            edges.add(hash1);
            edges.add(hash2);
            return true;
        }
    }

    public static async run<T = any>(fn: GeometryFunctionName, ...payload: any[]): Promise<T> {
        const worker = new GeometryWorker();
        return new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                if (e.data.error)
                    reject(e.data.error);
                else 
                    resolve(GeometryUtil.reconstructionOf(e.data.result));
                
            };

            worker.onerror = reject;

            worker.postMessage({ 
                fn, payload 
            });
        });
    }

    public static isSerializedGeometry(obj: any): boolean {
        return obj &&
            typeof obj === 'object' && obj.attributes &&
            obj.attributes.position &&
            obj.attributes.position.array instanceof Float32Array &&
            typeof obj.attributes.position.itemSize === 'number';
    }

    public static geometryOf(src: BufferGeometry) {
        const geometry = new BufferGeometry();
        const position = src.attributes.position;
        const normal = src.attributes.normal;
        const index = src.attributes.index;

        if (position)
            geometry.attributes.position = new BufferAttribute(
                new Float32Array(position.array), position.itemSize);

        if (normal)
            geometry.attributes.normal = new BufferAttribute(
                new Float32Array(normal.array), normal.itemSize);

        if (index) 
            geometry.setIndex(new BufferAttribute(
                new Uint16Array(index.array), 1));
        return geometry;
    }

    public static reconstructionOf(data: any) {
        if (GeometryUtil.isSerializedGeometry(data)) {
            return GeometryUtil.geometryOf(data);
        }
        return data;
    }

    public static reconstruct(payload: any[]) {
        payload.forEach((value, index) => {
            payload[index] = GeometryUtil.reconstructionOf(value);
        })
    }
}




export type {
    GeometryFunctionName
}

export {
    GeometryUtil,
    BenchTriangle
}
