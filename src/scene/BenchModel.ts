import { 
    Group, 
    LineBasicMaterial, 
    LineSegments, 
    Mesh, 
    Object3D, 
    Raycaster,
    Vector3,
    WireframeGeometry,
    type Intersection,
} from 'three';

import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import { LoadingUI, type SubTaskHandler } from '../gui/Loading';
import { GeometryUtil, type IndexedBufferGeometry } from '../util/GeometryUtil';
import { Selection } from '../gui/Selection';
import { BenchGeometry } from '../geometry/BenchGeometry';

type BenchMeshAsyncFn = (mesh: BenchMesh, index: number) => Promise<void>;

type BenchIntersection = {
    benchMesh: BenchMesh,
    isect: Intersection,
    dist: number
}

class BenchModel extends Group {
    public selection?: Selection;
    public benchMeshes: Set<BenchMesh>;
    private _showWireframe: boolean = true;

    constructor() {
        super();
        this.benchMeshes = new Set();
        this.scale.copy(BenchModel.BENCH_SCALE);
    }

    public get showWireframe() {
        return this._showWireframe;
    }

    public set showWireframe(value: boolean) {
        this._showWireframe = value;
        this.benchMeshes.forEach(mesh => mesh.showWireframe(value));
    }

    public add(...objs: Array<Object3D>): this {
        super.add(...objs);
        objs.forEach(obj => {
            if (obj instanceof BenchMesh) this.benchMeshes.add(obj);
        });
        return this;
    }

    public remove(...objs: Array<Object3D>): this {
        super.remove(...objs);
        objs.forEach(obj => {
            if (obj instanceof BenchMesh && this.benchMeshes.has(obj)) {
                this.benchMeshes.delete(obj);
            }
        });
        return this;
    }

    public async load(fileList: ArrangedFiles, loadingUI: LoadingUI) {
        this.clear();
        loadingUI.onStart();
        await loadingUI.startProcess("Loading Bench Model")
        .then("Obj File", 
            handler => this.fromObjFile(fileList, handler))
        .then("Index Geometry", 
            this.indexGeometries.bind(this))
        .then("Create Bench Geometry", 
            this.createBenchGeometry.bind(this))
        .finally("Create Wireframe",
            this.createWireframes.bind(this))
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

    public select(raycaster: Raycaster): this {
        const intersection = this.getClosestIntersection(raycaster);
        if (intersection) {
            if (this.selection) this.remove(this.selection);
            this.selection = new Selection(intersection);
            this.add(this.selection);
        }
        return this;
    }

    public async runOnAll(callback: BenchMeshAsyncFn, eventHandler?: SubTaskHandler) {
        const tasks: (() => Promise<void>)[] = new Array();
        const meshes = Array.from(this.benchMeshes);
        for (let index = 0; index < meshes.length; index++) {
            const mesh = meshes[index];
            tasks.push(async () => {
                eventHandler?.onProgress({ 
                    progess: index / this.children.length,
                    text: mesh.name
                });
                await callback(mesh, index);
            });
        }
        const promises = tasks.map(task => task());
        await Promise.all(promises);
        eventHandler?.onLoad();
    }

    public async indexGeometries(eventHandler?: SubTaskHandler) {
        await this.runOnAll(mesh => mesh.toIndexed(), eventHandler);
    }

    public async createWireframes(eventHandler?: SubTaskHandler) {
        await this.runOnAll(mesh => mesh.createWireframe(), eventHandler);
    }

    public async createBenchGeometry(eventHandler?: SubTaskHandler) {
        await this.runOnAll(mesh => mesh.createGeometry(), eventHandler)
    }

    protected getClosestIntersection(raycaster: Raycaster): Opt<BenchIntersection> {
        let minDist: number = Infinity;
        let minIsect: Intersection | undefined = undefined;
        let isectedMesh: BenchMesh | undefined = undefined;
        for (const mesh of this.children) {
            if (mesh instanceof BenchMesh) {
            const isect = mesh.getIntersection(raycaster);
                if (isect) {
                    if (minDist > isect.distance) {
                        minDist = isect.distance
                        minIsect = isect;
                        isectedMesh = mesh;
                    }
                }
            }
        }
        if (minIsect && isectedMesh ) {
            return {
                benchMesh: isectedMesh,
                isect: minIsect,
                dist: minDist
            }
        }
        return undefined;
    }

    public static readonly BENCH_SCALE = new Vector3(16, 16, 16);
}

class BenchMesh extends Group {
    private readonly mesh: Mesh;
    private readonly wireframe: LineSegments;
    public readonly geometry: BenchGeometry;

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
        });
        // Set render order to draw on top
        this.wireframe.renderOrder = 1;
        this.add(this.wireframe);
        // BenchGeometry
        this.geometry = new BenchGeometry();
    }

    public async toIndexed() {
        const geometry = this.mesh.geometry;
        if (geometry.index) return;
        this.mesh.geometry = await GeometryUtil.run("createIndexedGeometry", geometry);
    }

    public async createGeometry() {
        await this.geometry.create(this.mesh.geometry as IndexedBufferGeometry);
    }

    public async createWireframe() {
        // Wireframe overlay from same geometry
        this.wireframe.geometry = await GeometryUtil.run<WireframeGeometry>("createWireframe", this.mesh.geometry);
        //wireframe.material.depthTest = false; // makes it draw over the mesh
    }

    public showWireframe(state: boolean): boolean {
        if (!this.wireframe) return false;
        this.wireframe.visible = state;
        return state;
    }

    public getIntersection(raycaster: Raycaster): Intersection | undefined {
        const isects = raycaster.intersectObject(this.mesh, false);
        if (isects.length > 0) 
            return isects[0];
        else 
            return undefined;
    }

    public faceGeometryAt(index: number) {
        return this.geometry.faceGeometryAt(index);
    }

    public static load(mesh: Mesh) {
        
    }
}

// async function timeout(sec: number) {
//     return new Promise<void>((resolve) => {
//         setTimeout(resolve, sec);
//     });
// }

export type {
    BenchIntersection
}

export {
    BenchModel,
    BenchMesh
}