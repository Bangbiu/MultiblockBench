import { 
    BufferGeometry, 
    DoubleSide, 
    Group, 
    Mesh, 
    MeshBasicMaterial,  
} from "three";
import { EdgeGraph, GeometryUtil } from "../util/GeometryUtil";
import type { BenchIntersection, BenchMesh } from "../scene/BenchModel";


class Selection extends Group {
    public readonly face: SelectedFace;
    public readonly coplane: SelectedPlane;
    public readonly benchMesh: BenchMesh;
    constructor(intersection: BenchIntersection) {
        super();
        this.benchMesh = intersection.benchMesh;

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
        if (srcMesh.isMesh && isect.faceIndex) {
            // Create triangle geometry
            this.geometry = intersection.benchMesh.geometryAt(isect.faceIndex);
        }

        this.visible = true;
    }
}

class SelectedPlane extends Mesh  {
    constructor(intersection: BenchIntersection) {
        const [ color, opacity ] = window.config.selection.coplaneColor;
        super();
        this.material = new MeshBasicMaterial({
                color: color, 
                side: DoubleSide,
                transparent: true,
                opacity: opacity
            });
        const isect = intersection.isect;
        if (!isect.faceIndex) return;
        const srcMesh = isect.object as Mesh;
        if (!srcMesh.isMesh) return;
        this.geometry = GeometryUtil.createCoplanar(
            intersection.benchMesh.edgeGraph, isect.faceIndex);
        this.visible = true;
    }
}

export {
    Selection
}