import { AttribType, UniformType } from "@df/types";

import { glsl } from "../EngineUtils";
import { ShaderMixins } from "../WebGL/ShaderMixins";

const a = {
  position: "a_position",
  rectPos: "a_rectPos",
  color: "a_color",
  layer: "a_layer", // Layer identifier: 0=background, 1=outer ring, 2=middle, 3=inner ring, 4=core
  rotation: "a_rotation", // Rotation offset for this element
};

const u = {
  matrix: "u_matrix",
  time: "u_time",
  innerRotation: "u_innerRotation",
  outerRotation: "u_outerRotation",
  weaponsCount: "u_weaponsCount",
  hullShieldCount: "u_hullShieldCount",
};

const v = {
  color: "v_color",
  rectPos: "v_rectPos",
  layer: "v_layer",
  rotation: "v_rotation",
};

export const STARBASE_PROGRAM_DEFINITION = {
  uniforms: {
    matrix: { name: u.matrix, type: UniformType.Mat4 },
    time: { name: u.time, type: UniformType.Float },
    innerRotation: { name: u.innerRotation, type: UniformType.Float },
    outerRotation: { name: u.outerRotation, type: UniformType.Float },
    weaponsCount: { name: u.weaponsCount, type: UniformType.Float },
    hullShieldCount: { name: u.hullShieldCount, type: UniformType.Float },
  },
  attribs: {
    position: {
      dim: 3,
      type: AttribType.Float,
      normalize: false,
      name: a.position,
    },
    rectPos: {
      dim: 2,
      type: AttribType.Float,
      normalize: false,
      name: a.rectPos,
    },
    color: {
      dim: 3,
      type: AttribType.UByte,
      normalize: true,
      name: a.color,
    },
    layer: {
      dim: 1,
      type: AttribType.Float,
      normalize: false,
      name: a.layer,
    },
    rotation: {
      dim: 1,
      type: AttribType.Float,
      normalize: false,
      name: a.rotation,
    },
  },
  vertexShader: glsl`
    in vec3 ${a.position};
    in vec3 ${a.color};
    in vec2 ${a.rectPos};
    in float ${a.layer};
    in float ${a.rotation};

    uniform mat4 ${u.matrix};
    uniform float ${u.time};
    uniform float ${u.innerRotation};
    uniform float ${u.outerRotation};
    uniform float ${u.weaponsCount};
    uniform float ${u.hullShieldCount};

    out vec3 ${v.color};
    out vec2 ${v.rectPos};
    out float ${v.layer};
    out float ${v.rotation};

    void main() {
      gl_Position = ${u.matrix} * vec4(${a.position}, 1.0);
      ${v.color} = ${a.color};
      ${v.rectPos} = ${a.rectPos};
      ${v.layer} = ${a.layer};
      ${v.rotation} = ${a.rotation};
    }
  `,
  fragmentShader: glsl`
    ${ShaderMixins.PI}

    precision highp float;

    in vec3 ${v.color};
    in vec2 ${v.rectPos};
    in float ${v.layer};
    in float ${v.rotation};

    uniform float ${u.time};
    uniform float ${u.innerRotation};
    uniform float ${u.outerRotation};
    uniform float ${u.weaponsCount};
    uniform float ${u.hullShieldCount};

    out vec4 outColor;

    ${ShaderMixins.simplex4}
    ${ShaderMixins.modFloat}
    ${ShaderMixins.mod2pi}
    ${ShaderMixins.arcTan}
    ${ShaderMixins.fade}

    void main() {
      vec2 pos = ${v.rectPos};
      float r = length(pos);
      float angle = arcTan(pos.y, pos.x);

      // Use time uniform for rotation animations
      float timeInSeconds = ${u.time} * 0.001;
      float innerRot = timeInSeconds * ${u.innerRotation}; // Counter-clockwise (positive)
      float outerRot = -timeInSeconds * ${u.outerRotation}; // Clockwise (negative)

      // Keep uniforms alive (prevent optimization) even though we don't use them for shader drawing
      // These are kept for potential future use, but module icons are now sprite-based
      float _unused_weapons = ${u.weaponsCount};
      float _unused_hullShield = ${u.hullShieldCount};
      // Suppress unused variable warning
      if (_unused_weapons < -999999.0 || _unused_hullShield < -999999.0) discard;

      float alpha = 1.0;

      // Layer 0: Background circle (visible through gaps)
      if (${v.layer} == 0.0) {
        if (r > 1.0) discard;
        if (r < 0.55 || r > 0.90) discard;
        alpha = 0.3;
        outColor = vec4(${v.color}, alpha);
        return;
      }

      // Layer 1: Outer ring - Gray border only (blue circles removed)
      if (${v.layer} == 1.0) {
        float outerRingBorderRadius = 0.90;
        float outerRingBorderThickness = 0.015;
        if (${v.rotation} < -0.5) {
          if (r > outerRingBorderRadius - outerRingBorderThickness && r <= outerRingBorderRadius) {
            float distFromEdge = outerRingBorderRadius - r;
            alpha = 1.0 - smoothstep(outerRingBorderThickness - 0.005, outerRingBorderThickness, distFromEdge);
            vec3 grayColor = vec3(0.7, 0.7, 0.7);
            outColor = vec4(grayColor, alpha);
            return;
          }
          discard;
        }
        // Blue circles removed - discard all non-border elements
        discard;
      }

      // Layer 2: Inner ring structure (red triangles removed)
      if (${v.layer} == 2.0) {
        // Red triangles removed - discard all
        discard;
      }

      // Layer 3: Inner ring structure (wider ring at inner boundary)
      if (${v.layer} == 3.0) {
        float innerRingStart = 0.50;
        float innerRingEnd = 0.60;
        if (r < innerRingStart || r > innerRingEnd) discard;
        float distFromStart = r - innerRingStart;
        float distFromEnd = innerRingEnd - r;
        float startAlpha = smoothstep(0.0, 0.02, distFromStart);
        float endAlpha = smoothstep(0.0, 0.02, distFromEnd);
        alpha = min(startAlpha, endAlpha) * 0.5;
        outColor = vec4(${v.color}, alpha);
        return;
      }

      // Layer 4: Central core
      if (${v.layer} == 4.0) {
        if (abs(${v.rotation} - 0.0) < 0.1) {
          float centerRadius = 0.06;
          if (r > centerRadius) discard;
          alpha = 1.0 - smoothstep(centerRadius - 0.01, centerRadius, r);
          outColor = vec4(${v.color}, alpha);
          return;
        }
        if (abs(${v.rotation} - 1.0) < 0.1) {
          float ringInnerRadius = 0.06;
          float ringOuterRadius = 0.10;
          if (r < ringInnerRadius || r > ringOuterRadius) discard;
          float distFromInner = r - ringInnerRadius;
          float distFromOuter = ringOuterRadius - r;
          float innerAlpha = smoothstep(0.0, 0.01, distFromInner);
          float outerAlpha = smoothstep(0.0, 0.01, distFromOuter);
          alpha = min(innerAlpha, outerAlpha) * 0.7;
          vec3 grayColor = vec3(0.5, 0.5, 0.6);
          outColor = vec4(grayColor, alpha);
          return;
        }
        if (abs(${v.rotation} - 2.0) < 0.1) {
          float circleInnerRadius = 0.10;
          float circleOuterRadius = 0.14;
          if (r < circleInnerRadius || r > circleOuterRadius) discard;
          float distFromInner = r - circleInnerRadius;
          float distFromOuter = circleOuterRadius - r;
          float innerAlpha = smoothstep(0.0, 0.01, distFromInner);
          float outerAlpha = smoothstep(0.0, 0.01, distFromOuter);
          alpha = min(innerAlpha, outerAlpha);
          outColor = vec4(${v.color}, alpha);
          return;
        }
        if (abs(${v.rotation} - 3.0) < 0.1) {
          float borderInnerRadius = 0.14;
          float borderOuterRadius = 0.16;
          if (r < borderInnerRadius || r > borderOuterRadius) discard;
          float distFromInner = r - borderInnerRadius;
          float distFromOuter = borderOuterRadius - r;
          float innerAlpha = smoothstep(0.0, 0.01, distFromInner);
          float outerAlpha = smoothstep(0.0, 0.01, distFromOuter);
          alpha = min(innerAlpha, outerAlpha) * 0.7;
          vec3 grayColor = vec3(0.5, 0.5, 0.6);
          outColor = vec4(grayColor, alpha);
          return;
        }
        discard;
      }

      // Layer 5: Weapon icon (filled triangle) at weaponRadius
      if (${v.layer} == 5.0) {
        float baseAngle = ${v.rotation};
        float rotatedAngle = baseAngle + innerRot;
        float weaponRadius = 0.5;
        vec2 center = vec2(cos(rotatedAngle), sin(rotatedAngle)) * weaponRadius;
        vec2 lp = pos - center;
        float ori = baseAngle;
        float c = cos(-ori), s = sin(-ori);
        vec2 p = vec2(lp.x * c - lp.y * s, lp.x * s + lp.y * c);
        // small filled triangle
        float baseY = 0.10;
        float apexY = -0.06;
        float width = 0.12;
        if (p.y > baseY || p.y < apexY) discard;
        float t = (p.y - apexY) / (baseY - apexY);
        float w = width * t;
        if (abs(p.x) > w * 0.5) discard;
        outColor = vec4(${v.color}, 1.0);
        return;
      }

      // Layer 6: Hull/Shield icon (filled dot) at componentRadius
      if (${v.layer} == 6.0) {
        float baseAngle = ${v.rotation};
        float rotatedAngle = baseAngle - outerRot;
        float componentRadius = 0.75;
        vec2 center = vec2(cos(rotatedAngle), sin(rotatedAngle)) * componentRadius;
        float d = length(pos - center);
        float rad = 0.04; // dot radius inside ring
        if (d > rad) discard;
        outColor = vec4(${v.color}, 1.0);
        return;
      }

      discard;
    }
  `,
};
