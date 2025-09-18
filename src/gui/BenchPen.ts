import {
    DoubleSide,
    GridHelper,
    Group,
    Mesh,
    MeshBasicMaterial,
    Plane,
    PlaneGeometry,
    Raycaster,
    Scene,
    SphereGeometry,
    Vector2,
    Vector3,
} from "three";
import type { BenchCamera } from "../scene/BenchRender";

class WorkPlane extends Group {
    public readonly plane: Plane;
    public readonly ruler: Group;
    private planeIndex: number = 1;
    constructor() {
        super();
        const config = window.config.grid;
        this.ruler = new Group();
        // Grid helper on the XZ plane 1m per block segment
        this.ruler.add(new GridHelper(32, 32, config.unit_color, config.unit_color));
        // Grid helper on the XZ plane 16m per block
        this.ruler.add(new GridHelper(32, 2, 0x00c2ff, 0x00c2ff));

        this.plane = new Plane(new Vector3(0, 1, 0), 0);
        const mesh = new Mesh(
            new PlaneGeometry(32, 32, 1, 1),
            new MeshBasicMaterial({ 
                color: 0x00c2ff, 
                transparent: true,
                opacity: 0.2,
                side: DoubleSide, 
            })
        );
        mesh.rotation.x = Math.PI / 2
        this.ruler.add(mesh);
        this.add(this.ruler);
    }

    public rotate() {
        const normalIndex = ++this.planeIndex % 3;
        const normal = WorkPlane.PLANE_NORMAL[normalIndex];
        this.rotation.setFromVector3(normal);
        this.plane.normal = normal;
    }

    public forward() {
        this.ruler.position.y++;
        this.plane.constant = -this.ruler.position.y;
    }

    public backward() {
        this.ruler.position.y--;
        this.plane.constant = -this.ruler.position.y;
    }

    // XYZ Plane Normal
    public static readonly PLANE_NORMAL = [
        new Vector3(Math.PI / 2, 0, 0),
        new Vector3(0, Math.PI / 2, 0),
        new Vector3(0, 0, Math.PI / 2)
    ];
}

class ControlPoints extends Group {
    private readonly indicator: Mesh;
    private readonly points: Array<Vector3>;

    constructor() {
        super();
        this.indicator = ControlPoints.createPointMesh();
        this.add(this.indicator);
        this.points = Array();
    }

    public indicate(pos: Vector3) {
        this.indicator.position.copy(pos);
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

    public static createPointMesh() {
        return new Mesh(
            new SphereGeometry(0.15, 16, 12),
            new MeshBasicMaterial({ color: 0x00c2ff })
        );
    }

    public static createPlaneMesh() {
        return new Mesh(
            new PlaneGeometry(160, 160, 1, 1),
            new MeshBasicMaterial({ 
                color: 0x00c2ff, 
                transparent: true,
                opacity: 0.2,
                side: DoubleSide, 
            })
        );
    }
}

export class BenchPen {
    private readonly scene: Scene;
    private readonly camera: BenchCamera;
    private readonly element: HTMLCanvasElement;

    private readonly raycaster = new Raycaster();
    private readonly ndc = new Vector2();

    private readonly ctrlPts: ControlPoints;
    private readonly plane: WorkPlane;
    private readonly hit = new Vector3();

    private enabled = false;

    constructor(scene: Scene, camera: BenchCamera, domElement: HTMLCanvasElement) {
        this.scene = scene;
        this.camera = camera;
        this.element = domElement;

        this.ctrlPts = new ControlPoints();
        this.ctrlPts.hide();
        this.scene.add(this.ctrlPts);

        this.plane = new WorkPlane();
        this.scene.add(this.plane);

        this.onPointerMove = this.onPointerMove.bind(this);
        this.onSelectCtrlPoint = this.onSelectCtrlPoint.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
    }

    public enable(): void {
        if (this.enabled) return;
        this.enabled = true;
        this.element.addEventListener("pointermove", this.onPointerMove, { passive: true });
        this.element.addEventListener("pointerdown", this.onSelectCtrlPoint);
        document.addEventListener("keyup", this.onKeyUp);
        this.ctrlPts.show();
    }

    private onPointerMove(event: PointerEvent): void {
        const rect = this.element.getBoundingClientRect();
        this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.ndc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

        this.raycaster.setFromCamera(this.ndc, this.camera.current);
        const hit = this.raycaster.ray.intersectPlane(this.plane.plane, this.hit);
        if (!hit) return;
        hit.round();
        this.ctrlPts.indicate(hit);
    }

    private onSelectCtrlPoint(event: MouseEvent) {
        if (event.button === 0) this.ctrlPts.pin();
    }

    private onKeyUp(event: KeyboardEvent) {
        if (event.ctrlKey && event.key === "z") {
            this.ctrlPts.undo();
            event.preventDefault();
        }

        if (event.key === "r") {
            this.plane.rotate();
        }

        if (event.key === "ArrowUp") {
            this.plane.forward();
        }

        if (event.key === "ArrowDown") {
            this.plane.backward();
        }
    }
}
