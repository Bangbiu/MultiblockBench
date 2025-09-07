import {  
    Camera,
    Group,
    Object3D,
    Vector3,
} from "three";
import type { BenchIntersection, BenchMesh } from "../scene/BenchModel";
import { BenchFace, type Object3DProvider } from "../geometry/BenchGeometry";
import { BenchSubGeometry, Coplane } from "../geometry/SubGeometries";
import { MaterialUtil } from "../util/MaterialUtil";

class ProviderWrapper<P extends Object3DProvider> extends Group {
    private _provider?: P;
    constructor(parent: Object3D) {
        super();
        parent.add(this);
    }

    public get provider(): Opt<P> { return this._provider; }
    public set provider(prov: P) { 
        this._provider = prov;
        this.reprovide();
    }

    public unload() { this._provider = undefined; this.clear(); }

    public reprovide() {
        this.clear();
        if (this._provider) this.add(this._provider.createObject3D());
    }
}

class Selection extends Group {
    public benchMesh?: BenchMesh;
    public baseFace: ProviderWrapper<BenchFace>;
    public subfaces: ProviderWrapper<BenchSubGeometry>;
    constructor() {
        super();
        this.baseFace = new ProviderWrapper<BenchFace>(this);
        this.subfaces = new ProviderWrapper<BenchSubGeometry>(this);
        this.renderOrder = 1;
        this.selectCoplane = this.selectCoplane.bind(this);
        this.selectNeighbors = this.selectNeighbors.bind(this);
        this.selectBackPlane = this.selectBackPlane.bind(this);
        this.extractSubMesh = this.extractSubMesh.bind(this);
        this.deselect = this.deselect.bind(this);
    }

    public get unavailable() { return this.benchMesh === undefined; }
    public get face() { return this.baseFace.provider; }

    public focusCamera(cam: Camera) {
        if (this.unavailable) return;
        const tri = this.face!!.tri();
        const center = tri.getMidpoint(new Vector3()).multiply(window.config.scale);
        const normal = tri.getNormal(new Vector3()).multiplyScalar(10);
        cam.position.copy(center).add(normal);
        cam.lookAt(center);
    }

    public selectByIsect(isect: BenchIntersection) {
        const mesh = isect.benchMesh;
        this.benchMesh = mesh;
        this.baseFace.provider = new BenchFace(mesh.geometry, isect.faceIndex);
    }

    public deselect() {
        this.benchMesh == undefined;
        this.baseFace.unload();
        this.subfaces.unload();
    }

    public selectCoplane() {
        if (this.unavailable) return;
        this.subfaces.provider = new Coplane(this.face!);
    }

    public selectNeighbors() {
        if (this.unavailable) return;
        const face = this.face!;
        this.subfaces.provider = this.new()
            .append(face.neighbors())
            .add(face.index);
    }

    public selectBackPlane() {
        if (this.unavailable) return;
        const backface = this.face!.backFace();
        if (!backface) return;
        this.subfaces.provider = new Coplane(backface);
    }

    public extractSubMesh() {
        const subfaces = this.subfaces.provider;
        if (!subfaces || !(subfaces instanceof Coplane)) return;
        const benchMesh = this.benchMesh!;
        // const plane = subfaces.plane;
        // const origin = subfaces.origin;
        this.deselect();
        const img = MaterialUtil.exportCoplanarTexture(subfaces, benchMesh.texture);
        MaterialUtil.saveImageDataAsPNG(img);
    }

    private new(): BenchSubGeometry {
        return new BenchSubGeometry(this.face!.parent);
    }
}

export {
    Selection
}