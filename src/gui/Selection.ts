import {  
    Group,
    Object3D
} from "three";
import type { BenchIntersection } from "../scene/BenchModel";
import { BenchFace, type Object3DProvider } from "../geometry/BenchGeometry";
import { BenchSubGeometry } from "../geometry/SubGeometries";

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

    public reprovide() {
        this.clear();
        if (this._provider) this.add(this._provider.createObject3D());
    }
}

class Selection extends Group {
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
    }

    public get unavailable() { return this.baseFace.provider === undefined; }
    public get face() { return this.baseFace.provider; }

    public selectByIsect(isect: BenchIntersection) {
        const mesh = isect.benchMesh;
        this.baseFace.provider = new BenchFace(mesh.geometry, isect.faceIndex);
    }

    public selectCoplane() {
        if (this.unavailable) return;
        this.subfaces.provider = this.new()
            .coplane(this.face!.index);
    }

    public selectNeighbors() {
        if (this.unavailable) return;
        const face = this.face!;
        this.subfaces.provider = this.new()
            .append(this.face!.neighbors())
            .add(face.index);
    }

    public selectBackPlane() {
        if (this.unavailable) return;
        const backface = this.face!.backFace();
        if (!backface) return;
        this.subfaces.provider = this.new()
            .coplane(backface.index);
    }

    private new(): BenchSubGeometry {
        return new BenchSubGeometry(this.face!.parent);
    }
}

export {
    Selection
}