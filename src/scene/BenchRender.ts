import { 
    PerspectiveCamera, 
    Scene, 
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
    public readonly outlinePass;
    constructor(scene: Scene, camera: PerspectiveCamera) {
        super({ antialias: true });
        this.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.domElement);
        window.addEventListener('resize', this.updateSize.bind(this));
        // Composer
        this.composer = new EffectComposer(this);
        this.composer.addPass(new RenderPass(scene, camera));
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

    updateSize(): void {
        this.setSize(window.innerWidth, window.innerHeight);
    }
}

class FullScreenCamera extends PerspectiveCamera {
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

class ModelOrbitalControl extends OrbitControls{
    constructor(camera: PerspectiveCamera, renderer: WebGLRenderer) {
        super(camera, renderer.domElement);
        //this.enableDamping = true;
        //this.dampingFactor = 0.05;
        this.target.set(0, 0, 0); // rotate around the origin
        this.update();
    }
}



export {
    BenchRenderer,
    FullScreenCamera,
    ModelOrbitalControl
};