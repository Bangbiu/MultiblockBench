import { FullScreenCamera, BenchRenderer, ModelOrbitalControl } from './scene/BenchRender';
import { BenchGrid } from './scene/BenchGrid';
import { BenchLighting } from './scene/BenchLighting';
import { BenchModel } from './scene/BenchModel';
import { Color, Raycaster, Scene, Vector2 } from 'three';
import { FileUtil } from './util/FileUtil';
import { LoadingUI } from './gui/Loading';
import { bootstrap } from './bootstrap';
import { BenchOutput } from './scene/BenchOutput';


// Global Var
declare global {
  interface Window {
    app: App;
  }
}

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
    public readonly output: BenchOutput;
    // GUI
    public readonly objFileInput: HTMLInputElement;
    public readonly wireframeCheckbox: HTMLInputElement;
    public readonly hideMeshCheckbox: HTMLInputElement;
    public readonly extractSelectedBtn: HTMLButtonElement;
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
        this.output = new BenchOutput();
        this.scene.add(this.output);
        // GUI
        this.objFileInput = App.loadElement("objLoader") as HTMLInputElement;
        this.wireframeCheckbox = App.loadElement("wireframeCheckbox") as HTMLInputElement;
        this.hideMeshCheckbox = App.loadElement("hideMeshCheckbox") as HTMLInputElement;
        this.extractSelectedBtn = App.loadElement("extractSelectedBtn") as HTMLButtonElement;
        this.loadingUI = new LoadingUI();

        App.INSTANCE = this;
    }

    public init(): this {
        this.createScene();
        this.registerEvents();
        return this;
    }

    public createScene(): Scene {
        const scene = new Scene();
        scene.background = new Color(0x666666);
        scene.add(new BenchGrid());
        //scene.add(new DefaultBlock());
        scene.add(new BenchLighting());
        return scene;
    }

    public registerEvents(): this {
        // Mouse
        document.addEventListener("mousedown", (event) => {
            if (event.button == 2) return;
            // convert mouse to normalized device coords
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.model.select(this.raycaster);
        });

        // KeyBoard
        document.addEventListener("keyup", (event) => {
            if (event.key === 'Delete') this.model.clear();
        });

        // Menu
        this.objFileInput.addEventListener("change", () => {
            const arrangedList = FileUtil.arrangeObjMtl(this.objFileInput.files);
            if (!arrangedList) return;
            this.model.load(arrangedList, this.loadingUI);
            // Enable Multiple Loading of Same File
            this.objFileInput.value = "";
        });

        this.extractSelectedBtn.addEventListener("click", () => {
            const extracted = this.model.extractSelected();
            if (extracted) {
                console.log(extracted);
                
                this.output.add(extracted);
            }
        });

        this.renderer.domElement.addEventListener('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
            const menu = document.getElementById('context-menu')!;
            menu.style.left = `${event.clientX}px`;
            menu.style.top = `${event.clientY}px`;
            menu.style.display = 'block';
        });

        App.connect(this.wireframeCheckbox, this.model, "showWireframe");
        App.connect(this.hideMeshCheckbox, this.model, "hideMeshes");

        return this;
    }

    public update(): void {
        this.renderer.outlinePass.selectedObjects = this.model.selection ? [this.model.selection.benchMesh] : [];
        //this.renderer.render(this.scene, this.camera);
        this.renderer.composer.render();
    }

    public static connect<T, K extends BooleanKeys<T>>(checkbox: HTMLInputElement, obj: T, property: K): void {
        if (checkbox.type === "checkbox") {
            checkbox.checked = obj[property] as boolean;
            checkbox.addEventListener("change", () => {
                obj[property] = checkbox.checked as T[K]; // safe cast
            });
        }
    }

    public static loadElement(id: string) {
        return document.getElementById(id);
    }

    public static INSTANCE?: App;
}

function main() {
    const app = new App();
    app.init();
    window.app = app;
    function loop(): void {
        app.update();
        requestAnimationFrame(loop);
    }

    loop();
}

bootstrap().then(main);
