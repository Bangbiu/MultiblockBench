import { 
    Object3D, 
    Group, 
    LineSegments, 
    LineBasicMaterial, 
    Raycaster, 
    WireframeGeometry
} from 'three';

import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import { LoadingUI, type PassThroughIntepretor, type SubEventHandler } from '../gui/Loading';
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
        this.add(this.mesh);
    }

    public clearMesh(): void {
        if (this.mesh) {
            this.remove(this.mesh);
            this.mesh = null;
        }
    }

    private createWireframe(eventHandler?: SubEventHandler<PassThroughIntepretor>): void {
        // Lazy Loading   
        eventHandler?.onStart(0, "Wire Frame");   
        if (this.edges != null || this.mesh == null) return;
        // Wireframe overlay from same geometry
        requestAnimationFrame(() => {
            this.edges = GeometryUtil.createWireFrame(this.mesh!);
            if (this.edges) this.add(this.edges);
            eventHandler?.onProgress(1, "Wire Frame");
        });
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

    public static load(fileList: ArrangedFiles, loadingUI: LoadingUI | null = null): BenchModel {
        const model = new BenchModel();
        loadingUI?.onStart();
        const objLoadingHandler = loadingUI?.pushObjLoadingHandler();
        const objMeshingHandler = loadingUI?.pushSubHandler();
        console.log(objMeshingHandler?.range);
        
        FileUtil.loadObj(fileList, objLoadingHandler)
        .then((obj) => { 
            model.setMesh(obj);
            model.createWireframe(objMeshingHandler);
            //loadingUI?.onLoad();
        });
        return model;
    }
}


export {
    BenchModel
}