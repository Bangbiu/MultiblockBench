import { GeometryUtil, type GeometryFunctionName } from "../util/GeometryUtil";


self.onmessage = (e: MessageEvent<{ fn: GeometryFunctionName; payload: any[] }>) => {
    const { fn, payload } = e.data;
    if (typeof GeometryUtil[fn] === 'function') {
      const func = GeometryUtil[fn] as Function;
      const result = func(...payload);
      self.postMessage({ result });
    } else {
      self.postMessage({ error: `Unknown function: ${fn}` });
    }
};
