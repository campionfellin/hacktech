var express = require('express');
var app = express();
var create = require('create2');
var io = require('socket.io')(server);
var request = require('request');
var robot2 = require('robotjs');

app.set('port', process.env.PORT || 3000);
//var server = app.listen(3000, () => {
  //  console.log('Example app listening on port 3000!')
//});
var bodyParser = require('body-parser');

var commands = require('./commands');

var robot, turnRobot, stopTurn, stopLogic, driveLogic;
var driveStraight = 32768;

app.use(express.static(__dirname + '/public'));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
// views is directory for all template files
app.set('views', __dirname + '/views/');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.send("hi");
});

var myCommand = "";
var hasStarted = false;
start();
app.post('/', function(request, response) {
	//console.log(request.body.result);
	//console.log(request.body.result.action); //for just the action
	if (!hasStarted) {
		hasStarted = true;
		//start();
	}
	myCommand = "";
	if (request.body.result) {

		var action = request.body.result.action;
		console.log(action);
		if (action == "stop") {
			console.log("stopping");
			myCommand = "stop";
			stopLogic();
			/*
			setInterval(function() {

				robot2.typeString("ss");
				robot2.keyTap("enter");
				//start();
				commands.stop();
			}, 3000); */

		} else if (action == "turn") {
			console.log("turning");
			myCommand = "turn";
			var direction = request.body.result.parameters.direction;
			var degrees = request.body.result.parameters.degrees;
			commands.turn(direction, degrees);
		} else if (action == "move") {
			console.log("moving");
			myCommand = "move";
			driveLogic(50, driveStraight);
			var direction = request.body.result.parameters.direction;
			var distance = request.body.result.parameters.distance;
			commands.move(direction, distance);
		}
	}
	response.send("");
});

app.post('/update', function(request, response) {
	//console.log("this is the data");
	//console.log(request.body);

});


app.get('/control', function(request, response) {
	start();
});


var server = app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

function start() {
    create.prompt(function (p) { create.open(p, main) });
}


//chau robot code:

var headers = {
    'User-Agent': 'Super Agent/0.0.1',
    'Content-Type': 'application/x-www-form-urlencoded'
}

var options = {
    url: 'http://localhost:3000/update',
    method: 'POST',
    headers: headers,
    form: {
        distance: 0,
        angle: 0,
        battery: 0,
        cliffLeft: false,
        cliffFrontLeft: false,
        cliffFromRight: false,
        cliffRight: false,
        bumpLeft: false,
        bumpRight: false,
        wall: false,
        velocity: 0,
        leftEncoder: 0,
        rightEncoder: 0,
    }
}


//Main Program:
function main(r) {
    robot = r; handleInput(robot);

    //Enter full Mode:
    robot.full(); var run = 1;

    //setTimeout(function(){robot.showText("Hello World!", 500, true)}, 500);

    //We'll play this song whenever entering user-control:
    // robot.setSong(0, [[72,32],[76,32],[79,32],[72,32]]);

    //Handle First onChange:
    robot.onChange = function () {
        if (robot.data.charger || robot.data.docked) { robot.start(); run = 0; }
        else {
            //robot.play(0);
            //driveLogic();
        } robot.onChange = onchange;
    }

    //Handle onChange Events:
    function onchange(chg) {
        if (robot.data.mode == 3 && run == 1) { //full mode:
            //lightBumper is a macro for all light bump sensors (lightBumpLeft, lightBumpRight, etc)
            //Unfortunately, no similar macro exists for cliff sensors or bumper switches due to the way the data is delivered.
            options.form.bumpLeft = chg.bumpLeft || false;
            options.form.bumpRight = chg.bumpRight || false;
            options.form.cliffLeft = chg.cliffLeft || false;
            options.form.cliffFrontLeft = chg.cliffFrontLeft || false;
            options.form.cliffFrontRight = chg.cliffFrontRight || false;
            options.form.cliffRight = chg.cliffRight || false;
            options.form.dropLeft = chg.dropLeft || false;
            options.form.dropRight = chg.dropRight || false;
            options.form.leftEncoder = robot.data.encoderLeft;
            options.form.rightEncoder = robot.data.encoderRight;

            // send data after all possible changes
            request(options, function (error, response, body) {
                // console.log('sending data');
                if (!error && response.statusCode == 200) {
                    // Print out the response body
                    console.log(body)
                }
                if (error) console.log(error)
            });



            //Charging Station Detected! Since it's in front of the robot anyway... Start Auto-Docking!
            if (robot.data.irLeft == 172 || robot.data.irRight == 172) {
                robot.drive(0, 0); run = -1; robot.showText("SEEK", 500, false, robot.autoDock);
            }
        } else if (robot.data.mode == 1) { //PASSIVE mode:
            if (chg.clean && robot.data.clean) { //Clean Pressed:
                if (robot.data.docked) robot.clean(); //Start backing up if clean pressed while docked.
                else preventDefault(function () { run = 1; driveLogic() }); //Prevent default.
            }
            if (chg.docked && robot.data.docked) { //Robot Docked:
                setUndock(0); robot.full(); robot.showText("DOCK", 500, false, robot.start);
            } else if (chg.docked/* && !robot.data.charger*/ && !robot.data.docked) { //Robot Undocked:
                setUndock(1);
            } else if (chg.dropLeft || chg.dropRight) { //Docking Interrupted:
                if (run == -1) { robot.full(); robot.showText("RST", 500, false, robot.autoDock) }
                //else setUndock(1);
            }
        }
    }
    stopLogic = function () {
    	console.log("in stop logic");
    	robot.drive(0,0);
    }

    //Logic to Start and Stop Moving Robot:
    driveLogic = function () {
        console.log('MOVING')
        //We're in user-control (full mode) and can control the robot. (Your main program would be here!)
        if (robot.data.lightBumper || robot.data.bumpLeft || robot.data.bumpRight) robot.driveSpeed(0, 0); //Disable motors.
        else robot.driveSpeed(robot.data.dropLeft ? 0 : 100, robot.data.dropRight ? 0 : 100); //Enable motors if wheels are up.
        if (robot.data.clean || robot.data.docked) { robot.driveSpeed(0, 0); robot.start() } //Back to PASSIVE mode.
        // console.log('r data:', r.data);
        if (myCommand == "move") {
        	console.log("in move functions");
        	robot.drive(50, driveStraight);
        } else if (myCommand == "stop") {
        	console.log("in stop function");
        	robot.drive(0,0);
        } else {
        	console.log("NO COMMAND SET");
        }

        //robot.drive(50, driveStraight);
    }

    //Enable and disable undocking timer:
    var dTmr; function setUndock(e) {
        if (dTmr) clearTimeout(dTmr); //Cancel timer if already running.
        if (e) {
            run = 1; robot.start(); dTmr = setTimeout(function () {
                robot.full(); run = 1; dTmr = setTimeout(function () {
                    robot.showText
                    ("UNDOCK", 250, true);
                    // robot.play(0);
                    driveLogic(); dTmr = null
                }, 250);
            }, 4400);
        } else run = 0;
    }

    //Turns robot when 't' is pressed:
    var drRun = 0, drAngle = 0;
    turnRobot = function () {
        if (robot.data.mode == 3 && drRun) { //If already turning:
            run = 0; if (drAngle) drAngle = 0; else //Set desired angle to original angle.
                drAngle = (robot.motorRad == 1) ? 64 : -64; //Continue in current motor direction.
            robot.drive(100, (drAngle - angle < 0) ? -1 : 1); drRun = 1;
        } else if (robot.data.mode == 3 && run == 1) { //Start new turn in opposite direction:
            run = 0; drAngle = drAngle < 0 ? 64 : -64; angle = 0; drRun = 1;
            robot.drive(100, (drAngle - angle < 0) ? -1 : 1);
        }
    }

    //Stop turning when 's' is pressed:
    stopTurn = function () {
        if (robot.data.mode == 3 && drRun) { //If already turning:
            run = 1; drRun = 0; //driveLogic(); //Stop turn.
        }
    }

    var angle = 0; //Count Angle Changes Using Encoders:
    robot.onMotion = function () {
        angle += robot.delta.angle; console.log("Angle:", angle);

        options.form.angle = angle;
        request(options, function (error, response, body) {
            console.log('sending request')
            if (!error && response.statusCode == 200) {
                // Print out the response body
                console.log(body)
            }
        });


        if (((drAngle >= 0 && angle >= drAngle) || (drAngle < 0 && angle
            <= drAngle)) && drRun) { drRun = 0; run = 1; driveLogic(); }
    }

    // Prevent Default Behavior of Buttons in Passive Mode:
    function preventDefault(func) {
        setTimeout(function () { robot.full(); if (func) setTimeout(func, 500) }, 1400);
    }

    io.on('connection', (socket) => {
        console.log('a user connected');

        socket.on('disconnect', () => {
            console.log('user disconnected');
        });

        socket.on('move-up', () => {
            console.log('move up')
            robot.drive(100, 32767);
            robot.play(0);
        });

        socket.on('turn-left', () => {
            console.log('turn left');
            turnRobot();
            // robot.drive(10, -1);
        })

        socket.on('turn-right', () => {
            console.log('turn right')
            turnRobot();
            // robot.drive(10, 1);
        });

        socket.on('stop-turning', () => {
            console.log('stop turn')
            robot.driveSpeed(0, 0); 
        })
        
    });
}

function handleInput(robot) {
    //Process user input, quit on 'exit'
    const rl = require('readline').createInterface
        ({ input: process.stdin, output: process.stdout });
    rl.on('line', function (text) {
        if (text == "exit" || text == "quit") {
            console.log("Exiting..."); process.exit();
        } else if (text == "t") {
            turnRobot(); //Turn Robot.
        } else if (text == "s") {
            stopTurn(); //Stop Turning.
        } else if (text == "ss") {
        	stopLogic();
        }
    });
}

