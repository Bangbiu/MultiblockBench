import { 
    Object3D, 
    Group, 
    Mesh, 
    LineSegments, 
    LineBasicMaterial, 
    Raycaster, 
    BufferGeometry, 
    WireframeGeometry
} from 'three';
import { mergeVertices } from 'three-stdlib';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FileUtil, type ArrangedFiles } from '../util/FileUtil';
import type { LoadingUI } from '../gui/Loading';

class BenchModel extends Group {
    private mesh: Group | null = null;
    private edges: Object3D | null = null;
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

    private createWireframe(): void{
        // Lazy Loading
        if (this.edges != null || this.mesh == null) return;
        // Wireframe overlay from same geometry
        const wireframeGeometry = new WireframeGeometry(extractGeometry(this.mesh)); // full edges
        const wireframe = new LineSegments(
            wireframeGeometry,
            new LineBasicMaterial({
                color: 0xffff00,
                linewidth: 1 // note: linewidth may not work in all browsers
            })
        );

        // 3. Match position, rotation, scale (or use matrixWorld)
        wireframe.matrixAutoUpdate = false;

        // 4. Set render order to draw on top
        wireframe.renderOrder = 1;
        //wireframe.material.depthTest = false; // makes it draw over the mesh
        this.edges = wireframe;
        this.add(this.edges);
    }

    public toggleHighlight(): boolean {
        if (!this.mesh) return false;
        return this.setHighlight(!this.selected);
    }

    public setHighlight(state: boolean): boolean {
        if (!this.mesh) return false;
        this.createWireframe();
        (this.edges as Group).visible = state;
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
        FileUtil.loadObj(fileList, loadingUI).then((obj) => { 
            model.setMesh(obj);
        });
        return model;
    }
}

function extractGeometry(loadedObj: Group): BufferGeometry {
    const geometries: BufferGeometry[] = [];

    loadedObj.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) {
            const geom = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
            geometries.push(geom);
        }
    });

    const mergedGeometry = mergeVertices(mergeGeometries(geometries, true));
    console.log(mergedGeometry ? "Indexed after merging" : "Still not indexed");
    return mergedGeometry;
}


export {
    BenchModel
}