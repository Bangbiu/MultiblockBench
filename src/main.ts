import { FullScreenCamera, FullScreenRenderer, ModelOrbitalControl } from './scene/FullScreenRender';
import { BenchGrid } from './scene/BenchGrid';
import { BenchLighting } from './scene/BenchLighting';
import { BenchModel } from './scene/BenchModel';
import { Color, Raycaster, Scene, Vector2 } from 'three';
import { FileUtil } from './util/FileUtil';
import { LoadingUI } from './gui/Loading';

class App {
    // Render
    public readonly renderer: FullScreenRenderer;
    public readonly camera: FullScreenCamera;
    public readonly orbitalControl: ModelOrbitalControl;
    public readonly scene: Scene;
    // Data
    public readonly raycaster: Raycaster;
    public readonly mouse: Vector2;
    public readonly models: Set<BenchModel>;
    public readonly selected: Set<BenchModel>;

    public readonly objFileInput: HTMLInputElement;
    // GUI
    public readonly loadingUI: LoadingUI;

    constructor() {
        this.renderer = new FullScreenRenderer();
        this.camera = new FullScreenCamera();
        this.orbitalControl = new ModelOrbitalControl(this.camera, this.renderer);
        // Scene
        this.scene = this.createScene();
        // Interaction
        this.raycaster = new Raycaster();
        this.mouse = new Vector2();
        // Objects
        this.models = new Set<BenchModel>();
        this.selected = new Set<BenchModel>();
        this.objFileInput = document.getElementById("objLoader") as HTMLInputElement;
        // GUI
        this.loadingUI = new LoadingUI();
    }

    public init(): void {
        this.createScene();
        this.registerEvents();
    }

    public createScene(): Scene {
        const scene = new Scene();
        scene.background = new Color(0x222222);
        scene.add(new BenchGrid());
        //scene.add(new DefaultBlock());
        scene.add(new BenchLighting());
        return scene;
    }

    public registerEvents(): void {
        // Mouse
        document.addEventListener('mousedown', (event) => {
            if (event.button == 2) return;
            // convert mouse to normalized device coords
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const interacted = this.getInteracting();
            
            if (null != interacted) {
                if (false == event.ctrlKey) {
                    // Single Selection
                    for (const model of this.selected) {
                        model.setHighlight(false);
                    }
                    this.selected.clear();
                    interacted.setHighlight(true);
                    this.selected.add(interacted);
                } else {
                    if (interacted.toggleHighlight()) {
                        this.selected.add(interacted);
                    } else {
                        this.selected.delete(interacted);
                    }
                }
            }

        });

        // KeyBoard
        document.addEventListener('keyup', (event) => {
            if (event.key === 'Delete') {
                for (const model of this.selected) {
                    this.scene.remove(model);
                    this.models.delete(model);
                }
                this.selected.clear();
            }
        });

        // Menu
        this.objFileInput.addEventListener("change", () => {
            const arrangedList = FileUtil.arrangeObjMtl(this.objFileInput.files);
            if (!arrangedList) return;
            const model: BenchModel = BenchModel.load(arrangedList, this.loadingUI);
            this.models.add(model);
            this.scene.add(model);
            // Enable Multiple Loading of Same File
            this.objFileInput.value = "";
        });
    }

    public update(): void {
        this.renderer.render(this.scene, this.camera);
    }

    private getInteracting(): BenchModel | null {
        for (const model of this.models) {
            const hit = model.intersects(this.raycaster);
            if (hit) return model;
        }
        return null;
    }
}

const app = new App();
app.init();


function loop(): void {
    app.update();
    requestAnimationFrame(loop);
}

loop();