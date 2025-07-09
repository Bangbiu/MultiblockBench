import {  
    DoubleSide, 
    Group, 
    Mesh, 
    MeshBasicMaterial,  
} from "three";
import { GeometryUtil } from "../util/GeometryUtil";
import type { BenchIntersection, BenchMesh } from "../scene/BenchModel";
import type { BenchSubGeometry } from "../util/BenchGeometry";


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
    constructor(isect: BenchIntersection) {
        super();
        const [ color, opacity ] = window.config.selection.faceColor;
        this.material = new MeshBasicMaterial({
                color: color, 
                side: DoubleSide,
                transparent: true,
                opacity: opacity
            });
        const benchMesh = isect.benchMesh;
        if (isect.faceIndex) {
            // Create triangle geometry
            //this.geometry = benchMesh.faceGeometryAt(isect.faceIndex); 
            this.geometry = benchMesh.geometry.faceGeometryAt(isect.faceIndex);
        }

        this.visible = true;
    }
}

class SelectedPlane extends Mesh  {
    public subGeom: BenchSubGeometry;
    constructor(isect: BenchIntersection) {
        const [ color, opacity ] = window.config.selection.coplaneColor;
        super();
        this.material = new MeshBasicMaterial({
                color: color, 
                side: DoubleSide,
                transparent: true,
                opacity: opacity
            });
        const benchMesh = isect.benchMesh;
        this.subGeom = GeometryUtil.createCoplane(benchMesh.geometry, isect.faceIndex!);
        this.geometry = this.subGeom.bareGeom;
        this.visible = true;
    }

}

export {
    Selection
}