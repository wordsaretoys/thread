<script id="vs-path" type="x-shader/x-vertex">

attribute vec3 position;
attribute vec2 texture;

uniform mat4 projector;
uniform mat4 modelview;

varying vec3 obj;
varying vec3 eye;
varying vec2 tex;

void main(void) {
	vec4 pos = modelview * vec4(position, 1.0);
	gl_Position = projector * pos;
	eye = pos.xyz;
	obj = position;
	tex = texture;
}

</script>

<script id="fs-materials" type="x-shader/x-fragment">

precision mediump float;

vec3 dirtTexture(sampler2D walk, vec2 tex) {
	return (texture2D(walk, tex * 0.5).r * vec3(0.78, 0.47, 0.31) + 
			texture2D(walk, tex * 2.0).r * vec3(0.72, 0.66, 0.35) +
			texture2D(walk, tex * 4.0).r * vec3(0.68, 0.52, 0.21)) * 0.33;
}

vec3 rockTexture(sampler2D walk, vec2 tex) {
	return (texture2D(walk, tex * 1.0).r * vec3(0.47, 0.55, 0.79) + 
			texture2D(walk, tex * 2.0).r * vec3(0.91, 0.94, 0.89) +
			texture2D(walk, tex * 8.0).r * vec3(0.55, 0.66, 0.44)) * 0.25;
}

vec3 grassTexture(sampler2D cros, vec2 tex) {
	return (texture2D(cros, tex * 1.0).r * vec3(0.21, 0.85, 0.29) + 
			texture2D(cros, tex * 4.0).r * vec3(0.76, 0.81, 0.44)) * 0.5;
}

</script>

<script id="fs-fog" type="x-shader/x-fragment">
precision mediump float;

vec3 fog(vec3 col, vec3 eye) {
	float l = clamp(length(eye) / 6.0, 0.0, 1.0);
	return mix(col, vec3(0.75, 0.75, 0.75), l);
}

</script>

<script id="fs-road" type="x-shader/x-fragment">

precision mediump float;

const float PI = 3.141592654;

uniform sampler2D walk0;
uniform sampler2D walk1;
uniform sampler2D line0;
uniform sampler2D cros0;

varying vec3 obj;
varying vec3 eye;
varying vec2 tex;

void main(void) {
	// use positions as texture coordinates here
	// to avoid distortion caused by road curvature
	vec3 rt = rockTexture(line0, obj.xz);
	vec3 dt = dirtTexture(walk0, obj.xz);
	vec3 gt = grassTexture(cros0, obj.xz);

	// can use texture coordinates for mixing, though
	float m1 = pow(sin(tex.x * PI), 2.0);
	float m2 = texture2D(walk1, tex).r;
	vec3 col = mix(mix(gt, dt, m1), mix(dt, rt, m2), m1);
	
	col = fog(col, eye);
	
	gl_FragColor = vec4(col, 1.0);
}

</script>

<script id="fs-cliff" type="x-shader/x-fragment">

precision mediump float;

uniform sampler2D walk0;
uniform sampler2D walk1;
uniform sampler2D line0;
uniform sampler2D cros0;

varying vec3 obj;
varying vec3 eye;
varying vec2 tex;

void main(void) {
	vec3 rt = rockTexture(line0, tex);
	vec3 dt = dirtTexture(walk0, tex);
	vec3 gt = grassTexture(cros0, tex);
	float m = texture2D(walk1, tex * 0.1).r;
	vec3 col = mix( mix(rt, dt, m), mix(dt, gt, m), m);

	col = fog(col, eye);
	
	gl_FragColor = vec4(col, 1.0);
}

</script>

<script id="fs-brush" type="x-shader/x-fragment">

precision mediump float;

const float PI = 3.141592654;

uniform sampler2D stem0;
uniform sampler2D walk0;

varying vec3 obj;
varying vec3 eye;
varying vec2 tex;

void main(void) {
	float m = texture2D(stem0, vec2(0.1 * tex.x / tex.y, tex.y)).r * texture2D(walk0, tex).r;
	vec3 col = 1.5 * m * abs(sin(obj * 10.0));

	col = fog(col, eye);
	
	gl_FragColor = vec4(col, 1.0);
	
	if (m * (1.0 - length(tex)) < 0.025)
		discard;
}

</script>

<script id="fs-rocks" type="x-shader/x-fragment">

precision mediump float;

uniform sampler2D walk0;
uniform sampler2D walk1;

varying vec3 obj;
varying vec3 eye;
varying vec2 tex;

void main(void) {

	vec3 col = rockTexture(walk0, tex) + rockTexture(walk1, tex * 2.0);
	col = fog(col, eye);
	
	gl_FragColor = vec4(col, 1.0);
}

</script>

