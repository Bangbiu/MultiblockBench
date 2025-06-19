import { Object3D, Group, Mesh, EdgesGeometry, LineSegments, LineBasicMaterial, Raycaster } from 'three';
import { OBJLoader } from 'three-stdlib';

class BenchModel extends Group {
    private mesh: Object3D | null = null;
    private highlightEdge: Group | null = null;
    public selected = false;

    constructor(file: File) {
        super();
        this.fromFile(file);
    }

    public async fromFile(file: File) {
        const objText = await readFileAsText(file);
        this.mesh = new OBJLoader().parse(objText);
        // Resize to Fit Grid
        this.mesh.scale.set(16, 16, 16);
        this.add(this.mesh);
    }

    public toggleHighlight(state: boolean) {
        if (!this.mesh) return;
        if (state && !this.highlightEdge) {
            // Create edge lines
            const allEdges = new Group();

            this.mesh.traverse((child) => {
                if ((child as Mesh).isMesh) {
                    const mesh = child as     Mesh;
                    const edges = new EdgesGeometry(mesh.geometry);
                    const line = new LineSegments(
                        edges,
                        new LineBasicMaterial({ color: 0xffff00 })
                    );
                    line.matrixAutoUpdate = false;
                    line.applyMatrix4(mesh.matrixWorld);
                    allEdges.add(line);
                }
            });

            this.highlightEdge = allEdges;
            this.add(this.highlightEdge);
        }

        if (this.highlightEdge) {
            this.highlightEdge.visible = state;
        }

        this.selected = state;
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