import { Object3D, Group, Mesh, EdgesGeometry, LineSegments, LineBasicMaterial, Raycaster } from 'three';
import { OBJLoader } from 'three-stdlib';

class BenchModel extends Group {
    private mesh: Object3D | null = null;
    private edges: Group | null = null;
    public selected = false;

    constructor(file: File) {
        super();
        this.fromFile(file);
    }

    private async fromFile(file: File) {
        const objText = await readFileAsText(file);
        this.mesh = new OBJLoader().parse(objText);
        // Resize to Fit Grid
        this.mesh.scale.set(16, 16, 16);
        this.add(this.mesh);
    }

    private createEdges(): void {
        // Lazy Loading
        if (this.edges != null || this.mesh == null) return;
        const edgeMeshes = new Group();
        for (const child of this.mesh.children) {
            const mesh = child as Mesh;
            if (mesh.isMesh) {
                const edges = new EdgesGeometry(mesh.geometry);
                const line = new LineSegments(
                    edges,
                    new LineBasicMaterial({ color: 0xffff00 })
                );
                line.matrixAutoUpdate = false;
                line.applyMatrix4(mesh.matrixWorld);
                edgeMeshes.add(line);
            }
        }
        this.edges = edgeMeshes;
        this.add(this.edges);
    }

    public toggleHighlight(): boolean {
        if (!this.mesh) return false;
        this.selected = !this.selected;
        return this.setHighlight(this.selected);
    }

    public setHighlight(state: boolean): boolean {
        if (!this.mesh) return false;
        this.createEdges();
        (this.edges as Group).visible = state;
        return state;
    }

    public intersects(raycaster: Raycaster): boolean {
        if (!this.mesh) return false;
        const intersects = raycaster.intersectObject(this.mesh, true);
        return intersects.length > 0;
    }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export {
    BenchModel
}