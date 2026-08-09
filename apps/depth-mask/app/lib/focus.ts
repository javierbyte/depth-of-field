export type Point2D = {
  x: number;
  y: number;
};

type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type PlaneProjection = {
  matrix: Matrix3;
  inverse: Matrix3;
  origin: Point2D;
};

const MIN_DETERMINANT = 1e-10;
const MIN_PERSPECTIVE_DIVISOR = 1e-10;

function invertMatrix3(matrix: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const determinant =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(determinant) < MIN_DETERMINANT) {
    return null;
  }

  return [
    (e * i - f * h) / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * i) / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * h - e * g) / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ];
}

function transformPoint(matrix: Matrix3, point: Point2D): Point2D | null {
  const divisor = matrix[6] * point.x + matrix[7] * point.y + matrix[8];

  if (Math.abs(divisor) < MIN_PERSPECTIVE_DIVISOR) {
    return null;
  }

  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / divisor,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / divisor,
  };
}

export function createPlaneProjection(
  transform: string,
  width: number,
  height: number,
): PlaneProjection | null {
  const transformMatrix = new DOMMatrixReadOnly(transform);

  // A CSS-transformed image is a plane (local z = 0). These entries are the
  // 3x3 homography that maps that plane through the element's 4x4 matrix.
  const matrix: Matrix3 = [
    transformMatrix.m11,
    transformMatrix.m21,
    transformMatrix.m41,
    transformMatrix.m12,
    transformMatrix.m22,
    transformMatrix.m42,
    transformMatrix.m14,
    transformMatrix.m24,
    transformMatrix.m44,
  ];
  const inverse = invertMatrix3(matrix);

  if (!inverse) {
    return null;
  }

  return {
    matrix,
    inverse,
    origin: { x: width / 2, y: height / 2 },
  };
}

export function projectPoint(
  projection: PlaneProjection,
  point: Point2D,
): Point2D | null {
  const projected = transformPoint(projection.matrix, {
    x: point.x - projection.origin.x,
    y: point.y - projection.origin.y,
  });

  if (!projected) {
    return null;
  }

  return {
    x: projected.x + projection.origin.x,
    y: projected.y + projection.origin.y,
  };
}

export function unprojectPoint(
  projection: PlaneProjection,
  point: Point2D,
): Point2D | null {
  const unprojected = transformPoint(projection.inverse, {
    x: point.x - projection.origin.x,
    y: point.y - projection.origin.y,
  });

  if (!unprojected) {
    return null;
  }

  return {
    x: unprojected.x + projection.origin.x,
    y: unprojected.y + projection.origin.y,
  };
}
