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

type BenchIntersection = {
    benchMesh: BenchMesh,
    faceIndex: number,
    dist: number
}

class BenchModel extends Group {
    public selection: Selection;
    public benchMeshes: Set<BenchMesh>;
    private _wireframeVisible: boolean = true;
    private _meshVisible: boolean = true;

    constructor() {
        super();
        this.benchMeshes = new Set();
        this.selection = new Selection();
        this.add(this.selection);
        this.scale.copy(window.config.scale);
    }

    public get wireframeVisible() { return this.wireframeVisible; }

    public set wireframeVisible(value: boolean) {
        this._wireframeVisible = value;
        this.benchMeshes.forEach(mesh => mesh.wireframeVisible = value);
    }

    public get meshVisible() { return this._meshVisible; }

    public set meshVisible(value: boolean) {
        this._meshVisible = value;
        this.benchMeshes.forEach(mesh => mesh.visible = value);
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
        // Loading File
        loadingUI.onStart();
        let loadedObj: Opt<Group>;
        const process = loadingUI.startProcess("Loading Model File");
        await process.then("Obj File", handler => 
            FileUtil.loadObj(fileList, handler).then(result => loadedObj = result)
        ).then("Assign Tasks", handler => {
            for (const obj of loadedObj!.children) {
                const mesh = obj as Mesh;
                if (mesh.isMesh) {
                    process.then("Process Model Data", 
                        handler => BenchMesh.create(mesh, handler)
                        .then(result => this.add(result))
                    );
                }
            }
            process.terminate();
            handler.onLoad();
        }).work();
        this.refresh();
    }

    public selectWith(raycaster: Raycaster): this {
        const intersection = this.getClosestIntersection(raycaster);
        if (intersection) {
            this.selection.selectByIsect(intersection);
        }
        return this;
    }

    public refresh() {
        this.wireframeVisible = this._wireframeVisible;
        this.meshVisible = this._meshVisible;
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
}

class BenchMesh extends Group {
    private readonly wireframe: LineSegments;
    private readonly mesh: GeometryIndexedMesh;
    public readonly geometry: BenchGeometry;

    private constructor(loadedMesh: Mesh) {
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

    public get wireframeVisible() { return this.wireframe.visible; }
    public set wireframeVisible(visible: boolean) { this.wireframe.visible = visible; }

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

    public static async create(mesh: Mesh, eventHandler?: SubTaskHandler) {
        const bm = new BenchMesh(mesh.clone(false));
        eventHandler?.onProgress({ progess: 0, text: mesh.name });
        await bm.toIndexed();
        eventHandler?.onProgress({ progess: 0.33, text: mesh.name });
        await bm.createGeometry();
        eventHandler?.onProgress({ progess: 0.66, text: mesh.name });
        await bm.createWireframe();
        eventHandler?.onLoad();
        return bm;
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