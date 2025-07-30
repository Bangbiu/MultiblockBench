import { 
    AxesHelper, 
    BoxGeometry, 
    CatmullRomCurve3, 
    DoubleSide, 
    ExtrudeGeometry, 
    GridHelper, 
    Group, 
    Mesh, 
    MeshBasicMaterial, 
    MeshStandardMaterial, 
    PlaneGeometry, 
    Shape, 
    TubeGeometry, 
    Vector2, 
    Vector3
} from "three";


class BenchGrid extends Group {
    constructor() {
        super();
        const config = window.config.grid;
        // Grid helper on the XZ plane 1m per block segment
        this.add(new GridHelper(160, 160, config.unit_color, config.unit_color));
        // Grid helper on the XZ plane 16m per block
        this.add(new GridHelper(160, 10, config.block_color, config.block_color));
        
        // Axes helper to visualize X, Y, Z
        this.add(new AxesHelper(80));

        const planeSize = 16;

        const plane = new Mesh(
            new PlaneGeometry(planeSize, planeSize),
            config.origin_plane_mat
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