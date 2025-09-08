import { 
    Group, 
    LineSegments, 
    Mesh, 
    MeshPhongMaterial, 
    Object3D, 
    Raycaster,
    WireframeGeometry,
    type Intersection,
} from 'three';

import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import { LoadingUI, type SubTaskHandler } from '../gui/Loading';
import { GeometryUtil, type GeometryIndexedMesh, type IndexedBufferGeometry } from '../geometry/GeometryUtil';
import { Selection } from '../gui/Selection';
import { BenchGeometry } from '../geometry/BenchGeometry';
import { MaterialUtil } from '../util/MaterialUtil';
import type { BenchSubGeometry } from '../geometry/SubGeometries';

type BenchMeshAsyncFn = (mesh: BenchMesh, index: number) => Promise<void>;

type BenchIntersection = {
    benchMesh: BenchMesh,
    faceIndex: number,
    dist: number
}

class BenchModel extends Group {
    public selection: Selection;
    public benchMeshes: Set<BenchMesh>;
    private _showWireframe: boolean = true;
    private _hideMeshes: boolean = false;

    constructor() {
        super();
        this.benchMeshes = new Set();
        this.selection = new Selection();
        this.add(this.selection);
        this.scale.copy(window.config.scale);
    }

    public get showWireframe() { return this._showWireframe; }

    public set showWireframe(value: boolean) {
        this._showWireframe = value;
        this.benchMeshes.forEach(mesh => mesh.showWireframe(value));
    }

    public get hideMeshes() { return this._hideMeshes; }

    public set hideMeshes(value: boolean) {
        this._hideMeshes = value;
        this.benchMeshes.forEach(mesh => mesh.visible = !value);
    }

    public add(...objs: Array<Object3D>): this {
        super.add(...objs);
        objs.forEach(obj => {
            if (obj instanceof BenchMesh) this.benchMeshes.add(obj);
        });
        return this;
    }

    public clearBench() {
        this.clear();
        this.add(this.selection);
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
        this.clearBench();
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
        this.refresh();
    }

    public fromGroup(group: Group) {
        for (const obj of group.children) {
            if ((obj as Mesh).isMesh) 
                this.add(new BenchMesh(obj.clone() as Mesh));
        }
    }

    public async fromObjFile(fileList: ArrangedFiles, handler: SubTaskHandler) {
        const group = await FileUtil.loadObj(fileList, handler)
        this.fromGroup(group);
    }

    public selectWith(raycaster: Raycaster): this {
        const intersection = this.getClosestIntersection(raycaster);
        if (intersection) {
            this.selection.selectByIsect(intersection);
        }
        return this;
    }

    public refresh() {
        this.showWireframe = this._showWireframe;
        this.hideMeshes = this._hideMeshes;
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
                faceIndex: minIsect.faceIndex!,
                dist: minDist
            }
        }
        return undefined;
    }

    public setOpacity(opacity: number) {
        this.benchMeshes.forEach(mesh => mesh.setOpacity(opacity));
    }

    public extractSelected(): Opt<Mesh> {
        return undefined;
        //return this.selection.benchMesh.extractSubMesh(this.selection.coplane.subGeom);
    }
}

class BenchMesh extends Group {
    private readonly wireframe: LineSegments;
    private readonly mesh: GeometryIndexedMesh;
    public readonly geometry: BenchGeometry;
    constructor(loadedMesh: Mesh) {
        super();
        this.mesh = loadedMesh as GeometryIndexedMesh;
        this.name = loadedMesh.name;
        this.add(this.mesh);

        // Wireframe
        this.wireframe = new LineSegments();
        this.wireframe.material = window.config.model.wireframe_mat;
        // Set render order to draw on top
        this.wireframe.renderOrder = 1;
        this.add(this.wireframe);
        // BenchGeometry
        this.geometry = new BenchGeometry();
    }

    public get texture() {
        return (this.mesh.material as MeshPhongMaterial).map!;
    }

    public async toIndexed() {
        const geometry = this.mesh.geometry;
        if (geometry.index) return;
        this.mesh.geometry = await GeometryUtil.run<IndexedBufferGeometry>("createIndexedGeometry", geometry);
    }

    public async createGeometry() {
        await this.geometry.buildFrom(this.mesh.geometry as IndexedBufferGeometry);
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

    public setOpacity(opacity: number) {
        MaterialUtil.setMaterialOpacity(this.mesh.material, opacity);
    }

    public extractSubMesh(subGeom: BenchSubGeometry): Mesh {
        return GeometryUtil.extractSubMesh(this.mesh, subGeom);
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