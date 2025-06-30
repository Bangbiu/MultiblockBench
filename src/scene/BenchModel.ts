import { 
    Group, 
    LineSegments, 
    Mesh, 
    Raycaster,
    Vector3,
    type Intersection,
} from 'three';

import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import { Intepretors, LoadingUI, type SubEventHandler } from '../gui/Loading';
import { GeometryUtil } from '../util/GeometryUtil';
import { SelectedFace, SelectedPlane } from '../gui/Selection';


class BenchModel extends Group {
    public children: Array<BenchMesh>;
    public selected: BenchMesh | undefined;
    public showWireframe: boolean;
    public showSelFace: boolean;
    constructor() {
        super();
        this.children = new Array();
        this.scale.copy(BenchModel.BENCH_SCALE);
        this.showWireframe = true;
        this.showSelFace = true;
    }

    public add(...meshes: Array<BenchMesh>): this {
        super.add(...meshes);
        return this;
    }

    public fromGroup(group: Group) {
        this.clear();
        for (const obj of group.children) {
            if ((obj as Mesh).isMesh) 
                this.add(new BenchMesh(obj.clone() as Mesh));
        }
    }

    public fromObjFile(fileList: ArrangedFiles, loadingUI: LoadingUI): void {
        this.clear();
        loadingUI.onStart();
        loadingUI.startProcess()
        .then("Obj File Loading", 
            (handler) => {
                FileUtil.loadObj(fileList, handler).then((group) => (this.fromGroup(group)))
            },
            Intepretors.ObjProg
        ).finally("Creating Wire Frame", 
            this.createWireframe.bind(this)
        ).work();
    }

    public onInteract(raycaster: Raycaster): BenchMesh | undefined {
        const isectedMesh = this.getClosestIntersection(raycaster);
        if (isectedMesh) {
            this.clearSelection();
            this.selected = isectedMesh;
            if (this.showSelFace) {
                isectedMesh.showSelectedFace(true);
            }
            if (this.showWireframe) {
                isectedMesh.showWireframe(true);
            }
        }
        // Closest Intersections
        return isectedMesh;
    }

    public clearSelection(): this {
        this.selected = undefined;
        this.children.forEach(mesh => {
            mesh.showSelectedFace(false);
            mesh.showWireframe(false);
        });
        return this;
    }

    protected getClosestIntersection(raycaster: Raycaster): BenchMesh | undefined {
        let minDist: number = Infinity;
        let isectedMesh: BenchMesh | undefined = undefined;
        for (const mesh of this.children) {
            const isect = mesh.getIntersection(raycaster);
            if (isect) {
                mesh.onInteract(isect);
                if (minDist > isect.distance) {
                    minDist = isect.distance
                    isectedMesh = mesh;
                }
            }
        }
        return isectedMesh;
    }

    protected createWireframe(eventHandler?: SubEventHandler) {
        this.children.forEach((mesh, index) => { 
            eventHandler?.onProgress(index / this.children.length, "Loading " + mesh.name);
            mesh.createWireframe();
        });
        eventHandler?.onLoad();
    }

    public static readonly BENCH_SCALE = new Vector3(16, 16, 16);
}

class BenchMesh extends Group {
    private readonly mesh: Mesh;
    private readonly selFace: SelectedFace;
    private readonly selPlane: SelectedPlane;
    private wireframe: LineSegments | null;

    constructor(loadedMesh: Mesh) {
        super();
        this.mesh = loadedMesh;
        this.name = loadedMesh.name;
        this.add(this.mesh);
        this.wireframe = null;// new LineSegments(new LineGeometry(), );
        
        // Face Selection
        this.selFace = new SelectedFace(loadedMesh);
        this.selPlane = new SelectedPlane(loadedMesh);
        this.add(this.selFace);
        this.add(this.selPlane);


    }

    public createWireframe(): void {
        // Lazy Loading   
        if (this.wireframe) return;
        // Wireframe overlay from same geometry
        const wireframe = GeometryUtil.createWireframe(this.mesh.geometry);
        if (wireframe) {
            this.wireframe = wireframe;
            this.add(wireframe);
            this.showWireframe(false);
        }
    }

    public updateWireframe(): void {
        let visible = false;
        if (this.wireframe) {
            visible = this.wireframe.visible;
            this.remove(this.wireframe);
            this.wireframe = null;
        }
        this.createWireframe();
        this.showWireframe(visible);
    }

    public getIntersection(raycaster: Raycaster): Intersection | undefined {
        const isects = raycaster.intersectObject(this.mesh, false);
        if (isects.length > 0) 
            return isects[0];
        else 
            return undefined;
    }

    public onInteract(isect: Intersection): boolean {
        // Update Selected Face
        this.selFace.update(isect);
        this.selPlane.update(isect);
        return true;
    }

    public showSelectedFace(state: boolean) {
        this.selFace.visible = state;
        this.selPlane.visible = state;
        return state;
    }

    public showWireframe(state: boolean): boolean {
        if (!this.wireframe) return false;
        this.wireframe.visible = state;
        return state;
    }
}


export {
    BenchModel,
    BenchMesh
}