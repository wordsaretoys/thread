/**
	Big I worker thread
	
**/

SOAR = {};
importScripts("/debug/soar/vector.js");
importScripts("/debug/soar/mesh.js");
importScripts("/debug/soar/noise.js");
importScripts("/debug/soar/space.js");
importScripts("/debug/soar/pattern.js");

//
// pattern/surface variables
//

var rng = SOAR.random.create();

var road = {};
var cliff = {};
var brush = {};
var rocks = {};

//
// dummy display variable for mesh creation
//

var display = {
	gl: ""
};

/**
	generate a random number for seeding other RNGs

	used because seeding by time fails on startup--
	all seeds will be the same. you need a "master"
	seed RNG to drive all others.
	
	@method seed
	@return number, seed integer
**/

function seed() {
	return Math.round(rng.get() * rng.modu);
}

/**
	iterate over a 2D mesh with indexing
	
	@method indexMesh
	@param mesh object
	@param il number, steps for first dimension
	@param jl number, steps for second dimension
	@param func function, callback to generate point field
	@param wind boolean, winding order
	@param op object, opaque data passed to function
**/

function indexMesh(mesh, il, jl, func, wind, op) {
	var im = il - 1;
	var jm = jl - 1;
	var k = mesh.length / mesh.stride;
	var i, j;

	for (i = 0; i < il; i++) {
		for (j = 0; j < jl; j++, k++) {
			func(i / im, j / jm, op);
			if (i < im && j < jm) {
				if (wind) {
					mesh.index(k, k + jl, k + 1, k + jl, k + jl + 1, k + 1);
				} else {
					mesh.index(k, k + 1, k + jl, k + jl, k + 1, k + jl + 1);
				}
			}
		}
	}
}	

/**
	perform startup initialization
	
	@method init
	@param data object, initialization parameters
**/

function init(data) {
	
	// received height map from main thread; make line object
	road.height = SOAR.space.makeLine(data.map.road, 6, 0.05);
	// generate dummy mesh for vertex and texture coordinates
	road.mesh = SOAR.mesh.create(display);
	road.mesh.add(0, 3);
	road.mesh.add(0, 2);

	// received surface map from main thread; make surface object
	var surf0 = SOAR.space.makeSurface(data.map.cliff, 10, 0.05, 0.1);
	var surf1 = SOAR.space.makeSurface(data.map.cliff, 5, 0.25, 0.5);
	var surf2 = SOAR.space.makeSurface(data.map.cliff, 1, 0.75, 1.5);
	cliff.surface = function(y, z) {
		return surf0(y, z) + surf1(y, z) + surf2(y, z);
	};
	cliff.mesh = SOAR.mesh.create(display);
	cliff.mesh.add(0, 3);
	cliff.mesh.add(0, 2);

	// received RNG seed
	brush.seed = data.seed.brush;
	brush.mesh = SOAR.mesh.create(display);
	brush.mesh.add(0, 3);
	brush.mesh.add(0, 2);

	rocks.seed = data.seed.rocks;
	rocks.mesh = SOAR.mesh.create(display);
	rocks.mesh.add(0, 3);
	rocks.mesh.add(0, 2);
}

/**
	generate all meshes and
	hand back over to main UI
	
	@method generate
	@param p object, player position
**/

function generate(p) {

	// lock the z-coordinate to integer boundaries
	p.z = Math.floor(p.z);

	// road is modulated xz-planar surface
	road.mesh.reset();
	indexMesh(road.mesh, 2, 64, function(xr, zr) {
		var z = p.z + (zr - 0.5) * 16;
		var y = road.height(z);
		var x = cliff.surface(y, z) + (xr - 0.5);
		road.mesh.set(x, y, z, xr, z);
	}, false);

	// cliff is modulated yz-planar surface
	// split into section above path and below
	cliff.mesh.reset();
	indexMesh(cliff.mesh, 32, 64, function(yr, zr) {
		var z = p.z + (zr - 0.5) * 16;
		var y = road.height(z) + yr * 8;
		var x = cliff.surface(y, z) + 0.5;
		cliff.mesh.set(x, y, z, y, z);
	}, false);
	indexMesh(cliff.mesh, 32, 64, function(yr, zr) {
		var z = p.z + (zr - 0.5) * 16;
		var y = road.height(z) - yr * 8;
		var x = cliff.surface(y, z) - 0.5;
		cliff.mesh.set(x, y, z, y, z);
	}, true);

	// brush and rocks are generated in "cells"
	// cells occur on integral z boundaries (z = 0, 1, 2, ...)
	// and are populated using random seeds derived from z-value
	
	brush.mesh.reset();
	(function(mesh) {
		var i, j, k;
		var iz, x, y, z, a, r, s;
		// 16 cells because path/cliff is 16 units long in z-direction
		for (i = -8; i < 8; i++) {
			iz = p.z + i;
			// same random seed for each cell
			rng.reseed(Math.abs(iz * brush.seed + 1));
			// place 25 bits of brush at random positions/sizes
			for (j = 0; j < 25; j++) {
				s = rng.get() < 0.5 ? -1 : 1;
				z = iz + rng.get(0, 1);
				y = road.height(z) - 0.0025;
				x = cliff.surface(y, z) + s * (0.5 - rng.get(0, 0.15));
				r = rng.get(0.01, 0.1);
				a = rng.get(0, Math.PI);
				// each brush consists of 4 triangles
				// rotated around the center point
				for (k = 0; k < 4; k++) {
					mesh.set(x, y, z, 0, 0);
					mesh.set(x + r * Math.cos(a), y + r, z + r * Math.sin(a), -1, 1);
					a = a + Math.PI * 0.5;
					mesh.set(x + r * Math.cos(a), y + r, z + r * Math.sin(a), 1, 1);
				}
			}
		}
	})(brush.mesh);

	rocks.mesh.reset();
	(function(mesh) {
		var o = SOAR.vector.create();
		var i, j, k;
		var iz, x, y, z, r, s;
		var tx, ty;
		for (i = -8; i < 8; i++) {
			iz = p.z + i;
			// same random seed for each cell--though not
			// the same as the brush, or rocks would overlap!
			rng.reseed(Math.abs(iz * rocks.seed + 2));
			// twenty rocks per cell
			for (j = 0; j < 20; j++) {
				s = rng.get() < 0.5 ? -1 : 1;
				z = iz + rng.get(0, 1);
				y = road.height(z) - 0.005;
				x = cliff.surface(y, z) + s * (0.5 - rng.get(0.02, 0.25));
				r = rng.get(0.01, 0.03);
				tx = rng.get(0, 5);
				ty = rng.get(0, 5);
				// each rock is an upturned half-sphere
				indexMesh(mesh, 6, 6, function(xr, zr) {
					o.x = 2 * (xr - 0.5);
					o.z = 2 * (zr - 0.5);
					o.y = (1 - o.x * o.x) * (1 - o.z * o.z);
					o.norm().mul(r);
					mesh.set(x + o.x, y + o.y, z + o.z, xr + tx, zr + ty);
				}, false);
				
			}
		}
	})(rocks.mesh);

	// send mesh data back to main UI
	postMessage({
		cmd: "build-meshes",
		cliff: cliff.mesh,
		road:  road.mesh,
		brush: brush.mesh,
		rocks: rocks.mesh
	});
}


//
// message handling stub
//

this.addEventListener("message", function(e) {

	switch(e.data.cmd) {
	case "init":
		init(e.data);
		break;
	case "generate":
		generate(e.data.pos);
		break;
	}

}, false);
