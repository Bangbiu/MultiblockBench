import { 
    Camera,
    OrthographicCamera,
    PerspectiveCamera, 
    Scene, 
    Triangle, 
    Vector2, 
    Vector3, 
    WebGLRenderer 
} from 'three';

import { EffectComposer, 
    OrbitControls, 
    OutlinePass, 
    RenderPass 
} from 'three-stdlib';

class BenchRenderer extends WebGLRenderer {
    public readonly composer;
    public readonly renderPass;
    public readonly outlinePass;
    constructor(scene: Scene, camera: Camera) {
        super({ antialias: true });
        this.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.domElement);
        window.addEventListener('resize', this.updateSize.bind(this));
        // Composer
        this.composer = new EffectComposer(this);
        
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);
        const outlinePass = new OutlinePass(
            new Vector2(window.innerWidth, window.innerHeight),
            scene,
            camera
        )
        outlinePass.edgeStrength = 4.0;
        outlinePass.edgeGlow = 0.0;
        outlinePass.edgeThickness = 1.0;
        outlinePass.pulsePeriod = 0;
        outlinePass.visibleEdgeColor.set('#ffff00'); // Yellow outline
        outlinePass.hiddenEdgeColor.set('#ffff00');
        this.outlinePass = outlinePass;
        this.composer.addPass(outlinePass);
    }

    public setCamera(camera: Camera) {
        this.renderPass.camera = camera,
        this.outlinePass.renderCamera = camera;
    }

    updateSize(): void {
        this.setSize(window.innerWidth, window.innerHeight);
        const ratio = Math.min(window.devicePixelRatio, 1.5); // cap it
        this.setPixelRatio(ratio);
    }
}

class BenchCamera {
    public readonly perspective: BenchPerspectiveCamera;
    public readonly orthographic: BenchOrthographicCamera;
    private _active: Camera;

    constructor() {
        this.perspective = new BenchPerspectiveCamera();
        this.orthographic = new BenchOrthographicCamera();
        this._active = this.perspective;
    }

    /** Returns the currently active camera */
    get current(): Camera {
        return this._active;
    }

    toggle(): void {
        const from = this._active;
        const to = from === this.perspective ? this.orthographic : this.perspective;

        // Preserve position/rotation
        to.position.copy(from.position);
        to.quaternion.copy(from.quaternion);

        this._active = to;
    }

    /** Must be called on resize */
    resize(width: number, height: number): void {
        const aspect = width / height;
        this.perspective.aspect = aspect;
        this.perspective.updateProjectionMatrix();

        const frustumSize = 10;
        this.orthographic.left = (-frustumSize * aspect) / 2;
        this.orthographic.right = (frustumSize * aspect) / 2;
        this.orthographic.top = frustumSize / 2;
        this.orthographic.bottom = -frustumSize / 2;
        this.orthographic.updateProjectionMatrix();
    }
}

class BenchPerspectiveCamera extends PerspectiveCamera {
    constructor() {
        super(
            75,
            window.innerWidth / window.innerHeight,
            0.01,
            1000
        );
        this.position.set(-12,26,-16);
        this.lookAt(new Vector3(0,0,0));
        window.addEventListener('resize', this.updateView.bind(this));
    }

    updateView(): void {
        this.aspect = window.innerWidth / window.innerHeight;
        this.updateProjectionMatrix();
    }
}

class BenchOrthographicCamera extends OrthographicCamera {
    constructor() {
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 10; // Adjust for zoom level
        super(
            (frustumSize * aspect) / -2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            2000
        );
        window.addEventListener('resize', this.updateView.bind(this));
    }

    updateView(): void {
        this.updateProjectionMatrix();
    }
}

class ModelOrbitalControl extends OrbitControls {
    constructor(camera: PerspectiveCamera, renderer: WebGLRenderer) {
        super(camera, renderer.domElement);
        this.enableDamping = true;
        this.dampingFactor = 0.05;
        this.target.set(0, 0, 0); // rotate around the origin
    }

    public focusOn(tri: Triangle) {
        const midpoint = new Vector3();
        const normal = new Vector3();
        tri.getMidpoint(midpoint);
        tri.getNormal(normal);

        
    }
}

class OrthoPlaneControls {
    public enabled = true;

    public minZoom = 0.01;
    public maxZoom = 100;

    /** scale sensitivity; >1 = faster zoom/pan, <1 = slower */
    public zoomSpeed = 1.0;
    public panSpeed = 1.0;

    private readonly camera: OrthographicCamera;
    private readonly element: HTMLElement;

    private isPanning = false;
    private last = new Vector2();

    private xAxis = new Vector3();
    private yAxis = new Vector3();
    private zAxis = new Vector3();

    constructor(camera: OrthographicCamera, domElement: HTMLElement) {
        this.camera = camera;
        this.element = domElement;

        this.element.addEventListener("wheel", this.onWheel, { passive: false });
        this.element.addEventListener("mousedown", this.onMouseDown);
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
    }

    /** Optional hook if you add damping later */
    public update(): void {
        // no-op (kept for parity with OrbitControls)
    }

    public dispose(): void {
        this.element.removeEventListener("wheel", this.onWheel as any);
        this.element.removeEventListener("mousedown", this.onMouseDown as any);
        window.removeEventListener("mousemove", this.onMouseMove as any);
        window.removeEventListener("mouseup", this.onMouseUp as any);
    }

    // ------- Events -------

    private onWheel = (e: WheelEvent) => {
        if (!this.enabled) return;
        // prevent page scroll
        e.preventDefault();

        const delta = e.deltaY;
        // smooth exponential zoom
        const scale = Math.pow(0.95, this.zoomSpeed * (delta > 0 ? 1 : -1));
        this.camera.zoom = this.clamp(this.camera.zoom * scale, this.minZoom, this.maxZoom);
        this.camera.updateProjectionMatrix();
    };

    private onMouseDown = (e: MouseEvent) => {
        if (!this.enabled) return;
        if (e.button !== 0) return; // left only
        if (e.target !== this.element) return;

        this.isPanning = true;
        this.last.set(e.clientX, e.clientY);
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.enabled || !this.isPanning) return;

        const curr = new Vector2(e.clientX, e.clientY);
        const dx = curr.x - this.last.x;
        const dy = curr.y - this.last.y;
        this.last.copy(curr);

        // world units per pixel in X/Y given current zoom and viewport
        const width = this.element.clientWidth;
        const height = this.element.clientHeight;

        const worldWidth = (this.camera.right - this.camera.left) / this.camera.zoom;
        const worldHeight = (this.camera.top - this.camera.bottom) / this.camera.zoom;

        const unitsPerPixelX = (worldWidth / width) * this.panSpeed;
        const unitsPerPixelY = (worldHeight / height) * this.panSpeed;

        // camera basis: xAxis (right), yAxis (up), zAxis (forward)
        this.camera.matrixWorld.extractBasis(this.xAxis, this.yAxis, this.zAxis);

        // Drag feels natural when the scene follows the cursor:
        // move camera opposite to cursor delta in screen space.
        const pan = new Vector3()
        .addScaledVector(this.xAxis, -dx * unitsPerPixelX)
        .addScaledVector(this.yAxis,  dy * unitsPerPixelY);

        this.camera.position.add(pan);
        this.camera.updateMatrixWorld(true);
    };

    private onMouseUp = (_e: MouseEvent) => {
        this.isPanning = false;
    };

    private clamp(v: number, lo: number, hi: number) {
        return Math.max(lo, Math.min(hi, v));
    }
}



export {
    BenchRenderer,
    BenchCamera,
    ModelOrbitalControl,
    OrthoPlaneControls
};