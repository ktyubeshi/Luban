//
// Machine Definition
//
export * from './src/machine-definition';
//
// Parameter Resolver
//
export {
    applyParameterModifications, getParameterItem, resetPresetsContext, resolveParameterValues
} from './src/parameter-resolver';
//
// Geometry
//
export { ConvexGeometry } from './src/three-extensions/common/ConvexGeometry';
export {
    checkSceneFaceless
} from './src/three-extensions/common/mesh-utility';


export { mergeVertices } from './src/three-extensions/common/geometry/BufferGeometryUtils';

export { computeAdjacentFaces } from './src/three-extensions/common/GeometryAdjacentFaceGraph';
