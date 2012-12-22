/**
	maintain player state and camera, handle control 
	events related to player motion and interactions
	
	@namespace T
	@class player
**/

T.player = {

	HEIGHT: 0.25,

	motion: {
		moveleft: false, moveright: false,
		movefore: false, moveback: false,
		movefast: false
	},
	
	scratch: {
		d: SOAR.vector.create(),
	},

	debug: false,
	
	/**
		establish jQuery shells around player DOM objects &
		set up event handlers for player controls
		
		tracker div lies over canvas and HUD elements, which
		allows us to track mouse movements without issues in
		the mouse pointer sliding over an untracked element.
		
		@method init
	**/

	init: function() {
		var that = this;

		// create a constrained camera for player view
		this.camera = SOAR.camera.create(T.display);
		this.camera.nearLimit = 0.01;
		this.camera.farLimit = 200;
		this.camera.free = false;
		this.camera.bound.set(Math.sqrt(2) / 2, -1, 0);
		
		var y = T.path.road.height(0);
		var x = T.path.cliff.surface(y, 0);
		this.camera.position.set(x, y + this.HEIGHT, 0);
		
		// set up events to capture
		SOAR.capture.addAction("forward", SOAR.KEY.W, function(down) {
			that.motion.movefore = down;
		});
		SOAR.capture.addAction("backward", SOAR.KEY.S, function(down) {
			that.motion.moveback = down;
		});
		SOAR.capture.addAction("left", SOAR.KEY.A, function(down) {
			that.motion.moveleft = down;
		});
		SOAR.capture.addAction("right", SOAR.KEY.D, function(down) {
			that.motion.moveright = down;
		});
		SOAR.capture.addAction("sprint", SOAR.KEY.SHIFT, function(down) {
			that.motion.movefast = down;
		});
		SOAR.capture.addAction("pause", SOAR.KEY.PAUSE, function(down) {
			if (down) {
				if (SOAR.running) {
					T.debugit.innerHTML = "*** PAUSED ***";
					SOAR.running = false;
				} else {
					T.debugit.innerHTML = "";
					SOAR.running = true;
				}
			}
		});
		SOAR.capture.addAction("fullscreen", SOAR.KEY.Q, function(down) {
			if (down) {
				SOAR.capture.setFullscreen();
			}
		});
		
		SOAR.capture.addAction("debug", SOAR.KEY.Z, function(down) {
			if (down) {
				that.debug = !that.debug;
			}
		});
	},
	
	/**
		react to player controls by updating velocity and position
		
		called on every animation frame
		
		@method update
	**/

	update: function() {
		var motion = this.motion;
		var camera = this.camera;
		var mouse = this.mouse;
		var direct = this.scratch.d;
		var pos = camera.position;
		var dx, dy, speed, s;

		// get mouse deltas, transform by time deltas, and normalize by screen
		dx = 250 * SOAR.sinterval * SOAR.capture.trackX / T.display.width;
		dy = 250 * SOAR.sinterval * SOAR.capture.trackY / T.display.height;
	
		// turn the camera by specified rotations
		camera.turn(dy, dx, 0);

		// determine new movement direction
		direct.set();
		if (motion.movefore) {
			direct.add(camera.front);
		}
		if (motion.moveback) {
			direct.sub(camera.front);
		}
		if (motion.moveleft) {
			direct.sub(camera.right);
		}
		if (motion.moveright) {
			direct.add(camera.right);
		}
		speed = (motion.movefast ? 5 : 1) * SOAR.sinterval;
		direct.norm().mul(speed);
		pos.add(direct);
		
		if (!this.debug) {
			pos.y = this.HEIGHT + T.path.road.height(pos.z);
			s = T.path.cliff.surface(pos.y, pos.z);
			if (pos.x > s + 0.4) {
				pos.x = s + 0.4;
			}
			if (pos.x < s - 0.5) {
				pos.x = s - 0.5;
			}
		}

		// generate camera matrixes
		// (will be cached in the camera object)
		camera.modelview();
		camera.projector();
		
	}
};
