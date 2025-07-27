import {  
    DoubleSide, 
    Group, 
    LineBasicMaterial, 
    LineSegments, 
    Mesh, 
    MeshBasicMaterial,
    Points,
    PointsMaterial,  
} from "three";
import { GeometryUtil } from "../util/GeometryUtil";
import type { BenchIntersection, BenchMesh } from "../scene/BenchModel";
import { type BenchSubGeometry } from "../util/SubGeometries";


class Selection extends Group {
    public readonly face: SelectedFace;
    public readonly isect: BenchIntersection;
    public coplane?: SelectedPlane;
    public readonly benchMesh: BenchMesh;
    constructor(intersection: BenchIntersection) {
        super();
        this.isect = intersection;
        this.benchMesh = intersection.benchMesh;
        this.face = new SelectedFace(intersection);
        this.add(this.face);
    }

    public createCoplane() {
        if (this.coplane) this.remove(this.coplane);
        this.coplane = new SelectedPlane(this.isect);
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
            // this.geometry = benchMesh.faceGeometryAt(isect.faceIndex); 
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
        this.geometry = this.subGeom.getPlainGeometry();
        const edgeLoop = this.subGeom.getEdgeLoop().optimize();
        const boundary = new LineSegments(
            GeometryUtil.createEdgeLoopGeometry(edgeLoop), 
            new LineBasicMaterial({ color: 0xFF00FF })
        );
        boundary.renderOrder = 1;

        const vertMesh = new Points(
            GeometryUtil.createVerticesGeometry(edgeLoop),
            new PointsMaterial({
                color: 0xff44aa,
                size: 0.2,
                sizeAttenuation: true,
            })
        );
        vertMesh.renderOrder = 1;
        this.add(boundary);
        this.add(vertMesh);
        this.visible = true;
    }

}

export {
    Selection
}