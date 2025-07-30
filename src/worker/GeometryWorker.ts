import { GeometryUtil, type GeometryRunnableFunctions } from "../geometry/GeometryUtil";

self.onmessage = (e: MessageEvent<{ fn: GeometryRunnableFunctions; payload: any[] }>) => {
    const { fn, payload } = e.data;
    if (typeof GeometryUtil[fn] === 'function') {
        const func = GeometryUtil[fn] as Function;
        GeometryUtil.deserializeAll(payload);
        const result = GeometryUtil.serializeAsType(func(...payload));
        self.postMessage({ result });
    } else {
        self.postMessage({ error: `Unknown function: ${fn}` });
    }
};
