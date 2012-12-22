/**

	generate and maintain cliff path
	
	@namespace T
	@class path
**/

T.path = {

	rng: SOAR.random.create(T.seed()),

	road: {},
	cliff: {},
	rocks: {},
	brush: {},
	
	/**
		simple mesh transfer of vertexes and indexes
		for mesh objects sent by the worker thread
		
		@method copyMesh
		@param dest object, destination mesh
		@param src object, source mesh
	**/
	
	copyMesh: function(dest, src) {
		dest.load(src.data);
		dest.length = src.length;
		dest.loadIndex(src.indexData);
		dest.indexLength = src.indexLength;
	},
	
	/**
		create and init required objects
		
		@method init
	**/

	init: function() {
		var rng = this.rng;

		function makeWalkTexture(s) {
			var tex = SOAR.space.makeU8(s, s);
			SOAR.pattern.walk(tex, T.seed(), 12, 0.05, 255, 0.5, 0.5, 0.5, 0.5);
			SOAR.pattern.normalize(tex, 0, 255);
			return SOAR.texture.create(T.display, tex);
		}
		
		function makeDotTexture(s, r) {
			var tex = SOAR.space.makeU8(s, s);
			SOAR.pattern.stipple(tex, T.seed(), r, 1, 255);
			return SOAR.texture.create(T.display, tex);
		}
		
		function makeLineTexture(s) {
			var tex = SOAR.space.makeU8(s, s);
			SOAR.pattern.walk(tex, T.seed(), 12, 0.05, 255, 0.03, 0.95, 0.04, 0.85);
			SOAR.pattern.normalize(tex, 0, 255);
			return SOAR.texture.create(T.display, tex);
		}

		function makeCrossTexture(s, r) {
			var tex = SOAR.space.makeU8(s, s);
			var i, il, x, y, a, dx, dy, l;
			for (i = 0, il = s * s * r; i < il; i++) {
				x = Math.floor(rng.get(0, s));
				y = Math.floor(rng.get(0, s));
				a = rng.get(0, SOAR.PIMUL2);
				dx = Math.cos(a);
				dy = Math.sin(a);
				l = Math.floor(rng.get(8, 32));
				SOAR.pattern.scratch(tex, 0.1, 255, x, y, dx, dy, l);
			}
			SOAR.pattern.normalize(tex, 0, 255);
			return SOAR.texture.create(T.display, tex);
		}
		
		function makeStemTexture(s) {
			var tex = SOAR.space.makeU8(s, s);
			var i, x;
			for (i = 0; i < 100; i++) {
				x = rng.get(0, s);
				SOAR.pattern.scratch(tex, 0.5, 255, x, 0, 0, 1, s);
			}
			return SOAR.texture.create(T.display, tex);
		}
		
		// generate road and cliff surface maps
		this.road.map = SOAR.space.make(128);
		SOAR.pattern.randomize(this.road.map, T.seed(), 0, 1);
		this.road.height = SOAR.space.makeLine(this.road.map, 6, 0.05);
		
		this.cliff.map = SOAR.space.make(128, 128);
		SOAR.pattern.walk(this.cliff.map, T.seed(), 8, 0.05, 1, 0.5, 0.5, 0.5, 0.5);
		SOAR.pattern.normalize(this.cliff.map, 0, 1);
		var surf0 = SOAR.space.makeSurface(this.cliff.map, 10, 0.05, 0.1);
		var surf1 = SOAR.space.makeSurface(this.cliff.map, 5, 0.25, 0.5);
		var surf2 = SOAR.space.makeSurface(this.cliff.map, 1, 0.75, 1.5);
		this.cliff.surface = function(y, z) {
			return surf0(y, z) + surf1(y, z) + surf2(y, z);
		};

		// send the maps to the worker thread and let it initialize
		T.worker.postMessage({
			cmd: "init",
			map: {
				road: this.road.map,
				cliff: this.cliff.map
			},
			seed: {
				rocks: T.seed(),
				brush: T.seed()
			}
		});
		
		// generate textures
		this.walk0 = makeWalkTexture(64);
		this.walk1 = makeWalkTexture(64);
		this.dots0 = makeDotTexture(64, 0.1);
		this.line0 = makeLineTexture(64);
		this.cros0 = makeCrossTexture(128, 0.25);
		this.stem0 = makeStemTexture(128);
		
		// generate road resources
		this.road.shader = SOAR.shader.create(
			T.display,
			SOAR.textOf("vs-path"), 
			SOAR.textOf("fs-materials") + SOAR.textOf("fs-fog") + SOAR.textOf("fs-road"),
			["position", "texture"], 
			["projector", "modelview"],
			["walk0", "walk1", "line0", "cros0"]
		);
		
		this.road.mesh = SOAR.mesh.create(T.display, T.display.gl.TRIANGLE);
		this.road.mesh.add(this.road.shader.position, 3);
		this.road.mesh.add(this.road.shader.texture, 2);

		// generate cliff resources
		this.cliff.shader = SOAR.shader.create(
			T.display,
			SOAR.textOf("vs-path"), 
			SOAR.textOf("fs-materials") + SOAR.textOf("fs-fog") + SOAR.textOf("fs-cliff"),
			["position", "texture"], 
			["projector", "modelview"],
			["walk0", "walk1", "line0", "cros0"]
		);
		
		this.cliff.mesh = SOAR.mesh.create(T.display, T.display.gl.TRIANGLE);
		this.cliff.mesh.add(this.cliff.shader.position, 3);
		this.cliff.mesh.add(this.cliff.shader.texture, 2);

		// generate brush resources
		this.brush.shader = SOAR.shader.create(
			T.display,
			SOAR.textOf("vs-path"), 
			SOAR.textOf("fs-fog") + SOAR.textOf("fs-brush"),
			["position", "texture"], 
			["projector", "modelview"],
			["stem0", "walk0"]
		);
		
		this.brush.mesh = SOAR.mesh.create(T.display, T.display.gl.TRIANGLE);
		this.brush.mesh.add(this.brush.shader.position, 3);
		this.brush.mesh.add(this.brush.shader.texture, 2);

		// generate rocks resources
		this.rocks.shader = SOAR.shader.create(
			T.display,
			SOAR.textOf("vs-path"), 
			SOAR.textOf("fs-materials") + SOAR.textOf("fs-fog") + SOAR.textOf("fs-rocks"),
			["position", "texture"], 
			["projector", "modelview"],
			["walk0", "walk1"]
		);
		
		this.rocks.mesh = SOAR.mesh.create(T.display, T.display.gl.TRIANGLE);
		this.rocks.mesh.add(this.rocks.shader.position, 3);
		this.rocks.mesh.add(this.rocks.shader.texture, 2);

	},
	
	/**
		rebuild the meshes from new mesh data
		
		@method build
		@param data object, contains mesh data
		
	**/
	
	build: function(data) {
		this.cliff.mesh.reset();
		this.copyMesh(this.cliff.mesh, data.cliff);
		this.cliff.mesh.build(true);
		
		this.road.mesh.reset();
		this.copyMesh(this.road.mesh, data.road);
		this.road.mesh.build(true);
		
		this.brush.mesh.reset();
		this.copyMesh(this.brush.mesh, data.brush);
		this.brush.mesh.build(true);

		this.rocks.mesh.reset();
		this.copyMesh(this.rocks.mesh, data.rocks);
		this.rocks.mesh.build(true);
	},
	
	/**
		draw the path
		
		@method draw
	**/
	 
	draw: function() {
		var gl = T.display.gl;
		var camera = T.player.camera;
		var shader;

		gl.disable(gl.BLEND);
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);

		shader = this.road.shader;
		shader.activate();
		gl.uniformMatrix4fv(shader.projector, false, camera.matrix.projector);
		gl.uniformMatrix4fv(shader.modelview, false, camera.matrix.modelview);
		this.walk0.bind(0, shader.walk0);
		this.walk1.bind(1, shader.walk1);
		this.line0.bind(2, shader.line0);
		this.cros0.bind(3, shader.cros0);
		this.road.mesh.draw();

		shader = this.cliff.shader;
		shader.activate();
		gl.uniformMatrix4fv(shader.projector, false, camera.matrix.projector);
		gl.uniformMatrix4fv(shader.modelview, false, camera.matrix.modelview);
		this.walk0.bind(0, shader.walk0);
		this.walk1.bind(1, shader.walk1);
		this.line0.bind(2, shader.line0);
		this.cros0.bind(3, shader.cros0);
		this.cliff.mesh.draw();
		
		shader = this.rocks.shader;
		shader.activate();
		gl.uniformMatrix4fv(shader.projector, false, camera.matrix.projector);
		gl.uniformMatrix4fv(shader.modelview, false, camera.matrix.modelview);
		this.walk0.bind(0, shader.walk0);
		this.walk1.bind(1, shader.walk1);
		this.rocks.mesh.draw();

		gl.disable(gl.CULL_FACE);

		shader = this.brush.shader;
		shader.activate();
		gl.uniformMatrix4fv(shader.projector, false, camera.matrix.projector);
		gl.uniformMatrix4fv(shader.modelview, false, camera.matrix.modelview);
		this.stem0.bind(0, shader.stem0);
		this.walk0.bind(1, shader.walk0);
		this.brush.mesh.draw();
	}

};