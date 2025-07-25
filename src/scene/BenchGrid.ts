import { 
    AxesHelper, 
    BoxGeometry, 
    DoubleSide, 
    GridHelper, 
    Group, 
    Mesh, 
    MeshBasicMaterial, 
    MeshStandardMaterial, 
    PlaneGeometry 
} from "three";


class BenchGrid extends Group {
    constructor() {
        super();
        const config = window.config.grid;
        // Grid helper on the XZ plane 1m per block segment
        this.add(new GridHelper(160, 160, config.unitColor, config.unitColor));
        // Grid helper on the XZ plane 16m per block
        this.add(new GridHelper(160, 10, config.blockColor, config.blockColor));
        
        // Axes helper to visualize X, Y, Z
        this.add(new AxesHelper(80));

        const planeSize = 16;

        const plane = new Mesh(
            new PlaneGeometry(planeSize, planeSize),
            new MeshBasicMaterial({
                color: config.originPlaneColor[0],
                transparent: true,
                opacity: config.originPlaneColor[1],         // make it faint
                side: DoubleSide
            })
        );

        // On Block 0,0,0
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(8,0,8);
        this.add(plane);
    }
}

class DefaultBlock extends Mesh {
    constructor() {
        const geometry = new BoxGeometry();
        const material = new MeshStandardMaterial({ color: 0x00ff88 });
        super(geometry, material);
        this.position.set(8,8,8);
        this.scale.set(16, 16, 16);
    }
}

export {
    BenchGrid,
    DefaultBlock
}