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
import { BenchSubGeometry } from "../util/SubGeometries";
import type { BenchIntersection } from "../scene/BenchModel";


class Selection extends Group {
    public subGeometry?: BenchSubGeometry;
    public index?: number;
    public faces?: Mesh;
    public edges?: LineSegments;
    public verts?: Points;
    constructor() {
        super();
        this.renderOrder = 1;
        this.selectCoplane = this.selectCoplane.bind(this);
    }

    public get available() { return this.subGeometry !== undefined; }

    public setFacesMesh() {
        if (this.subGeometry === undefined) return;
        const [ color, opacity ] = window.config.selection.faceColor;
        const material = new MeshBasicMaterial({
                color: color, 
                side: DoubleSide,
                transparent: true,
                opacity: opacity
            });
        const geometry = this.subGeometry.getPlainGeometry();
        this.faces = new Mesh(geometry, material);
        this.add(this.faces);
    }

    public setVertsMesh() {
        if (this.subGeometry === undefined) return;
        const edgeLoop = this.subGeometry.getEdgeLoop();
        this.edges = new LineSegments(
            GeometryUtil.createEdgeLoopGeometry(edgeLoop), 
            new LineBasicMaterial({ color: 0xFF00FF })
        );
        this.verts = new Points(
            GeometryUtil.createVerticesGeometry(edgeLoop),
            new PointsMaterial({
                color: 0xff44aa,
                size: 0.2,
                sizeAttenuation: true,
            })
        );
        this.add(this.edges);
        this.add(this.verts);
    }

    public refresh() {
        this.clear();
        this.setFacesMesh();
        this.setVertsMesh();
    }

    public selectByIsect(isect: BenchIntersection) {
        this.subGeometry = new BenchSubGeometry(isect.benchMesh.geometry);
        this.subGeometry.add(isect.faceIndex);
        this.index = isect.faceIndex;
        this.refresh();
    }

    public selectCoplane() {
        if (!this.available) return;
        const subGeom = this.subGeometry!;
        subGeom.clear();
        GeometryUtil.createCoplane(
            subGeom.parent,
            this.index!,
            subGeom
        );
        this.refresh();
    }
}

export {
    Selection
}