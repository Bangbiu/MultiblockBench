import { AmbientLight, DirectionalLight, Group } from "three";

class BenchLighting extends Group {
    constructor() {
        super();
        const light = new DirectionalLight(0xffffff, 1);
        light.position.set(-32, 32, -32);
        this.add(light);

        const ambientLight = new AmbientLight(0xffffff, 0.3); // color, intensity
        this.add(ambientLight);
    }
}

export {
    BenchLighting
}