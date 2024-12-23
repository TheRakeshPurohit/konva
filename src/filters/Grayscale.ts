import { Filter } from '../Node';

/**
 * Grayscale Filter
 * @function
 * @memberof Konva.Filters
 * @param {Object} imageData
 * @example
 * node.cache();
 * node.filters([Konva.Filters.Grayscale]);
 */
export const Grayscale: Filter = function (imageData) {
  const data = imageData.data,
    len = data.length;

  for (let i = 0; i < len; i += 4) {
    const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
    // red
    data[i] = brightness;
    // green
    data[i + 1] = brightness;
    // blue
    data[i + 2] = brightness;
  }
};
