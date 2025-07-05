import { Group, Mesh, Vector3 } from "three"


class BenchExtraction extends Mesh {

}

class BenchOutput extends Group {
    public readonly meshes: Array<BenchExtraction>;
    constructor() {
        super();
        this.meshes = new Array();
        this.scale.copy(BenchOutput.BENCH_SCALE);
    }

    public static readonly BENCH_SCALE = new Vector3(16, 16, 16);
}

export {
    BenchOutput,
    BenchExtraction
}