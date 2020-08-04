const display = document.getElementById('display');
const ctx = display.getContext('2d', {alpha: false});

var width = display.width = window.innerWidth;
var height = display.height = window.innerHeight;
const camera = {x : 0, y : 0};

const G = 0.000093, PI2 = 2 * Math.PI, numParticles = 600, numAsteroids = 14, numDebris = 100, 
	numEnemies = 5, numPowerups = 3, GYRO = 0.0048, THRUST = 20, friction = 0.996;

function getRandomColor(){
    let letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i ++){
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function len(vector){
	return (vector.x**2 + vector.y**2)**0.5;
}

function fadeColor(color, amount){
	let c = [];
	for (let i = 0; i < 3; i++){
		c[i] = Math.round(parseInt(color.slice(2*i+1, 2*i+3), 16) * amount);
		c[i] = c[i].toString(16);
	}
	return '#' + c[0] + c[1] + c[2];
}

function strobe(color){
	let c = [];
	for (let i = 0; i < 3; i++){
		c[i] = Math.round(parseInt(color.slice(i+1, i+3), 16) * 0.99);
		c[i] = c[i].toString(16);
	}
	return '#' + c[0] + c[1] + c[2];
}

function makeParticle(x, y, velX, velY){
	for (let i in particles){
		if (particles[i].active) continue;
		particles[i] = new Particle(x, y, velX, velY);
		break;
	}
}

function spawnPowerUp(){
	for (let i in powerups){
		if (powerups[i].active) continue;
		let angle = PI2 * Math.random();
		let x = myShip.x + width * Math.cos(angle); 
		let y = myShip.y + width * Math.sin(angle);
		powerups[i] = new PowerUp(x, y, 0);
	}
}

function drawBackground(){
	for (let i in dust){
		for (let j in dust[i]){
			dust[i][j].x += (dust[i][j].velX - myShip.velX) / (0.7*i + 1.3);
			dust[i][j].x = (dust[i][j].x + width) % width;
			dust[i][j].y += (dust[i][j].velY - myShip.velY) / (0.7*i + 1.3);
			dust[i][j].y = (dust[i][j].y + height) % height;
			ctx.fillStyle = dust[i][j].color;
			ctx.fillRect(dust[i][j].x - camera.x, dust[i][j].y - camera.y, 2, 2);
		}
	}
}

function makeAsteroid(x, y){
	for (let i in asteroids){
		if (asteroids[i].active) continue;
		let velX = Math.random() * 0.2 - 0.1;
		let velY = Math.random() * 0.2 - 0.1;
		let size = Math.random() * 40 + 20;
		let spin = Math.random() * 0.04 - 0.02;
		let color = getRandomColor();
		asteroids[i] = new Asteroid(x, y, velX, velY, size, spin, color);
		break;
	}
}

function killOutsider(thing){
	if ((thing.x - myShip.x)**2 + (thing.y - myShip.y)**2 > width**2) thing.active = false;
}

function moveCamera(){
	camera.x = width / 2 - myShip.x;
	camera.y = height / 2 - myShip.y;
	ctx.setTransform(1, 0, 0, 1, camera.x, camera.y);
}

class Point{
	constructor(x, y, velX, velY, color){
		this.x = x;
		this.y = y;
		this.velX = velX;
		this.velY = velY;
		this.active = true;
		this.color = color;
	}
	decay(){
		var oldColor = this.color;
		this.color = strobe(this.color);
		if (oldColor === this.color) this.active = false;
	}
}

class Thing extends Point{
	constructor(x, y, velX, velY, size, spin, color){
		super(x, y, velX, velY, color);
		this.size = size;
		this.mass = size**2;
		this.HP = 100 * this.size;
		this.maxHP = this.HP;
		this.spin = spin;
		this.vertices = [];
		this.vertex_vectors = [];
	}
	
	move(){
		//this.velX *= friction;
		//this.velY *= friction;
		this.x += this.velX;
		this.y += this.velY;
		var sinSpin = Math.sin(this.spin), cosSpin = Math.cos(this.spin);
		for (var i in this.vertex_vectors){
			var oldX = this.vertex_vectors[i].x, oldY = this.vertex_vectors[i].y;
			
			this.vertex_vectors[i].x = cosSpin * oldX - sinSpin * oldY;
			this.vertex_vectors[i].y = sinSpin * oldX + cosSpin * oldY;
			
			this.vertices[i] = {
				x : this.x + this.vertex_vectors[i].x,
				y : this.y + this.vertex_vectors[i].y
			}
		}
	}
	
	gravitate(that){
		var dx = this.x - that.x, dy = this.y - that.y;
		that.velX += G * this.mass * dx / (dx**2 + dy**2);
		that.velY += G * this.mass * dy / (dx**2 + dy**2);
	}
	
	draw(){
		ctx.strokeStyle = this.color;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
		for (var i = 1; i < this.vertices.length; i++){
			ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
		}
		ctx.closePath();
		ctx.stroke();
	}
	
	detectCollission(x, y){
		for (var i in this.vertices){
			var dx = x - this.vertices[i].x;
			var dy = y - this.vertices[i].y;
			var p = (i - 1);
			if (p < 0) p = this.vertices.length - 1;
			var nx = this.vertices[i].y - this.vertices[p].y;
			var ny = this.vertices[p].x - this.vertices[i].x;
			if ((nx*dx + ny*dy) > 0) return false;
		}
		return true;
	}
	
	burst(){
		for (var i in this.vertices){
			var vx = this.velX - 5 * this.spin * this.vertex_vectors[i].y;
			var vy = this.velY + 5 * this.spin * this.vertex_vectors[i].x;
			makeParticle(this.vertices[i].x, this.vertices[i].y, vx, vy);
		}
	}
	
	destroy(){
		var verticesVel = [];
		for (var i in this.vertices){
			//Cross product to find absolute velocity:
			verticesVel[i] = {
				x : this.velX - this.spin * this.vertex_vectors[i].y,
				y : this.velY + this.spin * this.vertex_vectors[i].x
			};
		}
		for (var i in this.vertices){
			let q = i==this.vertices.length-1 ? 0 : Number(i)+1;
			
			//diameter of the line segment:
			let diameter = {
				x : this.vertices[q].x - this.vertices[i].x,
				y : this.vertices[q].y - this.vertices[i].y
			};
			diameter.len2 = diameter.x**2 + diameter.y**2;
			//finding translational velocity of the line segment by dot product
			let transVelI = {
				x : diameter.x * (diameter.x * verticesVel[i].x + diameter.y * verticesVel[i].y) / diameter.len2,
				y : diameter.y * (diameter.x * verticesVel[i].x + diameter.y * verticesVel[i].y) / diameter.len2
			};
			let transVelQ = {
				x : diameter.x * (diameter.x * verticesVel[q].x + diameter.y * verticesVel[q].y) / diameter.len2,
				y : diameter.y * (diameter.x * verticesVel[q].x + diameter.y * verticesVel[q].y) / diameter.len2
			};
			let velX = transVelI.x + transVelQ.x;
			let velY = transVelI.y + transVelQ.y;
			
			//finding rotational velocity for the vertices
			let rotVelI = {
				x : verticesVel[i].x - transVelI.x,
				y : verticesVel[i].y - transVelI.y
			};
			let rotVelQ = {
				x : verticesVel[q].x - transVelI.x,
				y : verticesVel[q].y - transVelI.y
			};
			
			let theRadius = {
				x : diameter.x / 2,
				y : diameter.y / 2
			};
			theRadius.len2 = theRadius.x**2 + theRadius.y**2;
			//finding the line's spin by cross product:
			let spin = ((rotVelI.x * theRadius.y - rotVelI.y * theRadius.x)
					- (rotVelQ.x * theRadius.y - rotVelQ.y * theRadius.x)) / theRadius.len2;
					
			//creating the line
			for (var j = 0; j < numDebris; j ++){
				if (debris[j].active) continue;
				debris[j] = new Line(this.vertices[i], this.vertices[q], velX, velY, spin, getRandomColor());
				break;
			}
		}
		this.active = false;
	}
	
	getHit(p){
		var dx = p.x - this.x;
		var dy = p.y - this.y;
		var ds2 = dx**2 + dy**2;
		if (ds2 > this.size**2 * 1.2) return;
		var dvx = 5 * (p.velX - this.velX - this.spin * dy) / this.mass;
		var dvy = 5 * (p.velY - this.velY + this.spin * dx) / this.mass;
		var dp = dx * dvx + dy * dvy;
		if (dp > 0) return;
		this.velX += dx * dp / ds2;
		this.velY += dy * dp / ds2;
		this.spin += (dx * dvy - dy * dvx) / ds2;
		this.HP -= 30 * Math.abs(dp);
		if (this.HP <= 0) this.destroy();
		p.active = false;
	}
	
	//collision with another Thing
	collide(that){
		if ((this.x - that.x)**2 + (this.y - that.y)**2 > (this.size + that.size)**2) return;

		for (var i in that.vertices){
			//check if vertices of the other polygon are behind the edges of this one
			if (!this.detectCollission(that.vertices[i].x, that.vertices[i].y)) continue;
			var pointOfCollision = that.vertices[i];

			var radius1 = {
				x : pointOfCollision.x - this.x,
				y : pointOfCollision.y - this.y
			};
			var radius2 = {
				x : pointOfCollision.x - that.x,
				y : pointOfCollision.y - that.y
			};
			if (radius1.x**2 + radius1.y**2 < 0.1) return;
			if (radius2.x**2 + radius2.y**2 < 0.1) return;
			var totalVelocityThis = {
				x : this.velX - radius1.y * this.spin,
				y : this.velY + radius1.x * this.spin
			};
			var totalVelocityThat = {
				x : that.velX - radius2.y * that.spin,
				y : that.velY + radius2.x * that.spin
			};
			var dv = {
				x : totalVelocityThat.x - totalVelocityThis.x,
				y : totalVelocityThat.y - totalVelocityThis.y
			};
			if (dv.x * radius1.x + dv.y * radius1.y > 0) return;
			
			var m1 = 2 * that.mass / (this.mass + that.mass);
			var m2 = 2 * this.mass / (this.mass + that.mass);
			
			totalVelocityThis.x += m1 * dv.x,
			totalVelocityThis.y += m1 * dv.y;
			
			totalVelocityThat.x -= m2 * dv.x,
			totalVelocityThat.y -= m2 * dv.y;
			
			var dp1 = totalVelocityThis.x * radius1.x + totalVelocityThis.y * radius1.y;
			this.velX = dp1 * radius1.x / (radius1.x**2 + radius1.y**2);
			this.velY = dp1 * radius1.y / (radius1.x**2 + radius1.y**2);
			
			var dp2 = totalVelocityThat.x * radius2.x + totalVelocityThat.y * radius2.y;
			that.velX = dp2 * radius2.x / (radius2.x**2 + radius2.y**2);
			that.velY = dp2 * radius2.y / (radius2.x**2 + radius2.y**2);
			
			var rotationalVelocityThis = {
				x : totalVelocityThis.x - this.velX,
				y : totalVelocityThis.y - this.velY
			};
			this.spin = (radius1.x * rotationalVelocityThis.y - radius1.y * rotationalVelocityThis.x) / (radius1.x**2 + radius1.y**2);
			
			var rotationalVelocityThat = {
				x : totalVelocityThat.x - that.velX,
				y : totalVelocityThat.y - that.velY
			};
			that.spin = (radius2.x * rotationalVelocityThat.y - radius2.y * rotationalVelocityThat.x) / (radius2.x**2 + radius2.y**2);
			
			this.HP -= that.mass * 0.2 * (dv.x**2 + dv.y**2);
			that.HP -= this.mass * 0.2 * (dv.x**2 + dv.y**2);
			
			if (this.HP <= 0) this.destroy();
			if (that.HP <= 0) that.destroy();
			
			break;
		}
	}
}

class PowerUp extends Thing{
	constructor(x, y, type){
		if (type == 0){
			super(x, y, 0, 0, 30, 0.05, '#DD1111');
		}
		this.type = type;
		let n = 4;
		for (var i = 0; i < n; i ++){
			this.vertex_vectors[i] = {x : this.size * Math.cos(i * PI2 / n), y : this.size * Math.sin(i * PI2 / n)};
		}
	}
	collide(that){
		if ((this.x - that.x)**2 + (this.y - that.y)**2 < (this.size + that.size)**2){
			this.destroy();
			if (this.type == 0){
				that.HP += 400;
				if (that.HP > that.maxHP) that.HP = that.maxHP;
			}
		}
	}
	draw(){
		super.draw();
		ctx.moveTo(this.x - 0.5*this.size, this.y);
		ctx.lineTo(this.x + 0.5*this.size, this.y);
		ctx.moveTo(this.x, this.y - 0.5*this.size);
		ctx.lineTo(this.x, this.y + 0.5*this.size);
		ctx.moveTo(this.x + this.size, this.y);
		ctx.stroke();
	}
}

class Line extends Thing{
	constructor(vertex1, vertex2, velX, velY, spin, color){
		let x = vertex1.x + 0.5 * (vertex2.x - vertex1.x);
		let y = vertex1.y + 0.5 * (vertex2.y - vertex1.y);
		let size = 0.5 * ((vertex2.x - vertex1.x)**2 + (vertex2.y - vertex1.y)**2)**0.5;
		super(x, y, velX, velY, size, spin, color);
		this.vertex_vectors = [
			{x : 0.5 * (vertex1.x - vertex2.x), y : 0.5 * (vertex1.y - vertex2.y)},
			{x : 0.5 * (vertex2.x - vertex1.x), y : 0.5 * (vertex2.y - vertex1.y)}
		];
	}
}

class Particle extends Point{
	constructor(x, y, velX, velY){
		super(x, y, velX, velY, getRandomColor());
	}
	
	move(){
		this.velX, this.velY *= friction;
		this.oldX = this.x;
		this.oldY = this.y;
		this.x += this.velX;
		this.y += this.velY;
	}
	
	draw(){
		ctx.strokeStyle = this.color;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(this.x, this.y);
		ctx.lineTo(this.oldX, this.oldY);
		ctx.stroke();
	}
}

class Ship extends Thing{
	constructor(x, y, velX, velY, size, spin, color){
		super(x, y, velX, velY, size, spin, color);
		this.turnLeft = false;
		this.turnRight = false;
		this.booster = false;
		this.vertex_vectors[0] = {x : 0, y : 0};
		for (var i = 1; i < 4; i ++){
			this.vertex_vectors[i] = {x : this.size * Math.cos(i * PI2 / 3), y : this.size * Math.sin(i * PI2 / 3)};
		}
	}
	control(){
		if (this.turnLeft) this.spin -= GYRO;
		if (this.turnRight) this.spin += GYRO;
		if (this.booster){
			let tv = {x : this.vertex_vectors[2].x, y : this.vertex_vectors[2].y};
			this.velX += tv.x * THRUST / (this.mass * this.size);
			this.velY += tv.y * THRUST / (this.mass * this.size);
			makeParticle(this.x + this.velX, this.y + this.velY, -this.velX - tv.x, -this.velY - tv.y);
			this.HP -= 0.35;
			if (this.HP < 0) this.destroy();
		}
		if (!this.turnLeft && !this.turnRight) this.spin *= 0.92;
		else this.spin *= 0.97;
	}
	attractParticle(that){
		let dx = this.x - that.x, dy = this.y - that.y;
		let distanceSqrd = dx**2 + dy**2;
		if (this.booster){
			that.velX += (8 * dx - dy) / distanceSqrd;
			that.velY += (8 * dy + dx) / distanceSqrd;
		} else {
			that.velX -= dx / distanceSqrd;
			that.velY -= dy / distanceSqrd;
		}
	}
	draw(){
		super.draw();
		ctx.moveTo(this.x + this.size*1.5, this.y);
		ctx.arc(this.x, this.y, this.size*1.5, 0, PI2 * this.HP / this.maxHP);
		ctx.stroke();
	}
}

class Enemy extends Ship{
	constructor(x, y, velX, velY, size, spin, color){
		super(x, y, velX, velY, size, spin, color);
	}
	AI(){
		var dx = myShip.x - this.x;
		var dy = myShip.y - this.y;
		var d = Math.sqrt(dx**2 + dy**2);
		var dvx = myShip.velX - this.velX;
		var dvy = myShip.velY - this.velY;
		var vp = this.vertex_vectors[2].x * dy - this.vertex_vectors[2].y * dx;
		var dp = dx * dvx + dy * dvy;
		
		if (vp > 0) this.turnRight = true;
		else this.turnRight = false;
		
		if (vp < 0) this.turnLeft = true;
		else this.turnLeft = false;
		
		this.booster = false;
		if (dx**2 + dy**2 > width**2){ 
			if (dvx**2 + dvy**2 < 2) this.booster = true; 
		} else {
			if (dp > 1 && Math.abs(vp) / (this.size * d) < 0.5) this.booster = true;
		}
	}
}

class Asteroid extends Thing{
	constructor(x, y, velX, velY, size, spin){
		super(x, y, velX, velY, size, spin, getRandomColor());
		var n = 2 * Math.floor(Math.random() * 3) + 7;
		for (var i = 0; i < n; i ++){
			this.vertex_vectors[i] = {x : this.size * Math.cos(i * PI2 / n), y : this.size * Math.sin(i * PI2 / n)};
		}
	}
	draw(){
		super.draw();
		ctx.moveTo(this.x + this.size*0.5, this.y);
		ctx.arc(this.x, this.y, this.size*0.5, 0, PI2 * this.HP / this.maxHP);
		ctx.stroke();
	}
}

const particles = [], asteroids = [], debris = [], enemies = [], powerups = [];

for (var i = 0; i < numParticles; i++){
	particles[i] = {active : false};
}
for (var i = 0; i < numDebris; i++){
	debris[i] = {active : false};
}
for (var i = 0; i < numAsteroids; i++){
	asteroids[i] = {active : false};
}
for (var i = 0; i < numEnemies; i++){
	enemies[i] = {active : false};
}
for (var i = 0; i < numPowerups; i++){
	powerups[i] = {active : false};
}

const myShip = new Ship(width / 2, height / 2, 0, 0, 14, 0, '#999900');

const dust = [[], [], []];
for (let i in dust){
	for (let j=0; j<60; j++){
		dust[i][j] = new Point(Math.random() * width, Math.random() * height,
			Math.random()*0.5 - 0.25, Math.random()*0.5 - 0.25, '#848484');
	}
}

function doStuff(){
	width = display.width = window.innerWidth;
	height = display.height = window.innerHeight;
	moveCamera();
	drawBackground();
	
	for (let i in particles){
		if (!particles[i].active) continue;
		particles[i].move();
		particles[i].draw();
		particles[i].decay();
		myShip.getHit(particles[i]);
		for (var j in enemies){
			if (!enemies[j].active) continue;
			enemies[j].getHit(particles[i]);
		}
		for (var j in asteroids){
			if (!asteroids[j].active) continue;
			asteroids[j].getHit(particles[i]);
		}
	}
	
	for (let i in enemies){
		if (!enemies[i].active) continue;
		enemies[i].move();
		enemies[i].control();
		enemies[i].draw();
		enemies[i].AI();
		enemies[i].collide(myShip);
		myShip.collide(enemies[i]);
		for (let j in enemies){
			if (j == i) continue;
			if (!enemies[j].active) continue;
			enemies[i].collide(enemies[j]);
		}
		for (let j in powerups){
			if (!powerups[j].active) continue;
			powerups[j].collide(enemies[i]);
			enemies[i].gravitate(powerups[j]);
		}
	}
	
	for (let i in asteroids){
		if (!asteroids[i].active) continue;
		asteroids[i].move();
		asteroids[i].draw();
		asteroids[i].collide(myShip);
		myShip.collide(asteroids[i]);
		asteroids[i].gravitate(myShip);
		for (let j in asteroids){
			if (!asteroids[j].active) continue;
			if (i == j) continue;
			asteroids[i].collide(asteroids[j]);
			asteroids[i].gravitate(asteroids[j]);
		}
		for (let j in enemies){
			if (!enemies[j].active) continue;
			asteroids[i].gravitate(enemies[j]);
			enemies[j].collide(asteroids[i]);
			asteroids[i].collide(enemies[j]);
		}
		for (let j in powerups){
			if (!powerups[j].active) continue;
			powerups[j].collide(asteroids[i]);
			asteroids[i].gravitate(powerups[j]);
		}
	}
	
	for (let i in debris){
		if (!debris[i].active) continue;
		debris[i].move();
		debris[i].draw();
		debris[i].decay();
	}
	
	for (let i in powerups){
		if (!powerups[i].active) continue;
		powerups[i].move();
		powerups[i].draw();
		powerups[i].collide(myShip);
		myShip.gravitate(powerups[i]);
	}
	
	if(myShip.active){
		myShip.velX *= friction;
		myShip.velY *= friction;
		myShip.move();
		myShip.control();
		myShip.draw();
	}
	
	requestAnimationFrame(doStuff);
}

setInterval(function(){
	for (let i in asteroids){
		if (!asteroids[i].active) continue;
		asteroids[i].burst();
		killOutsider(asteroids[i]);
	}
	for (let i in powerups){
		if (!powerups[i].active) continue;
		killOutsider(powerups[i]);
	}
	let angle = PI2 * Math.random();
	let vector = {x : Math.cos(angle), y : Math.sin(angle)};
	makeAsteroid(myShip.x + vector.x * width, myShip.y + vector.y * width);
	for (let i in enemies){
		if (enemies[i].active) continue;
		let angle = PI2 * Math.random();
		let x = myShip.x + width * Math.cos(angle); 
		let y = myShip.y + width * Math.sin(angle);
		enemies[i] = new Enemy(x, y, 0, 0, Math.random() * 10 + 10, 0, getRandomColor());
	}
	spawnPowerUp();
}, 2000);

document.addEventListener('keydown', function(e){
	if (e.keyCode == 65) myShip.turnLeft = true;
	if (e.keyCode == 68) myShip.turnRight = true;
	if (e.keyCode == 32) myShip.booster = true;
});

document.addEventListener('keyup', function(e){
	if (e.keyCode == 65) myShip.turnLeft = false;
	if (e.keyCode == 68) myShip.turnRight = false;
	if (e.keyCode == 32) myShip.booster = false;
});

requestAnimationFrame(doStuff);

/*
var testPolygon = new Asteroid(0, 0, 0, 0, 50, 0);
testPolygon.move();
testPolygon.draw();
var testEnemy = new Enemy(0, 0, 0, 0, 15, 0, '#ffffff');
function doTests(){
	//test point in polygon
	if (testPolygon.detectCollission(200, 0)) console.log('error detectCollission outside');
	if (!testPolygon.detectCollission(0, 0)) console.log('error detectCollission inside');
	console.log(fadeColor('#ffffff', 0.5));
	console.log(fadeColor('#e0f0a0', 0.5));
	testEnemy.control();
	console.log('enemy spin: ' + testEnemy.spin);
	console.log('enemy active? ' + testEnemy.active);
}
doTests();
*/