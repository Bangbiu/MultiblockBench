import { BufferGeometry, Triangle } from "three";

declare module 'three' {
    interface BufferGeometry {
        forEachPosition(callback: (pos: Float32Array, index: number) => void): void;
    }

    interface Triangle {
        toArray(array: ArrayLike<number>, offset: number): number
    }
}

BufferGeometry.prototype.forEachPosition = function (
    callback: (pos: Float32Array, index: number) => void
): void {
    const attr = this.attributes.position;
    if (!attr) throw new Error("Missing position attribute");
    const array = attr.array;
    const itemSize = attr.itemSize;

    for (let i = 0; i < attr.count; i++) {
        const offset = i * itemSize;
        const sub = array.subarray(offset, offset + itemSize);
        callback(sub, i);
    }
};

Triangle.prototype.toArray = function (
    array: ArrayLike<number>, offset: number = 0
): number {
    this.a.toArray(array, offset); offset += 3;
    this.b.toArray(array, offset); offset += 3;
    this.c.toArray(array, offset); offset += 3;
    return offset;
}