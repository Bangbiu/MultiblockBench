import { 
    BufferGeometry, 
    DoubleSide, 
    Group, 
    Mesh, 
    MeshBasicMaterial,  
} from "three";
import { BenchTriangle, GeometryUtil } from "../util/GeometryUtil";
import type { BenchIntersection, BenchMesh } from "../scene/BenchModel";


class Selection extends Group {
    public readonly face: SelectedFace;
    public readonly coplane: SelectedPlane;
    public readonly mesh: BenchMesh;
    constructor(intersection: BenchIntersection) {
        super();
        this.mesh = intersection.mesh;

        this.face = new SelectedFace(intersection);
        this.coplane = new SelectedPlane(intersection);

        this.add(this.face);
        this.add(this.coplane);
    }
}

class SelectedFace extends Mesh {
    constructor(intersection: BenchIntersection) {
        super();
        const [ color, opacity ] = window.config.selection.faceColor;
        this.material = new MeshBasicMaterial({
                color: color, 
                side: DoubleSide,
                transparent: true,
                opacity: opacity
            });
        const isect = intersection.isect;
        const srcMesh = isect.object as Mesh;
        if (srcMesh.isMesh && isect.face) {
            // Create triangle geometry
            const tri = BenchTriangle.of(srcMesh.geometry, isect.face);
            this.geometry = tri.createGeometry();
        }

        this.visible = true;
    }
}

class SelectedPlane extends Mesh  {
    constructor(intersection: BenchIntersection) {
        const [ color, opacity ] = window.config.selection.coplaneColor;
        super(new BufferGeometry(), 
            new MeshBasicMaterial({
                color: color, 
                side: DoubleSide,
                transparent: true,
                opacity: opacity
            }));

        const isect = intersection.isect;
        if (!isect.faceIndex) return;
        const srcMesh = isect.object as Mesh;
        if (!srcMesh.isMesh) return;
        //this.geometry = GeometryUtil.createCoplanar(srcMesh.geometry, isect.faceIndex);
        this.geometry = GeometryUtil.createCoplanar(srcMesh.geometry, isect.faceIndex);
        this.visible = true;
    }
}

export {
    Selection
}