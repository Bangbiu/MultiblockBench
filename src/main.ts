import { FullScreenCamera, FullScreenRenderer, ModelOrbitalControl } from './scene/FullScreenRender';
import { BenchGrid, DefaultBlock } from './scene/BenchGrid';
import { BenchLighting } from './scene/BenchLighting';
import { BenchModel } from './scene/BenchModel';
import { Color, Raycaster, Scene, Vector2 } from 'three';


class App {
    public readonly renderer: FullScreenRenderer;
    public readonly camera: FullScreenCamera;
    public readonly orbitalControl: ModelOrbitalControl;

    public readonly raycaster: Raycaster;
    public readonly mouse: Vector2;
    public readonly models: BenchModel[];

    public readonly scene: Scene;

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
        this.models = [];
    }

    public init(): void {
        this.createMenu();
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

    public createMenu(): void {
        const objInput = document.getElementById("objLoader") as HTMLInputElement;
        objInput.addEventListener("change", () => {
            const file = objInput.files?.[0];
            if (!file) return;
            const model: BenchModel = new BenchModel(file);
            this.scene.add(model);
            this.models.push(model);
        });
    }

    public registerEvents(): void {
        document.addEventListener('click', (event) => {
            // convert mouse to normalized device coords
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);

            for (const model of this.models) {
                const hit = model.intersects(this.raycaster);
                model.toggleHighlight(hit); // toggle highlight on click
            }
        });
    }

    public update(): void {
        this.renderer.render(this.scene, this.camera);
    }
}

const app = new App();
app.init();


function loop(): void {
    app.update();
    requestAnimationFrame(loop);
}

loop();