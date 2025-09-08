import { BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { BenchGeometry } from "./geometry/BenchGeometry";
import { GeometryUtil } from "./geometry/GeometryUtil";
import { Coplane } from "./geometry/SubGeometries";
import { Primitives } from "./geometry/Primitives";
import { BenchMesh } from "./scene/BenchModel";

function defMesh(geoemtry: BufferGeometry) {
    return new Mesh(geoemtry, new MeshBasicMaterial({ color: "white", side: DoubleSide }));
}

export async function test() {
    const app = window.app;

    const benchGeom = new BenchGeometry();
    benchGeom.buildFrom(GeometryUtil.createIndexedGeometry(
        new PlaneGeometry(2,2,2,2))
    );
    const coplane = new Coplane(benchGeom.faceAt(0));
    const coplaneGeom = Primitives.coplane(coplane);
    console.log(coplaneGeom.attributes.position);
    console.log(coplaneGeom.plane);
    

    const mesh = new BenchMesh(defMesh(coplaneGeom));
    await mesh.toIndexed();
    await mesh.createGeometry();
    await mesh.createWireframe();
    
    app.model.add(mesh);
}