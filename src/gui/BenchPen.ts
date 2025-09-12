import {
    Group,
    Mesh,
    MeshBasicMaterial,
    Plane,
    Raycaster,
    Scene,
    SphereGeometry,
    Vector2,
    Vector3,
} from "three";
import type { BenchCamera } from "../scene/BenchRender";

class ControlPoints extends Group {
    private readonly indicator: Mesh;
    private readonly points: Array<Vector3>;
    constructor() {
        super();
        this.indicator = ControlPoints.createPointMesh();
        this.add(this.indicator);
        this.points = Array();
    }

    public static createPointMesh() {
        return new Mesh(
            new SphereGeometry(0.15, 16, 12),
            new MeshBasicMaterial({ color: 0x00c2ff })
        );
    }

    public indicate(x: number, y: number, z: number) {
        this.indicator.position.set(x, y, z);
    }

    public pin() {
        this.points.push(this.indicator.position.clone());
        const pointMesh = ControlPoints.createPointMesh();
        pointMesh.position.copy(this.indicator.position);
        this.add(pointMesh);
    }

    public undo() {
        if (this.points.length <= 0) return;
        this.points.pop();
        this.children.pop();
    }

    public show() { this.visible = true; }

    public hide() { this.visible = false; }
}

export class BenchPen {
    private readonly scene: Scene;
    private readonly camera: BenchCamera;
    private readonly element: HTMLCanvasElement;

    private readonly ray = new Raycaster();
    private readonly ndc = new Vector2();
    private readonly plane = new Plane(new Vector3(0, 1, 0), 0); // y = 0
    private readonly hit = new Vector3();

    private readonly ctrlPts: ControlPoints;
    private enabled = false;

    constructor(scene: Scene, camera: BenchCamera, domElement: HTMLCanvasElement) {
        this.scene = scene;
        this.camera = camera;
        this.element = domElement;

        this.ctrlPts = new ControlPoints();
        this.ctrlPts.hide();
        this.scene.add(this.ctrlPts);

        this.onPointerMove = this.onPointerMove.bind(this);
        this.onSelectCtrlPoint = this.onSelectCtrlPoint.bind(this);
        this.onUndo = this.onUndo.bind(this);
    }

    public enable(): void {
        if (this.enabled) return;
        this.enabled = true;
        this.element.addEventListener("pointermove", this.onPointerMove, { passive: true });
        this.element.addEventListener("pointerdown", this.onSelectCtrlPoint);
        document.addEventListener("keyup", this.onUndo);
        this.ctrlPts.show();
    }

    public disable(): void {
        if (!this.enabled) return;
        this.enabled = false;
        this.element.removeEventListener("pointermove", this.onPointerMove);
        this.element.removeEventListener("pointerdown", this.onSelectCtrlPoint);
        
        this.ctrlPts.hide();
    }

    private onPointerMove(event: PointerEvent): void {
        const rect = this.element.getBoundingClientRect();
        this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.ndc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

        this.ray.setFromCamera(this.ndc, this.camera.current);
        const hit = this.ray.ray.intersectPlane(this.plane, this.hit);
        if (!hit) {
            return;
        }

        // Snap to grid on XZ at y=0
        const snappedX = Math.round(hit.x);
        const snappedZ = Math.round(hit.z);

        this.ctrlPts.indicate(snappedX, 0, snappedZ);
    }

    private onSelectCtrlPoint(event: MouseEvent) {
        if (event.button === 0) this.ctrlPts.pin();
    }

    private onUndo(event: KeyboardEvent) {
        if (event.ctrlKey && event.key === "z") {
            this.ctrlPts.undo();
        }
            
    }
}
