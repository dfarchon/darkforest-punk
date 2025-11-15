// ⚠️ UNUSED - DELETE THIS FILE
// Only used by SunRayRenderer.ts which is unused (rays removed from sun rendering)
import { AttribType, UniformType } from "@df/types";

import { glsl } from "../EngineUtils";
import { ShaderMixins } from "../WebGL/ShaderMixins";

const a = {
  position: "a_position",
  rectPos: "a_rectPos", // note that this is [+x, +y] to the upper-right
  color: "a_color",
};
const u = {
  matrix: "u_matrix", // matrix to convert from world coords to clipspace
  time: "u_time",
};
const v = {
  color: "v_color",
  rectPos: "v_rectPos",
};

export const STARRAY_PROGRAM_DEFINITION = {
  uniforms: {
    matrix: { name: u.matrix, type: UniformType.Mat4 },
    time: { name: u.time, type: UniformType.Float },
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
  },
  vertexShader: glsl`
    in vec4 ${a.position};
    in vec4 ${a.color};
    in vec2 ${a.rectPos};

    uniform mat4 ${u.matrix};

    out vec4 ${v.color};
    out vec2 ${v.rectPos};

    void main() {
      gl_Position = ${u.matrix} * ${a.position};

      ${v.color} = ${a.color};
      ${v.rectPos} = ${a.rectPos};
    }
  `,
  fragmentShader: glsl`
    ${ShaderMixins.PI}

    precision highp float;

    in vec4 ${v.color};
    in vec2 ${v.rectPos};

    uniform float ${u.time};

    out vec4 outColor;

    ${ShaderMixins.simplex4}
    ${ShaderMixins.modFloat}
    ${ShaderMixins.mod2pi}
    ${ShaderMixins.arcTan}
    ${ShaderMixins.fade}

    void main() {
      float yP = ${v.rectPos}.y;
      float xP = ${v.rectPos}.x;

      /* Star ray calculation - more uniform and brighter */
      float nX = xP / (0.4 * yP);

      float offsetDir = ${v.rectPos}.y > 0. ? -1. : 1.;
      float timeOffset = ${u.time} * 3.0 * offsetDir;
      float nY = yP + timeOffset;

      float nZ = ${u.time} * 0.5;
      vec4 nIn = vec4(nX * 4.0, nY * 4.0, nZ, 0.);

      /* More uniform noise for star rays */
      float n = snoise(nIn) * 0.25 + 0.88;

      /* Calculate alpha from midline using theta */
      float theta = arcTan(yP, xP);
      float dist1 = abs(theta - PI / 2.);
      float dist2 = abs(theta - 3. * PI / 2.);
      float distFromMid = min(dist1, dist2);

      /* Wider rays for star */
      const float interval = PI / 12.;

      float baseAlpha = (distFromMid > interval) ? 0. : 1.;
      float midAlpha = baseAlpha * fade(distFromMid / interval, 0.25);

      /* Calculate alpha from height - smoother fade */
      float heightAlpha = fade(abs(yP), 0.9) * fade(abs(yP), 0.4);

      /* Add pulsing effect */
      float pulse = sin(${u.time} * 2.0) * 0.1 + 0.9;
      heightAlpha *= pulse;

      /* Calculate total alpha */
      float alpha = midAlpha * heightAlpha * n;

      /* Star ray colors - brighter and more vibrant */
      vec3 baseColor = ${v.color}.rgb;

      /* Core ray: very bright white-yellow */
      vec3 coreRayColor = mix(baseColor, vec3(1.0, 0.95, 0.85), 0.5) * 1.8;

      /* Mid ray: bright base color */
      vec3 midRayColor = baseColor * 1.5;

      /* Outer ray: dimmer base color */
      vec3 outerRayColor = baseColor * 0.9;

      /* Select color based on distance from midline */
      vec3 rayColor;
      float midDist = distFromMid / interval;
      if (midDist < 0.3) {
        rayColor = mix(coreRayColor, midRayColor, midDist / 0.3);
      } else {
        rayColor = mix(midRayColor, outerRayColor, (midDist - 0.3) / 0.7);
      }

      /* Apply noise variation */
      rayColor *= n;

      /* Calculate final color */
      vec4 myColor = vec4(rayColor, 1.0);
      myColor.a *= alpha;

      outColor = myColor;
    }
  `,
};
