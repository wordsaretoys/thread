/**

	an endless golden thread
	
	initialization and frame pump
	
	@module T
	@author cpgauthier

**/

var T = {

	DETAIL_DISTANCE: 2,

	detailUpdate: SOAR.vector.create(Infinity, Infinity, Infinity),
	rng: SOAR.random.create(),
	
	/**
		generate a random number for seeding other RNGs

		used because seeding by time fails on startup--
		all seeds will be the same. you need a "master"
		seed RNG to drive all others.
		
		@method seed
		@return number, seed integet
	**/
	
	seed: function() {
		var seed = Math.round(T.rng.get() * T.rng.modu);
		console.log(seed);
		return seed;
	},
	
	/**
		create GL context, set up game objects, load resources

		@method start
	**/

	start: function() {

		var gl, init, total, id;

		// create the GL display
		try {
			T.display = SOAR.display.create("gl");
		} catch (e) {
			debugger;
		}
		
		// resize display & redraw if window size changes
		window.addEventListener("resize", T.resize, false);
		
		// set initial display size
		T.display.setSize(
			document.body.clientWidth, 
			document.body.clientHeight
		);
		
		// set up debugger element
		T.debugit = document.getElementById("debugit");
		
		// set up any webgl stuff that's not likely to change
		gl = T.display.gl;
		gl.clearDepth(1.0);
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.DEPTH_TEST);
		gl.clearColor(0.75, 0.75, 0.75, 1);
		
		// create and spawn worker thread
		T.worker = new Worker("thread.js");
		T.worker.onmessage = function(e) {
			T.handle(e);
		};
		T.worker.onerror = function(e) {
			console.log("worker thread error: " + 
				e.message + " at line " +
				e.lineno + " in file " +
				e.filename);
		};
		
		// set up an array of all objects to be initialized
		inits = [ T.path, T.player ];
		total = inits.length;
		
		// set up a function to call for the next several animation frames
		// this will perform initialization, with progress bar animations
		id = SOAR.schedule(function() {
			var il = inits.length;
			var np = total - il;
			// as long as there are objects to init
			if (il > 0) {
				// init the next one
				inits.shift().init();
			} else {
				// unschedule the init function
				SOAR.unschedule(id);
				
				// schedule animation frame functions
				SOAR.schedule(T.update, 0, true);
				//SOAR.schedule(T.debug, 100, true);
				
				// set display parameters
				T.resize();
			}
		
		}, 0, true);

		// start capturing control events
		SOAR.capture.start();
		
		// start the message pump
		SOAR.run();
	},
	
	/**
		handle browser resizing
		
		@method resize
	**/
	
	resize: function() {
		T.display.setSize(
			document.body.clientWidth, 
			document.body.clientHeight
		);
		T.player.camera.projector();
		T.draw();
	},
	
	/**
		update all game objects that require it
		
		@method update
	**/
	
	update: function() {
	
		SOAR.capture.update();
		T.player.update();

		// update all detail objects if we've moved far enough
		var ppos = T.player.camera.position;
		if (T.detailUpdate.distance(ppos) > T.DETAIL_DISTANCE) {
		
			T.worker.postMessage({
				cmd: "generate",
				pos: ppos
			});
		
			T.detailUpdate.copy(ppos);
		}
		
		T.draw();
	},
	
	/**
		handle message from worker thread
		
		@method handle
		@param e object, data from thread
	**/
	
	handle: function(e) {
		switch(e.data.cmd) {
		case "build-meshes":
			T.path.build(e.data);
			break;
		default:
			console.log("worker thread sent unknown message: " + e.data.cmd);
			break;
		}
	},	

	/**
		draw all game objects that require it
		
		draw and update are separated so that the
		game can redraw the display when the game
		is paused (T.e., not updating) and resize
		events are being generated
		
		@method draw
	**/
	
	draw: function() {
		var gl = T.display.gl;
		gl.disable(gl.BLEND);
		gl.disable(gl.CULL_FACE);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		T.path.draw();
		
	},
	
	dump: function(o) {
		T.debugit.innerHTML = JSON.stringify(o);
	},
	
	debug: function() {
		T.debugit.innerHTML = SOAR.fps;
	}

};
