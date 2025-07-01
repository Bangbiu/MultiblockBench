import { 
    Group, 
    LineBasicMaterial, 
    LineSegments, 
    Mesh, 
    Raycaster,
    Vector3,
    WireframeGeometry,
    type Intersection,
} from 'three';

import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import { LoadingUI, type SubTaskHandler } from '../gui/Loading';
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

    public async load(fileList: ArrangedFiles, loadingUI: LoadingUI) {
        this.clear();
        loadingUI.onStart();
        await loadingUI.startProcess("Loading Bench Model")
        .then("Obj File", 
            (handler) => this.fromObjFile(fileList, handler)
        ).finally("Wireframe", (handler) => {
            this.createWireframe(handler);
        })
        .work();
    }

    public fromGroup(group: Group) {
        this.clear();
        for (const obj of group.children) {
            if ((obj as Mesh).isMesh) 
                this.add(new BenchMesh(obj.clone() as Mesh));
        }
    }

    public async fromObjFile(fileList: ArrangedFiles, handler: SubTaskHandler) {
        const group = await FileUtil.loadObj(fileList, handler)
        this.fromGroup(group);
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

    protected async createWireframe(eventHandler?: SubTaskHandler) {
        for (let index = 0; index < this.children.length; index++) {
            const mesh = this.children[index];
            eventHandler?.onProgress({ 
                progess: index / this.children.length,
                text: "Loading " + mesh.name
            });
            await mesh.createWireframe();
        }
        eventHandler?.onLoad();
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

    public static readonly BENCH_SCALE = new Vector3(16, 16, 16);
}

class BenchMesh extends Group {
    private readonly mesh: Mesh;
    private readonly selFace: SelectedFace;
    private readonly selPlane: SelectedPlane;
    private readonly wireframe: LineSegments;

    constructor(loadedMesh: Mesh) {
        super();
        const config = window.config.model;
        this.mesh = loadedMesh;
        this.name = loadedMesh.name;
        this.add(this.mesh);

        // Wireframe
        this.wireframe = new LineSegments();
        this.wireframe.material = new LineBasicMaterial({
            color: config.wireframeColor,
            linewidth: config.wireframeLineWidth
        })
        // Set render order to draw on top
        this.wireframe.renderOrder = 1;
        this.add(this.wireframe);

        // Face Selection
        this.selFace = new SelectedFace(loadedMesh);
        this.selPlane = new SelectedPlane(loadedMesh);
        this.add(this.selFace);
        this.add(this.selPlane);
    }

    public async createWireframe() {
        // Wireframe overlay from same geometry
        this.wireframe.geometry = await GeometryUtil.run<WireframeGeometry>("createWireframe", this.mesh.geometry);
        //wireframe.material.depthTest = false; // makes it draw over the mesh
        this.showWireframe(false);
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

async function timeout(sec: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, sec);
    });
}

export {
    BenchModel,
    BenchMesh
}