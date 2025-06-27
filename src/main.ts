import { FullScreenCamera, BenchRenderer, ModelOrbitalControl } from './scene/BenchRender';
import { BenchGrid } from './scene/BenchGrid';
import { BenchLighting } from './scene/BenchLighting';
import { BenchMesh, BenchModel } from './scene/BenchModel';
import { Color, ColorManagement, Raycaster, Scene, Vector2 } from 'three';
import { FileUtil } from './util/FileUtil';
import { LoadingUI } from './gui/Loading';

class App {
    // Render
    public readonly renderer: BenchRenderer;
    public readonly camera: FullScreenCamera;
    public readonly orbitalControl: ModelOrbitalControl;
    public readonly scene: Scene;
    // Data
    public readonly raycaster: Raycaster;
    public readonly mouse: Vector2;
    public readonly model: BenchModel;
    public readonly selected: Set<BenchMesh>;

    public readonly objFileInput: HTMLInputElement;
    public readonly wireframeToggleBtn: HTMLButtonElement;
    // GUI
    public readonly loadingUI: LoadingUI;

    constructor() {
        this.camera = new FullScreenCamera();
        this.scene = this.createScene();
        this.renderer = new BenchRenderer(this.scene, this.camera);
        this.orbitalControl = new ModelOrbitalControl(this.camera, this.renderer);
        // Interaction
        this.raycaster = new Raycaster();
        this.mouse = new Vector2();
        // Objects
        this.model = new BenchModel();
        this.scene.add(this.model);
        this.selected = new Set<BenchMesh>();
        this.objFileInput = document.getElementById("objLoader") as HTMLInputElement;
        this.wireframeToggleBtn = document.getElementById("wireframeToggleBtn") as HTMLButtonElement;
        // GUI
        this.loadingUI = new LoadingUI();
    }

    public init(): void {
        this.createScene();
        this.registerEvents();
    }

    public createScene(): Scene {
        const scene = new Scene();
        scene.background = new Color(0x666666);
        scene.add(new BenchGrid());
        //scene.add(new DefaultBlock());
        scene.add(new BenchLighting());
        return scene;
    }

    public registerEvents(): void {
        // Mouse
        document.addEventListener("mousedown", (event) => {
            if (event.button == 2) return;
            // convert mouse to normalized device coords
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const interacted = this.model.onInteract(this.raycaster);
            if (interacted) this.selected.add(interacted)
        });

        // KeyBoard
        document.addEventListener("keyup", (event) => {
            if (event.key === 'Delete') {
                for (const model of this.selected) {
                    this.scene.remove(model);
                    this.model.clear();
                }
                this.selected.clear();
            }
        });

        // Menu
        this.objFileInput.addEventListener("change", () => {
            const arrangedList = FileUtil.arrangeObjMtl(this.objFileInput.files);
            if (!arrangedList) return;
            this.model.fromObjFile(arrangedList, this.loadingUI);
            // Enable Multiple Loading of Same File
            this.objFileInput.value = "";
        });

        this.wireframeToggleBtn.addEventListener("click", () => {
            const isChecked = !(this.wireframeToggleBtn.dataset.checked === "true");
            this.wireframeToggleBtn.dataset.checked = isChecked.toString();
            if (isChecked) {

            } else {

            }
        });

        const onMergeVertices = document.getElementById("mergeVerticesButton");
        if (onMergeVertices) {
            onMergeVertices.addEventListener("click", () => {
                //this.model.selected.
            });
        }
    }

    public update(): void {
        this.renderer.outlinePass.selectedObjects = Array.from(this.selected);
        //this.renderer.render(this.scene, this.camera);
        this.renderer.composer.render();
    }

}

ColorManagement.enabled = true;
const app = new App();
app.init();


function loop(): void {
    app.update();
    requestAnimationFrame(loop);
}

loop();