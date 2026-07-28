/** Drawing engine build id — bump when generation semantics change. */
export const DRAWING_ENGINE_VERSION = 'drawing-engine-v1';

/** MVP PRNG id — never change behavior under the same string; ship a new id instead. */
export const PRNG_ALGORITHM_MULBERRY32_V1 = 'mulberry32-v1';

export enum PlacementMode {
  random = 'random',
  seeded = 'seeded',
}
