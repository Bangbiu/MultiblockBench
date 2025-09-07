import { BenchCamera, BenchRenderer, ModelOrbitalControl, OrthoPlaneControls } from './scene/BenchRender';
import { BenchGrid } from './scene/BenchGrid';
import { BenchLighting } from './scene/BenchLighting';
import { BenchModel } from './scene/BenchModel';
import { Color, Raycaster, Scene, Vector2 } from 'three';
import { FileUtil } from './util/FileUtil';
import { LoadingUI } from './gui/Loading';
import { bootstrap } from './config';
import { BenchOutput } from './scene/BenchOutput';
import { ContextMenu, type MenuDeclaration } from './gui/BenchMenu';

bootstrap();

class App {
    // Render
    public readonly renderer: BenchRenderer;
    public readonly camera: BenchCamera;
    public readonly orbitalControl: ModelOrbitalControl;
    public readonly planeControl: OrthoPlaneControls;
    public readonly scene: Scene;
    // Data
    public readonly raycaster: Raycaster;
    public readonly mouse: Vector2;
    public readonly model: BenchModel;
    public readonly output: BenchOutput;
    // GUI
    public readonly menu: ContextMenu;
    public readonly objFileInput: HTMLInputElement;
    public readonly loadingUI: LoadingUI;
    
    constructor() {
        this.camera = new BenchCamera();
        this.scene = this.createScene();
        this.renderer = new BenchRenderer(this.scene, this.camera.current);
        this.planeControl = new OrthoPlaneControls(this.camera.orthographic, this.renderer.domElement);
        this.orbitalControl = new ModelOrbitalControl(this.camera.perspective, this.renderer);
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
        this.loadingUI = new LoadingUI();
        // Menu
        this.menu = new ContextMenu(this.menuSetting()).attach();
        App.INSTANCE = this;
    }

    public get selection() { return this.model.selection; }

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

    public menuSetting(): MenuDeclaration {
        return {
            "Load Object...": this.objFileInput.click.bind(this.objFileInput),
            Display: {
                type: "subMenu",
                menu: {
                    Wireframe: { 
                        type: "checkBox", 
                        checked: true,
                        setter: (checked) => this.model.showWireframe = checked 
                    },
                    Hidden: { 
                        type: "checkBox", 
                        setter: (checked) => this.model.hideMeshes = checked,
                    }
                }
            },
            Select: {
                type: "subMenu",
                menu: {
                    Coplane: this.selection.selectCoplane,
                    Neighbor: this.selection.selectNeighbors,
                    BackFace: this.selection.selectBackPlane,
                    Deselect: this.selection.deselect,
                }
            },
            Extract: {
                type: "subMenu",
                menu: {
                    Texture: this.selection.extractSubMesh,
                    idk: {type: "subMenu", menu: {idk: "option"}},
                    radio1: "radio",
                    slider1: "slider"
                }
            }
        }
    }

    public toggleFocus(): this {
        if (this.selection.unavailable) return this;
        this.camera.toggle();
        this.selection.focusCamera(this.camera.current);
        this.renderer.setCamera(this.camera.current);
        return this;
    }

    public registerEvents(): this {
        // Mouse
        document.addEventListener("mousedown", (event) => {
            if (event.target !== this.renderer.domElement) return;
            this.menu.hide();
            if (event.button == 2) return;
            // convert mouse to normalized device coords
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera.current);
            this.model.selectWith(this.raycaster);
        });

        // KeyBoard
        document.addEventListener("keyup", (event) => {
            switch (event.key) {
                case "Delete": this.model.clear(); break;
                case "f": this.toggleFocus(); break;
            }
        });

        // Menu
        this.objFileInput.addEventListener("change", () => {
            const arrangedList = FileUtil.arrangeObjMtl(this.objFileInput.files);
            if (!arrangedList) return;
            this.model.load(arrangedList, this.loadingUI);
            // Enable Multiple Loading of Same File
            this.objFileInput.value = "";
        });

        this.renderer.domElement.addEventListener('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
            this.menu.show().moveTo(event.clientX, event.clientY);
        });

        return this;
    }

    public update(): void {
        // Outline Post Effect
        this.renderer.outlinePass.selectedObjects = [];
        //this.renderer.render(this.scene, this.camera);
        this.renderer.composer.render();
        this.orbitalControl.update();
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

// Global Var
declare global {
  interface Window {
    app: App;
  }
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

main();
