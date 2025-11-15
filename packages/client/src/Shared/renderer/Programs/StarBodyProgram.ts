import { AttribType, UniformType } from "@df/types";

import { glsl } from "../EngineUtils";
import { ShaderMixins } from "../WebGL/ShaderMixins";

const a = {
  position: "a_position",
  color: "a_color",
  color2: "a_color2",
  color3: "a_color3",
  rectPos: "a_rectPos",
  props2: "a_props2",
  props: "a_props",
};
const u = {
  matrix: "u_matrix",
  timeMatrix: "u_timeMatrix",
  time: "u_time",
};
const v = {
  position: "v_position",
  color: "v_color",
  color2: "v_color2",
  color3: "v_color3",
  rectPos: "v_rectPos",
  seed: "v_seed",
  eps: "v_eps",
  alpha: "v_alpha",
  distort: "v_distort",
  morphSpeed: "v_morphSpeed",
  octaves: "v_octaves",
  numClouds: "v_numClouds",
  showBeach: "v_showBeach",
};

export const STARBODY_PROGRAM_DEFINITION = {
  uniforms: {
    matrix: { name: u.matrix, type: UniformType.Mat4 },
    timeMatrix: { name: u.timeMatrix, type: UniformType.Mat4 },
    time: { name: u.time, type: UniformType.Float },
  },
  attribs: {
    position: {
      dim: 3,
      name: a.position,
      type: AttribType.Float,
      normalize: false,
    },
    rectPos: {
      dim: 2,
      name: a.rectPos,
      type: AttribType.Float,
      normalize: false,
    },
    color: {
      dim: 3,
      name: a.color,
      type: AttribType.UByte,
      normalize: true,
    },
    color2: {
      dim: 3,
      name: a.color2,
      type: AttribType.UByte,
      normalize: true,
    },
    color3: {
      dim: 3,
      name: a.color3,
      type: AttribType.UByte,
      normalize: true,
    },
    props: {
      dim: 4,
      name: a.props,
      type: AttribType.Float,
      normalize: false,
    },
    props2: {
      dim: 4,
      name: a.props2,
      type: AttribType.Float,
      normalize: false,
    },
  },
  vertexShader: glsl`
    in vec4 ${a.position};
    in vec4 ${a.color};
    in vec4 ${a.color2};
    in vec4 ${a.color3};
    in vec2 ${a.rectPos};
    in vec4 ${a.props2};
    in vec4 ${a.props};

    uniform mat4 ${u.matrix};

    out vec4 ${v.position};
    out vec4 ${v.color};
    out vec4 ${v.color2};
    out vec4 ${v.color3};
    out vec2 ${v.rectPos};
    out float ${v.seed};
    out float ${v.eps};
    out float ${v.alpha};
    out float ${v.distort};
    out float ${v.octaves};
    out float ${v.numClouds};
    out float ${v.morphSpeed};
    out float ${v.showBeach};

    void main() {
      vec4 realPos = ${u.matrix} * ${a.position};
      gl_Position = realPos;

      ${v.position} = ${a.position};
      ${v.color} = ${a.color};
      ${v.color2} = ${a.color2};
      ${v.color3} = ${a.color3};
      ${v.rectPos} = ${a.rectPos};

      ${v.seed} = ${a.props2}.x;
      ${v.eps} = ${a.props2}.y;
      ${v.alpha} = ${a.props2}.z;
      ${v.distort} = ${a.props2}.w;

      ${v.octaves} = ${a.props}.x;
      ${v.numClouds} = ${a.props}.y;
      ${v.morphSpeed} = ${a.props}.z;
      ${v.showBeach} = ${a.props}.w;
    }
  `,
  fragmentShader: glsl`
    ${ShaderMixins.PI}

    precision highp float;
    in vec4 ${v.position};
    in vec4 ${v.color};
    in vec4 ${v.color2};
    in vec4 ${v.color3};
    in vec2 ${v.rectPos};
    in float ${v.seed};
    in float ${v.eps};
    in float ${v.alpha};
    in float ${v.distort};

    in float ${v.octaves};
    in float ${v.numClouds};
    in float ${v.morphSpeed};
    in float ${v.showBeach};

    uniform mat4 ${u.timeMatrix};
    uniform float ${u.time};

    out vec4 outColor;

    ${ShaderMixins.simplex4}
    ${ShaderMixins.seededRandom}
    ${ShaderMixins.blend}
    ${ShaderMixins.arcTan}

    float r = 1.0;
    float inR = 0.9;

    // returns [rho, theta, phi]
    vec3 getSpherical(vec3 coords) {
      float x = coords.x; float y = coords.y; float z = coords.z;
      float rho = length(coords);
      float theta = arcTan(y, x);
      float phi = acos(z / rho);
      return vec3(rho, theta, phi);
    }

    // Star surface function - creates bright, glowing surface
    float starSurfaceFn(vec3 coords) {
      float distort = ${v.distort};
      vec4 rot = ${u.timeMatrix} * vec4(coords, 1.);
      // Faster rotation for star
      float n = snoise(vec4(rot.xyz * 2.0, ${u.time} * (2.0 - 6. * distort)));
      // More uniform, brighter surface
      return (1. - distort * 0.5) + distort * 0.5 * n;
    }

    float starSurfaceAtSpherical(float rho, float theta, float phi) {
      float x = rho * sin(phi) * cos(theta);
      float y = rho * sin(phi) * sin(theta);
      float z = rho * cos(phi);
      return starSurfaceFn(vec3(x, y, z));
    }

    // Star color - bright, glowing, radial gradient
    vec4 getStarColor(vec3 tCoords, float offW) {
      float offX = seededRandom(${v.seed}) * 8376.0;
      float offY = seededRandom(${v.seed} * 2.0) * 8376.0;
      float offZ = seededRandom(${v.seed} * 3.0) * 8376.0;

      vec3 nIn3 = tCoords * 1.8 + vec3(offX, offY, offZ);
      vec4 nIn = vec4(nIn3, offW);

      float n = 0.;
      for (float i = 0.; i < ${v.octaves}; i += 1.) {
        float fac = pow(2.0, i);
        n += snoise(nIn * fac) * (1. / fac);
      }

      // Star colors - bright core to outer glow
      // Core: very bright white-yellow
      vec3 coreColor = mix(${v.color}.rgb, vec3(1.0, 0.98, 0.85), 0.7) * 2.2;
      // Mid: bright base color
      vec3 midColor = ${v.color}.rgb * 1.6;
      // Outer: glowing base color
      vec3 outerColor = mix(${v.color}.rgb, ${v.color2}.rgb, 0.3) * 1.2;

      // Radial gradient based on noise
      vec3 starColor = n > 0.3 ? coreColor : n > -0.1 ? midColor : outerColor;

      return vec4(starColor, 1.0);
    }

    bool isStar(float r, float theta) {
      float limit = starSurfaceAtSpherical(1., theta, PI / 2.);
      return r < limit;
    }

    vec4 getStarBodyColor(float xPre, float yPre, float offW) {
      /* do transformations */
      float xNorm = xPre * (1. / inR);
      float yNorm = yPre * (1. / inR);
      float zNorm = sqrt(1. - pow(xNorm, 2.0) - pow(yNorm, 2.0));
      vec3 normalized = vec3(xNorm, yNorm, zNorm);

      vec4 rot = ${u.timeMatrix} * vec4(normalized, 1.);
      vec3 image = rot.xyz;

      vec3 spherical = getSpherical(normalized);
      float rho = spherical.x;
      float theta = spherical.y;
      float phi = spherical.z;
      float r = length(vec2(xNorm, yNorm));

      float morph = starSurfaceAtSpherical(rho, theta, phi);

      // get star color
      vec4 starColor = getStarColor(image.xyz * morph, offW);

      // check if it should be inside or not
      bool isStar = isStar(r, theta);

      // filter out the stuff that's not inside
      vec4 bodyColor = isStar ? starColor : vec4(0.0);

      return bodyColor;
    }

    // Corona/atmosphere effect for star with electromagnetic beam pulses
    vec4 getCoronaColor(float xPre, float yPre) {
      float r = length(vec2(xPre, yPre));

      // Corona extends further beyond the main body (bigger range)
      if (r > 1.3 || r < 0.7) return vec4(0.0);

      // Calculate angle for radial deformation
      float theta = arcTan(yPre, xPre);

      // Create deformation using multiple noise layers
      vec4 rot = ${u.timeMatrix} * vec4(xPre, yPre, 0.0, 1.0);

      // Base noise for general deformation
      float baseNoise = snoise(vec4(rot.xyz * 4.0, ${u.time} * 1.5));

      // Radial deformation - creates wavy edges
      float radialNoise = snoise(vec4(
        cos(theta) * 6.0 + ${u.time} * 0.8,
        sin(theta) * 6.0 + ${u.time} * 0.8,
        r * 10.0,
        ${u.time} * 0.5
      ));

      // Angular deformation - creates beam pulse locations
      float angularNoise = snoise(vec4(
        theta * 8.0,
        r * 5.0,
        ${u.time} * 2.0,
        0.0
      ));

      // Combine deformations for bigger effect
      float deformation = baseNoise * 0.4 + radialNoise * 0.4 + angularNoise * 0.2;

      // Apply deformation to radius - creates wavy, distorted ring
      float deformedR = r + deformation * 0.15;

      // Create electromagnetic beam pulses instead of cuts
      // Beam pulse detection - where beams should appear
      float beamAngle = theta * 8.0;
      float beamNoise = snoise(vec4(
        beamAngle,
        ${u.time} * 1.5,
        0.0,
        0.0
      ));

      // Beam pulse timing - pulses appear and fade
      float beamPhase = mod(${u.time} * 2.0 + beamNoise * 3.0, 4.0);
      float beamIntensity = 0.0;

      // Beam appears quickly, fades slowly
      if (beamPhase < 0.5) {
        beamIntensity = beamPhase / 0.5; // Fade in
      } else if (beamPhase < 2.0) {
        beamIntensity = 1.0 - (beamPhase - 0.5) / 1.5; // Fade out
      }

      // Only show beams in certain directions (based on noise) - further reduced count
      float beamThreshold = 0.85; // Increased threshold to further reduce beam count (was 0.7)
      bool hasBeam = beamNoise > beamThreshold && beamIntensity > 0.1;

      // Beam extends outward from ring edge, but stays within visible container
      float beamStartR = 0.8;
      float beamEndR = 1.01; // Reduced to stay within max rendered circle (was 1.4)

      // Flame-like beam shape - organic, wavy, flickering
      float angleFromBeam = mod(abs(theta - (beamAngle / 8.0)), PI);

      // Create flame-like waviness using noise
      float flameWave = snoise(vec4(
        beamAngle * 2.0,
        r * 8.0 + ${u.time} * 3.0,
        ${u.time} * 2.0,
        0.0
      ));

      // Flame flicker - rapid variation
      float flameFlicker = snoise(vec4(
        beamAngle * 3.0,
        ${u.time} * 8.0,
        0.0,
        0.0
      ));

      // Wavy flame shape - wider at base, narrower at tip
      float baseWidth = 0.2; // Wider at base
      float tipWidth = 0.08; // Narrower at tip
      float distFromStart = (r - beamStartR) / (beamEndR - beamStartR);
      float currentWidth = mix(baseWidth, tipWidth, distFromStart);

      // Add wave distortion to angle
      float waveOffset = flameWave * 0.3 * (1.0 - distFromStart); // Stronger at base
      float adjustedAngle = angleFromBeam + waveOffset;

      // Flame shape with waviness
      float beamShape = 1.0 - smoothstep(0.0, currentWidth, adjustedAngle);
      // Add flicker variation
      beamShape *= (0.7 + flameFlicker * 0.3);
      float beamDistFade = 1.0;
      if (r < beamStartR) {
        beamDistFade = 0.0; // Inside ring, no beam
      } else if (r > beamEndR) {
        beamDistFade = 0.0; // Cut off at max radius - no beam beyond
      } else {
        beamDistFade = smoothstep(beamStartR, beamStartR + 0.1, r); // Fade in from ring
        // Fade out as approaching max radius
        beamDistFade *= 1.0 - smoothstep(beamEndR - 0.1, beamEndR, r);
      }

      // Flame-like color gradient - bright at base, dimmer at tip (like fire)
      vec3 sunCoreColor = mix(${v.color}.rgb, vec3(1.0, 0.98, 0.85), 0.7) * 2.2;
      vec3 flameTipColor = mix(${v.color}.rgb, vec3(1.0, 0.9, 0.7), 0.5) * 1.5; // Slightly dimmer

      // Color varies with distance and flicker
      float colorMix = distFromStart * 0.5 + flameFlicker * 0.2;
      vec3 beamColor = mix(sunCoreColor, flameTipColor, colorMix);

      float beamAlpha = beamIntensity * beamShape * beamDistFade * 0.8;

      // Corona ring intensity
      float coronaIntensity = 1.0 - smoothstep(0.7, 1.3, deformedR);

      // Where beams appear, reduce ring intensity (create "cut" effect)
      float ringCut = hasBeam ? (1.0 - beamShape * 0.6) : 1.0;
      coronaIntensity *= ringCut;

      // Add pulsing variation
      float pulseNoise = snoise(vec4(rot.xyz * 3.0, ${u.time} * 1.5)) * 0.3 + 0.7;
      coronaIntensity *= pulseNoise;

      // Bright corona glow
      vec3 coronaColor = mix(${v.color}.rgb, vec3(1.0, 0.95, 0.8), 0.5) * 1.5;

      // Combine corona ring and beam
      vec4 coronaRing = vec4(coronaColor, coronaIntensity * 0.5);
      vec4 beamPulse = vec4(beamColor * 1.5, beamAlpha);

      // Blend beam over corona
      return blend(beamPulse, coronaRing);
    }

    // Electromagnetic pulses radiating outward from the sun
    vec4 getElectromagneticPulses(float xPre, float yPre) {
      float r = length(vec2(xPre, yPre));

      // Pulses extend beyond the sun's surface
      if (r < 0.95 || r > 1.5) return vec4(0.0);

      // Calculate angle for radial pulse direction
      float theta = arcTan(yPre, xPre);

      // Create multiple pulse sources using noise
      float pulseTime = ${u.time} * 2.0;
      float pulseSeed = ${v.seed} * 0.1;

      // Generate random pulse directions and timings
      vec4 pulseNoise = vec4(
        cos(theta) * 5.0 + pulseSeed,
        sin(theta) * 5.0 + pulseSeed * 2.0,
        r * 8.0,
        pulseTime
      );

      float pulseNoiseValue = snoise(pulseNoise);

      // Create pulsing effect - pulses appear and fade
      float pulsePhase = mod(pulseTime + pulseNoiseValue * 2.0, 3.0);
      float pulseIntensity = 0.0;

      // Pulse appears quickly, fades slowly
      if (pulsePhase < 0.3) {
        pulseIntensity = pulsePhase / 0.3; // Fade in
      } else if (pulsePhase < 1.0) {
        pulseIntensity = 1.0 - (pulsePhase - 0.3) / 0.7; // Fade out
      }

      // Only show pulses in certain directions (random based on noise)
      if (pulseNoiseValue < 0.3) return vec4(0.0);

      // Distance from sun edge affects pulse visibility
      float distFromEdge = r - 0.95;
      float maxDist = 0.55; // 1.5 - 0.95
      float distFade = 1.0 - smoothstep(0.0, maxDist, distFromEdge);

      // Radial pulse pattern - stronger along certain angles
      float angleNoise = snoise(vec4(theta * 3.0, pulseTime * 0.5, 0.0, 0.0));
      float radialIntensity = angleNoise > 0.2 ? 1.0 : 0.0;

      // Electromagnetic colors: cyan, blue, white
      vec3 emColor1 = vec3(0.2, 0.8, 1.0); // Cyan
      vec3 emColor2 = vec3(0.4, 0.6, 1.0); // Blue
      vec3 emColor3 = vec3(0.9, 0.95, 1.0); // White-blue

      // Mix colors based on distance and noise
      vec3 pulseColor = mix(emColor1, emColor2, distFromEdge / maxDist);
      pulseColor = mix(pulseColor, emColor3, pulseNoiseValue * 0.5);

      // Calculate final intensity
      float finalIntensity = pulseIntensity * distFade * radialIntensity * 0.6;

      return vec4(pulseColor * 1.5, finalIntensity);
    }

    void main() {
      float xPre = ${v.rectPos}.x;
      float yPre = ${v.rectPos}.y;
      float r = length(${v.rectPos});

      // star body
      vec4 starColor = getStarBodyColor(xPre, yPre, ${u.time} * ${v.morphSpeed} * 1.5);

      // do antialiasing for star body only
      float ratio = (inR - r) / ${v.eps};
      if (ratio < 1.) {
        starColor.a *= ratio;
      }

      // Add corona/ring effect around sun
      vec4 coronaColor = getCoronaColor(xPre, yPre);

      // Add electromagnetic pulses (extend beyond sun body)
      vec4 pulseColor = getElectromagneticPulses(xPre, yPre);

      // Blend: pulses -> corona -> star body
      vec4 myColor = blend(pulseColor, blend(coronaColor, starColor));

      // Don't discard if pulses are visible (even if star body is not)
      if (myColor.a < 0.01) discard;

      myColor.a *= ${v.alpha};
      outColor = myColor;
    }
  `,
};
