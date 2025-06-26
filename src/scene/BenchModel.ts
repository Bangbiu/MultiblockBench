import { 
    Group, 
    LineSegments, 
    Mesh, 
    Raycaster,
    Vector3,
} from 'three';

import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import { Intepretors, LoadingUI, type ObjProgIntepretor, type SubEventHandler } from '../gui/Loading';
import { GeometryUtil } from '../util/GeometryUtil';


class BenchModel extends Group {
    public children: Array<BenchMesh>;
    public selected: boolean;
    constructor() {
        super();
        this.children = new Array();
        this.scale.copy(BenchModel.BENCH_SCALE);
        this.selected = false;
    }

    public add(...meshes: Array<BenchMesh>): this {
        super.add(...meshes);
        return this;
    }

    protected fromGroup(group: Group) {
        this.clear();
        group.children.forEach(
            (obj) => {
                if ((obj as Mesh).isMesh) this.add(new BenchMesh(obj as Mesh));
            }
        );
    }

    protected fromObjFile(fileList: ArrangedFiles, eventHandler?: SubEventHandler<ObjProgIntepretor>): void {
        this.clear();
        FileUtil.loadObj(fileList, eventHandler).then(
            (group) => this.fromGroup(group)
        );
    }

    protected createWireframe(eventHandler?: SubEventHandler) {
        this.children.forEach((mesh, index) => { 
            eventHandler?.onProgress(index / this.children.length, "Loading " + mesh.name);
            mesh.createWireframe();
        });
        eventHandler?.onLoad();
    }

    public toggleHighlight(): boolean {
        return this.setHighlight(!this.selected);
    }

    public setHighlight(state: boolean): boolean {
        this.children.forEach(mesh => mesh.setHighlight(state));
        this.selected = state;
        return state;
    }

    public intersects(raycaster: Raycaster): boolean {
        const intersects = raycaster.intersectObjects(this.children, true);
        return intersects.length > 0;
    }

    public static load(fileList: ArrangedFiles, loadingUI: LoadingUI): BenchModel {
        const model = new BenchModel();

        loadingUI.onStart();
        loadingUI.startProcess()
        .then("Obj File Loading", 
            (handler) => model.fromObjFile(fileList, handler), Intepretors.ObjProg)
        .finally("Creating Wire Frame", model.createWireframe.bind(model))
        .work();
        
        return model;
    }
    public static readonly BENCH_SCALE = new Vector3(16, 16, 16);
}

class BenchMesh extends Group {
    private mesh: Mesh;
    private wireframe: LineSegments | null;

    constructor(loadedMesh: Mesh) {
        super();
        this.mesh = loadedMesh;
        this.name = loadedMesh.name;
        this.add(this.mesh);
        this.wireframe = null;
    }

    public createWireframe(): void {
        // Lazy Loading   
        if (this.wireframe) return;
        // Wireframe overlay from same geometry
        const wireframe = GeometryUtil.createWireFrame(this.mesh.geometry);
        if (wireframe) {
            this.wireframe = wireframe;
            this.add(wireframe);
            this.setHighlight(false);
        }
    }

    public recreateWireframe(): void {
        let visible = false;
        if (this.wireframe) {
            visible = this.wireframe.visible;
            this.remove(this.wireframe);
            this.wireframe = null;
        }
        this.createWireframe();
        this.setHighlight(visible);
    }

    public setHighlight(state: boolean): boolean {
        if (!this.wireframe) return false;
        this.wireframe.visible = state;
        return state;
    }

    public merge(): void {
        this.mesh.geometry = GeometryUtil.mergeVerticesWithNormals(this.mesh.geometry);
    }
}


export {
    BenchModel,
    BenchMesh
}