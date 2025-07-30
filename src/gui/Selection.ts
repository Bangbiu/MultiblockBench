import {  
    Group, 
    LineBasicMaterial, 
    LineSegments,  
    Mesh, 
    Points,
    PointsMaterial,  
} from "three";
import { GeometryUtil } from "../geometry/GeometryUtil";
import { BenchSubGeometry } from "../geometry/SubGeometries";
import type { BenchIntersection, BenchMesh } from "../scene/BenchModel";
import { BenchFace } from "../geometry/BenchGeometry";

class Selection extends Group {
    public mesh?: BenchMesh;
    public baseFace?: BenchFace;
    public faceMesh: Mesh;
    public coplaneMesh: Mesh;
    public subGeometry?: BenchSubGeometry;
    public edges?: LineSegments;
    public verts?: Points;
    constructor() {
        super();

        this.faceMesh = new Mesh();
        this.faceMesh.material = window.config.referer.face_mat;
        
        this.coplaneMesh = new Mesh();
        this.coplaneMesh.material = window.config.referer.face_mat;

        this.add(this.faceMesh);
        this.add(this.coplaneMesh);

        this.renderOrder = 1;
        this.selectCoplane = this.selectCoplane.bind(this);
    }

    public get unavailable() { return this.baseFace === undefined; }

    public setVertsMesh() {
        if (this.subGeometry === undefined) return;
        this.add(this.subGeometry.createObject3D());
    }

    public refresh() {
        if (this.unavailable) return;
        this.faceMesh.geometry = this.baseFace!.geometry();
    }

    public selectByIsect(isect: BenchIntersection) {
        const mesh = isect.benchMesh;
        this.mesh = mesh;
        this.baseFace = new BenchFace(mesh.geometry, isect.faceIndex);
        this.subGeometry = new BenchSubGeometry(mesh.geometry, [isect.faceIndex]);
        this.setVertsMesh();
        this.refresh();
    }

    public selectCoplane() {
        if (this.unavailable) return;
    }
}

export {
    Selection
}