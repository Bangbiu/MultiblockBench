import { PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three-stdlib';

class FullScreenRenderer extends WebGLRenderer {
    constructor() {
        super({ antialias: true });
        this.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.domElement);
        window.addEventListener('resize', this.updateSize.bind(this));
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
    FullScreenRenderer,
    FullScreenCamera,
    ModelOrbitalControl
};