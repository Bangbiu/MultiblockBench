import { 
    Group, 
    LineSegments, 
    Raycaster,
    Vector3, 
} from 'three';

import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import { Intepretors, LoadingUI, type ObjProgIntepretor, type SubEventHandler } from '../gui/Loading';
import { GeometryUtil } from '../util/GeometryUtil';

class BenchModel extends Group {
    private mesh: Group | null = null;
    private edges: LineSegments | null = null;
    public selected = false;

    constructor(loadedObj: Group | null = null) {
        super();
        if (loadedObj) this.setMesh(loadedObj);
    }

    public setMesh(loadedObj: Group): void {
        this.clearMesh();
        this.mesh = loadedObj;
        this.mesh.scale.copy(BenchModel.BENCH_SCALE);
        this.add(this.mesh);
    }

    public clearMesh(): void {
        if (this.mesh) {
            this.remove(this.mesh);
            this.mesh = null;
        }
    }

    protected loadfromObj(fileList: ArrangedFiles, eventHandler?: SubEventHandler<ObjProgIntepretor>): void {
        FileUtil.loadObj(fileList, eventHandler).then((obj) => this.setMesh(obj));
    }

    protected createWireframe(eventHandler?: SubEventHandler): void {
        // Lazy Loading   
        if (this.edges != null || this.mesh == null) return;
        // Wireframe overlay from same geometry
        this.edges = GeometryUtil.createWireFrame(this.mesh!);
        if (this.edges) {
            this.add(this.edges);
            this.edges!.scale.copy(BenchModel.BENCH_SCALE);
            this.setHighlight(false);
        }
        eventHandler?.onLoad();
    }

    public toggleHighlight(): boolean {
        if (!this.mesh) return false;
        return this.setHighlight(!this.selected);
    }

    public setHighlight(state: boolean): boolean {
        if (!this.mesh) return false;
        this.createWireframe();
        this.edges!.visible = state;
        this.selected = state;
        return state;
    }

    public intersects(raycaster: Raycaster): boolean {
        if (!this.mesh) return false;
        const intersects = raycaster.intersectObject(this.mesh, true);
        return intersects.length > 0;
    }

    public static load(fileList: ArrangedFiles, loadingUI: LoadingUI): BenchModel {
        const model = new BenchModel();

        loadingUI.onStart();
        loadingUI.startProcess()
        .then("Obj File Loading", 
            (handler) => model.loadfromObj(fileList, handler), Intepretors.ObjProg)
        .finally("Creating Wire Frame", model.createWireframe.bind(model))
        .work();
        
        return model;
    }

    public static readonly BENCH_SCALE = new Vector3(16, 16, 16);
}


export {
    BenchModel
}